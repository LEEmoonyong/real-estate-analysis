// 지도 시세 표시 필터 (확장 X5) — 평당가 범위 + 일조 기준 충족 비율
// 일조는 이 기기에서 한 번 계산한 단지만 알 수 있으므로, 일조 조건을 켜면 계산 안 한 단지는 숨긴다.

export interface MapFilter {
  /** 평당가 하한·상한 [만원] (null = 제한 없음) */
  minPyeong: number | null;
  maxPyeong: number | null;
  /** 참고 기준 충족 세대 비율 하한 [%] (0 = 일조 조건 없음) */
  minSunPct: number;
}

export const DEFAULT_MAP_FILTER: MapFilter = { minPyeong: null, maxPyeong: null, minSunPct: 0 };

export function isFilterActive(f: MapFilter): boolean {
  return f.minPyeong !== null || f.maxPyeong !== null || f.minSunPct > 0;
}

/** 평당가(만원)와 일조 충족 비율(모르면 null)이 조건을 통과하는가 */
export function passesMapFilter(pyeongPrice: number, sunPct: number | null, f: MapFilter): boolean {
  if (f.minPyeong !== null && pyeongPrice < f.minPyeong) return false;
  if (f.maxPyeong !== null && pyeongPrice > f.maxPyeong) return false;
  if (f.minSunPct > 0 && (sunPct === null || sunPct < f.minSunPct)) return false;
  return true;
}
