// [요구사항: Hooks] 커스텀 훅 — useState + useEffect로 localStorage와 동기화
// [요구사항: 데이터 처리] 로컬 데이터(즐겨찾기·최근 검색·보정값·설정) 저장
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { parseStored, serializeStored, type Migration } from '../data/storage/schema';

interface Options<T> {
  version: number;
  validate: (data: unknown) => data is T;
  migrate?: Migration;
  /** 저장 실패(용량 초과·사생활 보호 모드) 시 호출 */
  onError?: (message: string) => void;
}

function readStorage<T>(key: string, initial: T, opts: Options<T>): T {
  try {
    const result = parseStored(window.localStorage.getItem(key), opts.version, opts.validate, opts.migrate);
    return result.ok ? result.value : initial;
  } catch {
    return initial; // localStorage 접근 자체가 막힌 환경
  }
}

/**
 * localStorage에 동기화되는 상태.
 * - 초기값은 lazy initializer로 한 번만 읽는다.
 * - 값이 바뀌면 useEffect에서 저장한다.
 * - 다른 탭에서 바뀌면 storage 이벤트로 반영한다.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  opts: Options<T>,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [value, setValue] = useState<T>(() => readStorage(key, initial, opts));
  // 다른 탭에서 받은 값을 다시 저장하지 않도록 표시
  const skipNextWrite = useRef(false);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, serializeStored(value, optsRef.current.version));
    } catch {
      optsRef.current.onError?.('브라우저 저장 공간에 저장하지 못했습니다. 이 세션 동안만 유지됩니다.');
    }
  }, [key, value]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== window.localStorage) return;
      const o = optsRef.current;
      const result = parseStored(event.newValue, o.version, o.validate, o.migrate);
      skipNextWrite.current = true;
      setValue(result.ok ? result.value : initial);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
    // initial은 호출부에서 상수로 넘기는 것을 전제로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* 무시 */
    }
    skipNextWrite.current = true;
    setValue(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, remove];
}
