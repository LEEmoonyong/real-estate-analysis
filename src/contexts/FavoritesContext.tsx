// [요구사항: 상태관리] 공유 상태 — 즐겨찾기·최근 검색 (Provider 내부는 useLocalStorage = useState + useEffect)
// [요구사항: 데이터 처리] 로컬 데이터 — localStorage에 저장, 다른 탭에서 바꾸면 storage 이벤트로 동기화
// 검색창(최근 검색 추가)과 즐겨찾기 패널이 같은 목록을 보도록 Context로 공유한다.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import {
  addFavorite,
  cleanFavoriteName,
  isFavoriteList,
  isRecentList,
  pushRecent,
  restoreFavorite,
} from '../data/storage/favorites';
import { STORAGE_KEYS } from '../data/storage/schema';
import type { Favorite, RecentSearch } from '../domain/types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useToast } from './ToastContext';

interface FavoritesState {
  favorites: Favorite[];
  recents: RecentSearch[];
}

interface FavoritesActions {
  /** 추가했으면 true, 같은 장소가 이미 있으면 false */
  addFavorite: (fav: Omit<Favorite, 'id' | 'createdAt'>) => boolean;
  renameFavorite: (id: string, name: string) => void;
  /** 삭제 — 5초 동안 "실행 취소" 토스트 */
  removeFavorite: (id: string) => void;
  addRecent: (entry: Omit<RecentSearch, 'at'>) => void;
  removeRecent: (at: number) => void;
  clearRecents: () => void;
}

const EMPTY_FAVORITES: Favorite[] = [];
const EMPTY_RECENTS: RecentSearch[] = [];

const FavoritesStateContext = createContext<FavoritesState | null>(null);
const FavoritesActionsContext = createContext<FavoritesActions | null>(null);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const warn = useCallback((message: string) => showToast({ message, tone: 'warning', durationMs: 8000 }), [showToast]);

  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.favorites, EMPTY_FAVORITES, {
    version: 1,
    validate: isFavoriteList,
    onError: warn,
  });
  const [recents, setRecents, clearRecentsStorage] = useLocalStorage(STORAGE_KEYS.recentSearches, EMPTY_RECENTS, {
    version: 1,
    validate: isRecentList,
    onError: warn,
  });

  const add = useCallback(
    (input: Omit<Favorite, 'id' | 'createdAt'>) => {
      const fav: Favorite = { ...input, id: newId(), createdAt: Date.now() };
      // 중복 여부는 현재 목록으로 바로 판단해 결과를 돌려준다
      const { added } = addFavorite(favorites, fav);
      if (added) setFavorites((prev) => addFavorite(prev, fav).list);
      return added;
    },
    [favorites, setFavorites],
  );

  const renameFavorite = useCallback(
    (id: string, name: string) => {
      const clean = cleanFavoriteName(name);
      if (!clean) return;
      setFavorites((prev) => prev.map((f) => (f.id === id ? { ...f, name: clean } : f)));
    },
    [setFavorites],
  );

  const removeFavorite = useCallback(
    (id: string) => {
      const index = favorites.findIndex((f) => f.id === id);
      const removed = favorites[index];
      if (!removed) return;
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      showToast({
        message: `즐겨찾기를 삭제했습니다 — ${removed.name}`,
        action: { label: '실행 취소', onClick: () => setFavorites((prev) => restoreFavorite(prev, removed, index)) },
        durationMs: 5000,
      });
    },
    [favorites, setFavorites, showToast],
  );

  const addRecent = useCallback(
    (entry: Omit<RecentSearch, 'at'>) => setRecents((prev) => pushRecent(prev, { ...entry, at: Date.now() })),
    [setRecents],
  );
  const removeRecent = useCallback((at: number) => setRecents((prev) => prev.filter((r) => r.at !== at)), [setRecents]);

  const state = useMemo(() => ({ favorites, recents }), [favorites, recents]);
  const actions = useMemo(
    () => ({
      addFavorite: add,
      renameFavorite,
      removeFavorite,
      addRecent,
      removeRecent,
      clearRecents: clearRecentsStorage,
    }),
    [add, renameFavorite, removeFavorite, addRecent, removeRecent, clearRecentsStorage],
  );

  return (
    <FavoritesActionsContext.Provider value={actions}>
      <FavoritesStateContext.Provider value={state}>{children}</FavoritesStateContext.Provider>
    </FavoritesActionsContext.Provider>
  );
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesStateContext);
  if (!ctx) throw new Error('useFavorites는 FavoritesProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useFavoritesActions(): FavoritesActions {
  const ctx = useContext(FavoritesActionsContext);
  if (!ctx) throw new Error('useFavoritesActions는 FavoritesProvider 안에서 사용해야 합니다.');
  return ctx;
}
