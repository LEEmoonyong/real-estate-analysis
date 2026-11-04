// [요구사항: Hooks] 커스텀 훅 — 마운트 시 프록시 상태를 확인해 실데이터/샘플 모드를 결정 (useEffect + AbortController)
import { useEffect, useState } from 'react';
import { FORCE_SAMPLE_MODE } from '../config/constants';

export type DataMode = 'checking' | 'live' | 'sample';

export interface ApiHealth {
  mode: DataMode;
  /** 샘플 모드인 이유 (화면 안내용) */
  reason: string | null;
  keys: { kakao: boolean; vworld: boolean };
}

const HEALTH_TIMEOUT_MS = 3000;

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>(() =>
    FORCE_SAMPLE_MODE
      ? { mode: 'sample', reason: '샘플 모드로 시작하도록 설정되어 있습니다.', keys: { kakao: false, vworld: false } }
      : { mode: 'checking', reason: null, keys: { kakao: false, vworld: false } },
  );

  useEffect(() => {
    if (FORCE_SAMPLE_MODE) return;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, HEALTH_TIMEOUT_MS);

    fetch('/api/health', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ kakao?: boolean; vworld?: boolean }>) : Promise.reject()))
      .then((body) => {
        const keys = { kakao: Boolean(body.kakao), vworld: Boolean(body.vworld) };
        const hasGeocoder = keys.kakao || keys.vworld;
        setHealth({
          mode: hasGeocoder ? 'live' : 'sample',
          reason: hasGeocoder ? null : 'API 키가 설정되지 않아 샘플 지역으로 동작합니다.',
          keys,
        });
      })
      .catch(() => {
        // 언마운트(StrictMode 이중 실행 포함)로 취소된 요청은 실패가 아니다. 시간 초과만 실패로 본다.
        if (controller.signal.aborted && !timedOut) return;
        setHealth({
          mode: 'sample',
          reason: '데이터 서버에 연결할 수 없어 샘플 지역으로 동작합니다.',
          keys: { kakao: false, vworld: false },
        });
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return health;
}
