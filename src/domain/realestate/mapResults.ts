// 지도 지역 조건 결과 — 조건에 맞는 곳 목록 정렬, 가격 분포 막대(히스토그램), 가격 슬라이더 범위.
// React와 무관한 순수 함수라 테스트로 확인한다.
import type { DealKind } from './property';

export type ResultSort = 'count' | 'priceAsc' | 'priceDesc' | 'newest';

export const RESULT_SORT_OPTIONS: readonly { id: ResultSort; label: string }[] = [
  { id: 'count', label: '거래 많은 순' },
  { id: 'priceAsc', label: '가격 낮은 순' },
  { id: 'priceDesc', label: '가격 높은 순' },
  { id: 'newest', label: '최신 준공 순' },
];

export interface SortablePlace {
  name: string;
  count: number;
  buildYear: number | null;
}

/**
 * 결과 정렬 (원본은 그대로 두고 새 배열).
 * @param valueOf 그 곳의 비교 값 [만원] — 매매 평당가 / 전세 보증금 / 월세
 */
export function sortResults<T extends SortablePlace>(
  items: readonly T[],
  sort: ResultSort,
  valueOf: (t: T) => number,
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'ko');
  return [...items].sort((a, b) => {
    switch (sort) {
      case 'count':
        return b.count - a.count || valueOf(a) - valueOf(b) || byName(a, b);
      case 'priceAsc':
        return valueOf(a) - valueOf(b) || byName(a, b);
      case 'priceDesc':
        return valueOf(b) - valueOf(a) || byName(a, b);
      case 'newest':
        // 준공 연도를 모르는 곳은 맨 뒤
        return (b.buildYear ?? 0) - (a.buildYear ?? 0) || byName(a, b);
    }
  });
}

/** 가격 슬라이더 한 칸 [만원] — 매매 평당가 100만, 전세 1천만, 월세 5만 */
export function priceStep(kind: DealKind): number {
  return kind === 'trade' ? 100 : kind === 'jeonse' ? 1_000 : 5;
}

/**
 * 슬라이더 양 끝 — 불러온 곳 값의 최솟값·최댓값을 한 칸 단위로 내림·올림.
 * 값이 없거나 하나뿐이면 한 칸 이상 벌린다.
 */
export function priceBounds(values: readonly number[], kind: DealKind): { lo: number; hi: number } {
  const step = priceStep(kind);
  if (values.length === 0) return { lo: 0, hi: step * 10 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  lo = Math.max(0, Math.floor(lo / step) * step);
  hi = Math.ceil(hi / step) * step;
  if (hi <= lo) hi = lo + step;
  return { lo, hi };
}

/** [lo, hi]를 bins칸으로 나눈 개수 (범위 밖 값은 양 끝 칸에) */
export function histogram(values: readonly number[], lo: number, hi: number, bins: number): number[] {
  const counts = new Array<number>(bins).fill(0);
  const width = (hi - lo) / bins;
  if (width <= 0) return counts;
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / width)));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
}
