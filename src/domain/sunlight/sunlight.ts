// 일조 시간 집계 (PLAN.md 9.6) — 가시성 마스크 → 세대별 총·연속 일조 시간과 기준 충족 여부
//
// 칸 하나가 일조면 그 칸 전체(Δ분)를 일조로 친다(중점 규칙, 경계마다 오차 ±Δ/2).
// 기준 구간에는 중점이 구간 [시작, 끝) 안에 있는 칸만 넣는다.

import type { SunlightCriteria } from '../types';
import { evaluateCriteria } from './criteria';

export interface SunlightStats {
  /** 하루 전체 일조 [분] */
  totalMinutes: Uint16Array;
  /** 총량 기준 구간(예: 08~16시) 일조 [분] */
  windowTotalMinutes: Uint16Array;
  /** 연속 기준 구간(예: 09~15시) 최대 연속 일조 [분] */
  windowMaxContinuous: Uint16Array;
  /** 기준 충족이면 1 */
  meets: Uint8Array;
}

/** 부록 A의 SunlightResult — 세대 배열과 같은 인덱스 순서 */
export interface SunlightResult extends SunlightStats {
  date: string;
  stepMinutes: number;
  startMinute: number;
  steps: number;
  /** U × steps */
  mask: Uint8Array;
}

/** 칸 k의 중점이 [start, end) 안이면 포함 */
function windowRange(startMinute: number, stepMinutes: number, K: number, start: number, end: number) {
  let k0 = K;
  let k1 = -1;
  for (let k = 0; k < K; k++) {
    const mid = startMinute + (k + 0.5) * stepMinutes;
    if (mid >= start && mid < end) {
      if (k < k0) k0 = k;
      k1 = k;
    }
  }
  return { k0, k1 };
}

/**
 * 마스크(행 = 세대, U × K) → 세대별 통계.
 * @param unitCount 마스크에 담긴 세대 수
 */
export function aggregateSunlight(
  mask: Uint8Array,
  unitCount: number,
  K: number,
  startMinute: number,
  stepMinutes: number,
  criteria: SunlightCriteria,
): SunlightStats {
  const totalMinutes = new Uint16Array(unitCount);
  const windowTotalMinutes = new Uint16Array(unitCount);
  const windowMaxContinuous = new Uint16Array(unitCount);
  const meets = new Uint8Array(unitCount);
  const tw = windowRange(startMinute, stepMinutes, K, criteria.totalStartMin, criteria.totalEndMin);
  const cw = windowRange(startMinute, stepMinutes, K, criteria.continuousStartMin, criteria.continuousEndMin);

  for (let u = 0; u < unitCount; u++) {
    const row = u * K;
    let total = 0;
    let windowTotal = 0;
    let run = 0;
    let best = 0;
    for (let k = 0; k < K; k++) {
      const v = mask[row + k]!;
      total += v;
      if (k >= tw.k0 && k <= tw.k1) windowTotal += v;
      if (k >= cw.k0 && k <= cw.k1) {
        run = v ? run + 1 : 0;
        if (run > best) best = run;
      }
    }
    totalMinutes[u] = total * stepMinutes;
    windowTotalMinutes[u] = windowTotal * stepMinutes;
    windowMaxContinuous[u] = best * stepMinutes;
    meets[u] = evaluateCriteria(best * stepMinutes, windowTotal * stepMinutes, criteria).meets ? 1 : 0;
  }
  return { totalMinutes, windowTotalMinutes, windowMaxContinuous, meets };
}
