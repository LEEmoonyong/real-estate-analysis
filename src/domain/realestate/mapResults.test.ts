import { describe, expect, it } from 'vitest';
import { histogram, priceBounds, priceStep, sortResults } from './mapResults';

const items = [
  { name: '가', count: 3, buildYear: 2010, v: 5_000 },
  { name: '나', count: 8, buildYear: null, v: 3_000 },
  { name: '다', count: 3, buildYear: 2021, v: 4_000 },
];
const value = (t: (typeof items)[number]) => t.v;

describe('지역 조건 결과 정렬', () => {
  it('거래 많은 순 — 같으면 싼 곳 먼저', () => {
    expect(sortResults(items, 'count', value).map((i) => i.name)).toEqual(['나', '다', '가']);
  });

  it('가격 낮은·높은 순', () => {
    expect(sortResults(items, 'priceAsc', value).map((i) => i.name)).toEqual(['나', '다', '가']);
    expect(sortResults(items, 'priceDesc', value).map((i) => i.name)).toEqual(['가', '다', '나']);
  });

  it('최신 준공 순 — 모르는 곳은 맨 뒤, 원본은 그대로', () => {
    expect(sortResults(items, 'newest', value).map((i) => i.name)).toEqual(['다', '가', '나']);
    expect(items[0]!.name).toBe('가');
  });
});

describe('가격 슬라이더 범위·분포', () => {
  it('한 칸 단위로 내림·올림', () => {
    expect(priceStep('trade')).toBe(100);
    expect(priceBounds([3_150, 6_020], 'trade')).toEqual({ lo: 3_100, hi: 6_100 });
    expect(priceBounds([], 'wolse')).toEqual({ lo: 0, hi: 50 });
    expect(priceBounds([40_000], 'jeonse')).toEqual({ lo: 40_000, hi: 41_000 });
  });

  it('막대 개수 — 끝값은 마지막 칸', () => {
    expect(histogram([0, 1, 5, 9, 10, 99], 0, 10, 2)).toEqual([2, 4]);
    expect(histogram([1], 5, 5, 3)).toEqual([0, 0, 0]);
  });
});
