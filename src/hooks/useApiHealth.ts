// [요구사항: Hooks] 커스텀 훅 — 데이터 경로(로컬 키 → 배포 서버 → 샘플)를 화면 상태로 가져온다 (useState + useEffect)
// 실제 확인은 data/apiHealth.ts가 앱 전체에서 한 번만 한다. API 요청(getJson)도 같은 결과를 기다리므로
// 단지 상세 탭 주소로 바로 들어와도 경로가 정해진 뒤에 요청이 나간다.
import { useEffect, useState } from 'react';
import { FORCE_SAMPLE_MODE } from '../config/constants';
import { checkApiHealth, FORCED_SAMPLE, NO_KEYS, type ApiHealth } from '../data/apiHealth';

export {
  resolveApiHealth,
  shouldTryRemote,
  type ApiHealth,
  type ApiRoute,
  type DataMode,
  type HealthBody,
} from '../data/apiHealth';

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>(() =>
    FORCE_SAMPLE_MODE ? FORCED_SAMPLE : { mode: 'checking', route: null, reason: null, keys: NO_KEYS },
  );

  useEffect(() => {
    let alive = true;
    void checkApiHealth().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, []);

  return health;
}
