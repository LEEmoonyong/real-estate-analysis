// 단지 비교 목록 — 시세 탭에서 "비교에 담기"한 단지 (최대 3곳). React와 무관한 순수 함수, 단위 테스트한다.
import { isArrayOf, isRecord } from './schema';

export const MAX_COMPARE = 3;

export interface CompareEntry {
  /** 단지 상세 주소 (/complex/geo-…/price?name=…) — 비교 화면이 이 주소로 단지를 다시 찾는다 */
  path: string;
  name: string;
  /** 실거래 단지 식별자 — 같은 단지인지 가린다 (없으면 path로) */
  id: string;
}

export const isCompareEntry = (x: unknown): x is CompareEntry =>
  isRecord(x) &&
  typeof x.path === 'string' &&
  x.path.startsWith('/complex/') &&
  typeof x.name === 'string' &&
  typeof x.id === 'string';

export const isCompareList = isArrayOf(isCompareEntry);

export function inCompare(list: readonly CompareEntry[], id: string): boolean {
  return list.some((e) => e.id === id);
}

/**
 * 있으면 빼고 없으면 끝에 넣는다. 이미 3곳이면 가장 먼저 담은 곳을 뺀다.
 * @returns 바뀐 목록과, 자리가 없어 밀려난 단지
 */
export function toggleCompare(
  list: readonly CompareEntry[],
  entry: CompareEntry,
): { list: CompareEntry[]; dropped: CompareEntry | null } {
  if (inCompare(list, entry.id)) return { list: list.filter((e) => e.id !== entry.id), dropped: null };
  const next = [...list, entry];
  const dropped = next.length > MAX_COMPARE ? next[0]! : null;
  return { list: next.slice(-MAX_COMPARE), dropped };
}
