// 지도 시세 표시 세부 조건 (확장 X5, X8) — 값 범위(매매 평당가·전세 보증금·월세), 월세 보증금 상한,
// 면적(평) 범위, 준공 연도, 최근 3달 거래 건수(1~2건뿐이라 값이 흔들리는 곳을 거를 때).
// 모두 이미 불러온 표시를 거르는 조건이라 서버를 다시 부르지 않는다.
import { formatManwonShort } from './format';
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
  /** 최근 3달 거래가 이 건수 이상인 곳만 (null = 제한 없음) */
  minCount: number | null;
}

export const DEFAULT_MAP_FILTER: MapFilter = {
  minValue: null,
  maxValue: null,
  maxDeposit: null,
  minPyeong: null,
  maxPyeong: null,
  minBuildYear: null,
  minCount: null,
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
  /** 최근 3달 거래 건수 */
  count: number;
}

export function isFilterActive(f: MapFilter): boolean {
  return activeFilterCount(f) > 0;
}

/** 켜 둔 세부 조건 개수 (패널 접힘 상태에 표시) */
export function activeFilterCount(f: MapFilter): number {
  return [
    f.minValue !== null || f.maxValue !== null,
    f.maxDeposit !== null,
    f.minPyeong !== null || f.maxPyeong !== null,
    f.minBuildYear !== null,
    f.minCount !== null,
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
  if (f.minCount !== null && s.count < f.minCount) return false;
  return true;
}

/** 면적 단계 [평] · 준공 연도 단계 · 월세 보증금 상한 단계 [만원] · 거래 건수 단계 */
export const PYEONG_STEPS = [5, 10, 15, 20, 25, 30, 40, 50] as const;
export const BUILD_YEAR_STEPS = [2020, 2015, 2010, 2005, 2000, 1990] as const;
export const DEPOSIT_CAP_STEPS = [500, 1_000, 2_000, 3_000, 5_000, 10_000] as const;
export const COUNT_STEPS = [2, 3, 5, 10] as const;

/** 켜 둔 조건 하나 — 패널 위 칩으로 보여 주고 ×로 그것만 끈다 */
export interface FilterChip {
  id: 'value' | 'deposit' | 'area' | 'year' | 'count';
  label: string;
  /** 이 조건만 끄는 변경 */
  clear: Partial<MapFilter>;
}

/** 하한·상한 글자: 'a ~ b' / 'a 이상' / 'b 이하' */
function rangeText(lo: string | null, hi: string | null): string {
  if (lo !== null && hi !== null) return `${lo} ~ ${hi}`;
  return lo !== null ? `${lo} 이상` : `${hi ?? ''} 이하`;
}

/**
 * 켜 둔 세부 조건을 칩 글자로.
 * @param valueText 값[만원]을 거래 종류에 맞게 쓰는 함수 — 예: 평당 4000만 / 전세 3억 / 월 50만
 */
export function filterChips(f: MapFilter, valueText: (v: number) => string): FilterChip[] {
  const chips: FilterChip[] = [];
  const text = (v: number | null) => (v === null ? null : valueText(v));
  const py = (v: number | null) => (v === null ? null : `${v}평`);
  if (f.minValue !== null || f.maxValue !== null)
    chips.push({
      id: 'value',
      label: rangeText(text(f.minValue), text(f.maxValue)),
      clear: { minValue: null, maxValue: null },
    });
  if (f.maxDeposit !== null)
    chips.push({ id: 'deposit', label: `보증금 ${formatManwonShort(f.maxDeposit)} 이하`, clear: { maxDeposit: null } });
  if (f.minPyeong !== null || f.maxPyeong !== null)
    chips.push({
      id: 'area',
      label: rangeText(py(f.minPyeong), py(f.maxPyeong)),
      clear: { minPyeong: null, maxPyeong: null },
    });
  if (f.minBuildYear !== null)
    chips.push({ id: 'year', label: `${f.minBuildYear}년 이후 준공`, clear: { minBuildYear: null } });
  if (f.minCount !== null) chips.push({ id: 'count', label: `거래 ${f.minCount}건 이상`, clear: { minCount: null } });
  return chips;
}
