// 참고 기준 판정 (PLAN.md 9.7)
// 기본: 동지 09~15시 연속 2시간 이상 또는 08~16시 총 4시간 이상 → 충족.
// 판례 등에서 자주 언급되는 기준을 참고로 보여 줄 뿐 법적 판단이 아니다.

import type { SunlightCriteria } from '../types';

export interface CriteriaEvaluation {
  meets: boolean;
  continuousOk: boolean;
  totalOk: boolean;
  /** 연속 조건까지 부족한 시간 [분] (충족이면 0) */
  continuousShortfallMin: number;
  /** 총량 조건까지 부족한 시간 [분] (충족이면 0) */
  totalShortfallMin: number;
}

export function evaluateCriteria(
  windowMaxContinuousMin: number,
  windowTotalMin: number,
  criteria: SunlightCriteria,
): CriteriaEvaluation {
  const continuousOk = windowMaxContinuousMin >= criteria.continuousRequiredMin;
  const totalOk = windowTotalMin >= criteria.totalRequiredMin;
  return {
    meets: continuousOk || totalOk,
    continuousOk,
    totalOk,
    continuousShortfallMin: Math.max(0, criteria.continuousRequiredMin - windowMaxContinuousMin),
    totalShortfallMin: Math.max(0, criteria.totalRequiredMin - windowTotalMin),
  };
}

/** 기준 값이 바뀌었는지 비교·캐시 키용 문자열 */
export function criteriaKey(c: SunlightCriteria): string {
  return [
    c.continuousStartMin,
    c.continuousEndMin,
    c.continuousRequiredMin,
    c.totalStartMin,
    c.totalEndMin,
    c.totalRequiredMin,
  ].join('-');
}
