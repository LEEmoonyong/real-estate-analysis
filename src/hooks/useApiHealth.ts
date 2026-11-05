// [요구사항: Hooks] 커스텀 훅 — 마운트 시 프록시 상태를 확인해 데이터 경로를 정한다 (useEffect + AbortController)
// 1) 같은 출처의 /api/health — 키가 있으면 그대로 사용 (배포 사이트, 키를 넣은 로컬 실행)
// 2) 로컬에 키가 없거나 /api가 없으면(npm run preview 등) 배포 서버의 /api를 빌려 쓴다 — 키는 배포 서버에만 있다
// 3) 둘 다 안 되면 샘플 모드
import { useEffect, useState } from 'react';
import { FORCE_SAMPLE_MODE, REMOTE_API_BASE } from '../config/constants';
import { setApiBase } from '../data/apiClient';

export type DataMode = 'checking' | 'live' | 'sample';
/** 실데이터 요청이 가는 곳: 같은 서버 / 빌려 쓰는 배포 서버 */
export type ApiRoute = 'local' | 'remote' | null;

export interface ApiHealth {
  mode: DataMode;
  route: ApiRoute;
  /** 샘플 모드인 이유 (화면 안내용) */
  reason: string | null;
  keys: { kakao: boolean; vworld: boolean };
}

export interface HealthBody {
  kakao?: boolean;
  vworld?: boolean;
}

const LOCAL_TIMEOUT_MS = 3000;
const REMOTE_TIMEOUT_MS = 6000;
const NO_KEYS = { kakao: false, vworld: false };

const keysOf = (body: HealthBody | null) => ({ kakao: Boolean(body?.kakao), vworld: Boolean(body?.vworld) });
const usable = (body: HealthBody | null) => Boolean(body?.kakao || body?.vworld);

/**
 * 데이터 경로 결정 (순수 함수 — 단위 테스트)
 * @param local 같은 출처 health (실패면 null)
 * @param remote 배포 서버 health (시도하지 않았거나 실패면 null)
 */
export function resolveApiHealth(local: HealthBody | null, remote: HealthBody | null): ApiHealth {
  if (usable(local)) return { mode: 'live', route: 'local', reason: null, keys: keysOf(local) };
  if (usable(remote)) return { mode: 'live', route: 'remote', reason: null, keys: keysOf(remote) };
  return {
    mode: 'sample',
    route: null,
    reason: local
      ? 'API 키가 설정되지 않았고 배포 서버에도 연결할 수 없어 샘플 지역으로 동작합니다.'
      : '데이터 서버에 연결할 수 없어 샘플 지역으로 동작합니다.',
    keys: NO_KEYS,
  };
}

/** 배포 서버를 빌려 쓸 필요가 있는지 — 이미 그 서버에서 열었거나 설정으로 껐으면 시도하지 않는다 */
export function shouldTryRemote(remoteBase: string, currentOrigin: string): boolean {
  return remoteBase !== '' && remoteBase !== currentOrigin;
}

async function fetchHealth(url: string, signal: AbortSignal, timeoutMs: number): Promise<HealthBody | null> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal;
  try {
    const res = await fetch(url, { signal: combined });
    if (!res.ok) return null;
    return (await res.json()) as HealthBody;
  } catch {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); // 언마운트 — 결과를 버린다
    return null;
  }
}

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>(() =>
    FORCE_SAMPLE_MODE
      ? { mode: 'sample', route: null, reason: '샘플 모드로 시작하도록 설정되어 있습니다.', keys: NO_KEYS }
      : { mode: 'checking', route: null, reason: null, keys: NO_KEYS },
  );

  useEffect(() => {
    if (FORCE_SAMPLE_MODE) return;
    const controller = new AbortController();

    void (async () => {
      const local = await fetchHealth('/api/health', controller.signal, LOCAL_TIMEOUT_MS);
      let remote: HealthBody | null = null;
      if (!usable(local) && shouldTryRemote(REMOTE_API_BASE, window.location.origin)) {
        remote = await fetchHealth(`${REMOTE_API_BASE}/api/health`, controller.signal, REMOTE_TIMEOUT_MS);
      }
      const next = resolveApiHealth(local, remote);
      setApiBase(next.route === 'remote' ? REMOTE_API_BASE : '');
      setHealth(next);
    })().catch(() => undefined); // 언마운트(StrictMode 이중 실행 포함)로 취소된 요청은 무시

    return () => controller.abort();
  }, []);

  return health;
}
