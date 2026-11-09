// 지도 시세 표시 세부 조건 (확장 X5, X8) — 값 범위(매매 평당가·전세 보증금·월세), 월세 보증금 상한,
// 면적(평) 범위, 준공 연도.
// 모두 이미 불러온 표시를 거르는 조건이라 서버를 다시 부르지 않는다.
import { M2_PER_PYEONG } from './types';

export interface MapFilter {
  /** 값 하한·상한 [만원] — 매매는 평당가, 전세는 보증금, 월세는 월세 (null = 제한 없음) */
  minValue: number | null;
  maxValue: number | null;
  /** 월세일 때 보증금 중앙값 상한 [만원] */
  maxDeposit: number | null;
  /** 면적 중앙값 범위 [평] */
  minPyeong: number | null;
  maxPyeong: number | null;
  /** 이 연도 이후 준공 (준공 연도를 모르는 곳은 숨김) */
  minBuildYear: number | null;
}

export const DEFAULT_MAP_FILTER: MapFilter = {
  minValue: null,
  maxValue: null,
  maxDeposit: null,
  minPyeong: null,
  maxPyeong: null,
  minBuildYear: null,
};

/** 거르기에 쓰는 한 곳의 값 */
export interface FilterSubject {
  /** 매매 평당가 / 전세 보증금 / 월세 [만원] */
  value: number;
  /** 월세 보증금 중앙값 [만원] */
  deposit: number;
  /** 면적 중앙값 [㎡] */
  areaM2: number;
  buildYear: number | null;
}

export function isFilterActive(f: MapFilter): boolean {
  return (
    f.minValue !== null ||
    f.maxValue !== null ||
    f.maxDeposit !== null ||
    f.minPyeong !== null ||
    f.maxPyeong !== null ||
    f.minBuildYear !== null
  );
}

/** 켜 둔 세부 조건 개수 (패널 접힘 상태에 표시) */
export function activeFilterCount(f: MapFilter): number {
  return [
    f.minValue !== null || f.maxValue !== null,
    f.maxDeposit !== null,
    f.minPyeong !== null || f.maxPyeong !== null,
    f.minBuildYear !== null,
  ].filter(Boolean).length;
}

export function passesMapFilter(s: FilterSubject, f: MapFilter): boolean {
  if (f.minValue !== null && s.value < f.minValue) return false;
  if (f.maxValue !== null && s.value > f.maxValue) return false;
  if (f.maxDeposit !== null && s.deposit > f.maxDeposit) return false;
  const py = s.areaM2 / M2_PER_PYEONG;
  if (f.minPyeong !== null && py < f.minPyeong) return false;
  if (f.maxPyeong !== null && py > f.maxPyeong) return false;
  if (f.minBuildYear !== null && (s.buildYear === null || s.buildYear < f.minBuildYear)) return false;
  return true;
}

/** 면적 단계 [평] · 준공 연도 단계 · 월세 보증금 상한 단계 [만원] */
export const PYEONG_STEPS = [5, 10, 15, 20, 25, 30, 40, 50] as const;
export const BUILD_YEAR_STEPS = [2020, 2015, 2010, 2005, 2000, 1990] as const;
export const DEPOSIT_CAP_STEPS = [500, 1_000, 2_000, 3_000, 5_000, 10_000] as const;
