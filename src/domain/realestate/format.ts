// 부동산 값 표기 — 금액(만원), 면적(㎡·평), 가격 등급
import { M2_PER_PYEONG } from './types';

/** 만원 → '32억', '3억 2,000만', '9,500만' (억 단위 이상은 천만 자리까지만) */
export function formatManwon(manwon: number): string {
  const v = Math.round(manwon);
  if (Math.abs(v) < 10000) return `${v.toLocaleString('ko-KR')}만`;
  const eok = Math.trunc(v / 10000);
  const rest = Math.round((v - eok * 10000) / 1000) * 1000;
  if (rest === 0) return `${eok}억`;
  if (rest === 10000) return `${eok + 1}억`;
  return `${eok}억 ${rest.toLocaleString('ko-KR')}만`;
}

/** 지도 표시처럼 짧게: '32억', '3.2억', '9500만' */
export function formatManwonShort(manwon: number): string {
  if (Math.abs(manwon) < 10000) return `${Math.round(manwon)}만`;
  const eok = manwon / 10000;
  return `${eok >= 10 ? Math.round(eok) : Math.round(eok * 10) / 10}억`;
}

/** 전용면적 → '84㎡ (25평)' */
export function formatArea(m2: number): string {
  return `${Math.round(m2)}㎡ (${Math.round(m2 / M2_PER_PYEONG)}평)`;
}

/** ㎡당 가격 [만원/㎡] → 평당 가격 [만원/평] */
export function perPyeong(perM2: number): number {
  return perM2 * M2_PER_PYEONG;
}

/**
 * 값들을 n등급(0 ~ n−1)으로 나누는 경계 — 분위수 기준이라 지역마다 상대적인 비싸고 싼 정도가 보인다.
 * @returns 오름차순 경계 n−1개
 */
export function quantileBreaks(values: readonly number[], n = 5): number[] {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return Array.from({ length: n - 1 }, (_, i) => sorted[Math.floor(((i + 1) * sorted.length) / n)] ?? sorted.at(-1)!);
}

export function classOf(value: number, breaks: readonly number[]): number {
  let c = 0;
  while (c < breaks.length && value >= breaks[c]!) c++;
  return c;
}

/** 전용면적 구간 (평형대) — 시세 그래프 필터용 */
export const AREA_BANDS = [
  { id: 'small', label: '60㎡ 이하', min: 0, max: 60 },
  { id: 'mid', label: '60~85㎡', min: 60, max: 85 },
  { id: 'large', label: '85~135㎡', min: 85, max: 135 },
  { id: 'xl', label: '135㎡ 초과', min: 135, max: Infinity },
] as const;
export type AreaBandId = (typeof AREA_BANDS)[number]['id'];

export function areaBandOf(m2: number): AreaBandId {
  // 경계값(정확히 60·85·135)은 아래 구간에 넣는다 — 국민주택규모 85㎡ "이하" 관례
  return (AREA_BANDS.find((b) => m2 <= b.max && m2 > b.min) ?? AREA_BANDS[0]).id;
}
