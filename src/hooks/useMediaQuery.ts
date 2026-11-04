// [요구사항: Hooks] 커스텀 훅 — matchMedia 구독 (useSyncExternalStore)
// [요구사항: 이벤트 처리] 미디어 쿼리 change 이벤트 (창 크기·방향 변경)
import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
