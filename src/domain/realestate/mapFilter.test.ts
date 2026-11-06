import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_FILTER, isFilterActive, passesMapFilter } from './mapFilter';

describe('지도 시세 필터', () => {
  it('기본값은 모두 통과', () => {
    expect(isFilterActive(DEFAULT_MAP_FILTER)).toBe(false);
    expect(passesMapFilter(9_000, null, DEFAULT_MAP_FILTER)).toBe(true);
  });

  it('평당가 범위', () => {
    const f = { ...DEFAULT_MAP_FILTER, minPyeong: 3_000, maxPyeong: 6_000 };
    expect(isFilterActive(f)).toBe(true);
    expect(passesMapFilter(2_999, null, f)).toBe(false);
    expect(passesMapFilter(4_000, null, f)).toBe(true);
    expect(passesMapFilter(6_001, null, f)).toBe(false);
  });

  it('일조 조건을 켜면 계산 안 한 단지는 숨김', () => {
    const f = { ...DEFAULT_MAP_FILTER, minSunPct: 70 };
    expect(passesMapFilter(4_000, null, f)).toBe(false);
    expect(passesMapFilter(4_000, 69, f)).toBe(false);
    expect(passesMapFilter(4_000, 70, f)).toBe(true);
  });
});
