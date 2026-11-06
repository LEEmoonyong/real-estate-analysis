// 데이터 경로 결정 — 앱 전체에서 한 번만 확인한다 (화면마다 다시 묻지 않고, 어느 화면으로 바로 들어와도 같은 결과)
// 1) 같은 출처의 /api/health — 키가 있으면 그대로 사용 (배포 사이트, 키를 넣은 로컬 실행)
// 2) 로컬에 키가 없거나 /api가 없으면(npm run preview 등) 배포 서버의 /api를 빌려 쓴다 — 키는 배포 서버에만 있다
// 3) 둘 다 안 되면 샘플 모드 (건물은 샘플 JSON, 시세·주변 시설은 샘플 스냅샷)
import { FORCE_SAMPLE_MODE, REMOTE_API_BASE } from '../config/constants';

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
export const NO_KEYS = { kakao: false, vworld: false };

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

async function fetchHealth(url: string, timeoutMs: number): Promise<HealthBody | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as HealthBody;
  } catch {
    return null;
  }
}

export const FORCED_SAMPLE: ApiHealth = {
  mode: 'sample',
  route: null,
  reason: '샘플 모드로 시작하도록 설정되어 있습니다.',
  keys: NO_KEYS,
};

let pending: Promise<ApiHealth> | null = null;

/** 데이터 경로를 한 번 확인해 기억한다 (동시에 여러 곳에서 불러도 요청은 한 번) */
export function checkApiHealth(): Promise<ApiHealth> {
  pending ??= (async () => {
    if (FORCE_SAMPLE_MODE) return FORCED_SAMPLE;
    const local = await fetchHealth('/api/health', LOCAL_TIMEOUT_MS);
    let remote: HealthBody | null = null;
    if (!usable(local) && shouldTryRemote(REMOTE_API_BASE, window.location.origin)) {
      remote = await fetchHealth(`${REMOTE_API_BASE}/api/health`, REMOTE_TIMEOUT_MS);
    }
    return resolveApiHealth(local, remote);
  })();
  return pending;
}
