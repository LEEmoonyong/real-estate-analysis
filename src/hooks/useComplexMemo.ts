// [요구사항: Hooks] 커스텀 훅 — 단지 메모 저장소(localStorage). 시세 탭의 메모 칸과 단지 비교 화면이 같이 쓴다.
// 한 화면에서는 이 훅을 한 번만 부르고 결과를 나눠 써야 한다 (여러 번 부르면 저장할 때 서로 덮어쓴다).
import { isMemoMap, type ComplexMemo } from '../data/storage/complexNotes';
import { STORAGE_KEYS } from '../data/storage/schema';
import { useLocalStorage } from './useLocalStorage';

const NO_MEMOS: Record<string, ComplexMemo> = {};

/** 모든 단지 메모와 바꾸는 함수 */
export function useMemos() {
  return useLocalStorage(STORAGE_KEYS.memos, NO_MEMOS, { version: 1, validate: isMemoMap });
}
