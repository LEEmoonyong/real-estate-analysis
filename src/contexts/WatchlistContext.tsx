// [요구사항: 상태관리] 관심 단지 (확장 X6) — useLocalStorage(새로 고침 후에도 유지, 다른 탭과 동기화)를 Context로 나눈다.
// 지도 홈(새 거래 알림)과 단지 상세 시세 탭(☆ 버튼, 확인 처리)이 같은 목록을 쓴다.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../data/storage/schema';
import { isWatchList, markSeen, toggleWatched, type WatchedComplex } from '../data/storage/watchlist';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface WatchlistValue {
  watched: WatchedComplex[];
  toggle: (entry: WatchedComplex) => void;
  /** 이 날짜까지의 거래를 확인함 */
  seen: (aptSeq: string, date: string) => void;
}

const EMPTY: WatchedComplex[] = [];
const WatchlistContext = createContext<WatchlistValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watched, setWatched] = useLocalStorage(STORAGE_KEYS.watchlist, EMPTY, { version: 1, validate: isWatchList });
  const toggle = useCallback((entry: WatchedComplex) => setWatched((prev) => toggleWatched(prev, entry)), [setWatched]);
  const seen = useCallback(
    (aptSeq: string, date: string) => setWatched((prev) => markSeen(prev, aptSeq, date) as WatchedComplex[]),
    [setWatched],
  );
  const value = useMemo(() => ({ watched, toggle, seen }), [watched, toggle, seen]);
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist는 WatchlistProvider 안에서 사용해야 합니다.');
  return ctx;
}
