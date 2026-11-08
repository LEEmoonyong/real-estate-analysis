// 지도 시세 표시 필터 (확장 X5, X8) — 값 범위(매매 평당가·전세 보증금·월세) + 일조 기준 충족 비율
// 일조는 이 기기에서 한 번 계산한 단지만 알 수 있으므로, 일조 조건을 켜면 계산 안 한 단지는 숨긴다.

export interface MapFilter {
  /** 값 하한·상한 [만원] — 매매는 평당가, 전세는 보증금, 월세는 월세 (null = 제한 없음) */
  minValue: number | null;
  maxValue: number | null;
  /** 참고 기준 충족 세대 비율 하한 [%] (0 = 일조 조건 없음) */
  minSunPct: number;
}

export const DEFAULT_MAP_FILTER: MapFilter = { minValue: null, maxValue: null, minSunPct: 0 };

export function isFilterActive(f: MapFilter): boolean {
  return f.minValue !== null || f.maxValue !== null || f.minSunPct > 0;
}

/** 값(만원)과 일조 충족 비율(모르면 null)이 조건을 통과하는가 */
export function passesMapFilter(value: number, sunPct: number | null, f: MapFilter): boolean {
  if (f.minValue !== null && value < f.minValue) return false;
  if (f.maxValue !== null && value > f.maxValue) return false;
  if (f.minSunPct > 0 && (sunPct === null || sunPct < f.minSunPct)) return false;
  return true;
}
