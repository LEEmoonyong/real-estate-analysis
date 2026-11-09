// [요구사항: 상태관리] 단지 비교 목록 — useLocalStorage(새로 고침 후에도 유지, 다른 탭과 동기화)를 Context로 나눈다.
// 시세 탭의 "비교에 담기" 버튼, 지도 패널의 "비교하기" 링크, 비교 화면이 같은 목록을 쓴다.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { isCompareList, toggleCompare, type CompareEntry } from '../data/storage/compare';
import { STORAGE_KEYS } from '../data/storage/schema';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useToast } from './ToastContext';

interface CompareValue {
  list: CompareEntry[];
  toggle: (entry: CompareEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const EMPTY: CompareEntry[] = [];
const CompareContext = createContext<CompareValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useLocalStorage(STORAGE_KEYS.compare, EMPTY, { version: 1, validate: isCompareList });
  const { showToast } = useToast();
  const toggle = useCallback(
    (entry: CompareEntry) => {
      const r = toggleCompare(list, entry);
      setList(r.list);
      if (r.dropped) showToast({ message: `비교는 3곳까지라 '${r.dropped.name}'을(를) 뺐습니다.` });
    },
    [list, setList, showToast],
  );
  const remove = useCallback((id: string) => setList((prev) => prev.filter((e) => e.id !== id)), [setList]);
  const clear = useCallback(() => setList(EMPTY), [setList]);
  const value = useMemo(() => ({ list, toggle, remove, clear }), [list, toggle, remove, clear]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare는 CompareProvider 안에서 사용해야 합니다.');
  return ctx;
}
