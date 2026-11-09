import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_FILTER,
  activeFilterCount,
  isFilterActive,
  passesMapFilter,
  type FilterSubject,
} from './mapFilter';

const s = (patch: Partial<FilterSubject> = {}): FilterSubject => ({
  value: 4_000,
  deposit: 1_000,
  areaM2: 84,
  buildYear: 2010,
  ...patch,
});

describe('지도 시세 세부 조건', () => {
  it('기본값은 모두 통과', () => {
    expect(isFilterActive(DEFAULT_MAP_FILTER)).toBe(false);
    expect(activeFilterCount(DEFAULT_MAP_FILTER)).toBe(0);
    expect(passesMapFilter(s({ value: 9_000, buildYear: null }), DEFAULT_MAP_FILTER)).toBe(true);
  });

  it('값 범위 (평당가·보증금·월세)', () => {
    const f = { ...DEFAULT_MAP_FILTER, minValue: 3_000, maxValue: 6_000 };
    expect(isFilterActive(f)).toBe(true);
    expect(passesMapFilter(s({ value: 2_999 }), f)).toBe(false);
    expect(passesMapFilter(s({ value: 4_000 }), f)).toBe(true);
    expect(passesMapFilter(s({ value: 6_001 }), f)).toBe(false);
  });

  it('월세 보증금 상한', () => {
    const f = { ...DEFAULT_MAP_FILTER, maxDeposit: 1_000 };
    expect(passesMapFilter(s({ deposit: 1_000 }), f)).toBe(true);
    expect(passesMapFilter(s({ deposit: 1_001 }), f)).toBe(false);
  });

  it('면적(평) 범위 — ㎡를 평으로 바꿔 비교', () => {
    const f = { ...DEFAULT_MAP_FILTER, minPyeong: 20, maxPyeong: 30 };
    expect(passesMapFilter(s({ areaM2: 59 }), f)).toBe(false); // 17.8평
    expect(passesMapFilter(s({ areaM2: 84 }), f)).toBe(true); // 25.4평
    expect(passesMapFilter(s({ areaM2: 114 }), f)).toBe(false); // 34.5평
  });

  it('준공 연도 — 모르는 곳은 숨김', () => {
    const f = { ...DEFAULT_MAP_FILTER, minBuildYear: 2015 };
    expect(passesMapFilter(s({ buildYear: 2014 }), f)).toBe(false);
    expect(passesMapFilter(s({ buildYear: 2015 }), f)).toBe(true);
    expect(passesMapFilter(s({ buildYear: null }), f)).toBe(false);
  });

  it('켜 둔 조건 개수 — 하한·상한은 한 조건', () => {
    expect(activeFilterCount({ ...DEFAULT_MAP_FILTER, minValue: 1, maxValue: 2, minBuildYear: 2000 })).toBe(2);
  });
});
