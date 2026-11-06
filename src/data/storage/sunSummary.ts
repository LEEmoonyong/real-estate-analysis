// 단지별 일조 요약 저장 (확장 X5) — 단지 일조를 한 번 계산하면 요약을 localStorage에 남겨 지도 필터에 쓴다.
// 순수 함수(검증·추가·찾기)는 단위 테스트하고, 읽기·쓰기는 얇은 래퍼로 둔다.
import { STORAGE_PREFIX } from '../../config/constants';
import { distanceM } from '../../domain/realestate/aggregate';
import type { LatLng } from '../../domain/types';
import { isArrayOf, isRecord, parseStored, serializeStored } from './schema';

export const SUN_SUMMARY_KEY = `${STORAGE_PREFIX}sunSummaries`;
const VERSION = 1;
export const MAX_SUMMARIES = 200;
/** 같은 곳으로 볼 거리 — 일조 장면은 중심 주변 수백 m의 건물을 함께 계산하고, 지도 시세 표시(지번 좌표)와 장면 중심도 다를 수 있다 */
export const SAME_COMPLEX_M = 400;

export interface SunSummary extends LatLng {
  name: string;
  /** 분석 날짜 YYYY-MM-DD */
  date: string;
  /** 참고 기준을 충족하는 세대 비율 [%] */
  meetsPct: number;
  /** 08~16시 총 일조 중앙값 [분] */
  medianWindowMin: number;
  unitCount: number;
  /** 저장 시각 (ms) */
  at: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isSunSummary = (x: unknown): x is SunSummary =>
  isRecord(x) &&
  typeof x.name === 'string' &&
  typeof x.date === 'string' &&
  isNum(x.lat) &&
  isNum(x.lng) &&
  isNum(x.meetsPct) &&
  isNum(x.medianWindowMin) &&
  isNum(x.unitCount) &&
  isNum(x.at);

const isList = isArrayOf(isSunSummary);

/** 세대별 결과(주향 면 세대) → 요약 (세대가 없으면 null) */
export function summarize(
  units: readonly { windowTotal: number; meets: boolean }[],
): Pick<SunSummary, 'meetsPct' | 'medianWindowMin' | 'unitCount'> | null {
  const n = units.length;
  if (n === 0) return null;
  const ok = units.filter((u) => u.meets).length;
  const values = units.map((u) => u.windowTotal).sort((x, y) => x - y);
  const mid = n >> 1;
  const med = n % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
  return { meetsPct: Math.round((ok / n) * 100), medianWindowMin: Math.round(med), unitCount: n };
}

/** 같은 단지(400m 안)는 새 값으로 바꿔 맨 앞에, 최대 200개 */
export function upsertSummary(list: readonly SunSummary[], entry: SunSummary): SunSummary[] {
  return [entry, ...list.filter((s) => distanceM(s, entry) > SAME_COMPLEX_M)].slice(0, MAX_SUMMARIES);
}

/** 가장 가까운 요약 (400m 안) */
export function findSummary(list: readonly SunSummary[], at: LatLng): SunSummary | null {
  let best: SunSummary | null = null;
  let bestD = SAME_COMPLEX_M;
  for (const s of list) {
    const d = distanceM(s, at);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function readSunSummaries(): SunSummary[] {
  try {
    const r = parseStored(window.localStorage.getItem(SUN_SUMMARY_KEY), VERSION, isList);
    return r.ok ? r.value : [];
  } catch {
    return [];
  }
}

export function saveSunSummary(entry: SunSummary): void {
  try {
    window.localStorage.setItem(SUN_SUMMARY_KEY, serializeStored(upsertSummary(readSunSummaries(), entry), VERSION));
  } catch {
    /* 저장이 막힌 환경 — 필터에만 쓰는 부가 정보라 조용히 넘긴다 */
  }
}
