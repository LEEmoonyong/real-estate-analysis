// 층별 비교 (PLAN.md 단계 B2) — 같은 건물·면·라인(세로 한 줄)의 1층~최상층 일조
// React와 무관한 순수 함수. useFloorStats가 useMemo로 감싼다.
import type { UnitSet } from '../units/generateUnits';

/** 기준 종류: 09~15시 최대 연속 / 08~16시 총 */
export type FloorMetric = 'continuous' | 'total';

export interface FloorStat {
  floor: number;
  unitIndex: number;
  minutes: number;
  meets: boolean;
}

/** 세대 i와 같은 세로 줄(건물·면·라인)의 세대 인덱스를 층 오름차순으로 */
export function floorColumn(units: UnitSet, unitIndex: number): number[] {
  const bi = units.buildingIndex[unitIndex]!;
  const face = units.faceIndex[unitIndex]!;
  const line = units.lineIndex[unitIndex]!;
  const column: number[] = [];
  for (let i = units.buildingStart[bi]!; i < units.buildingStart[bi + 1]!; i++) {
    if (units.faceIndex[i] === face && units.lineIndex[i] === line) column.push(i);
  }
  return column.sort((a, b) => units.floor[a]! - units.floor[b]!);
}

/** 층별 값과 기준 충족 여부 */
export function floorStats(
  units: UnitSet,
  column: readonly number[],
  values: ArrayLike<number>,
  requiredMin: number,
): FloorStat[] {
  return column.map((i) => ({
    floor: units.floor[i]!,
    unitIndex: i,
    minutes: values[i]!,
    meets: values[i]! >= requiredMin,
  }));
}

/**
 * "N층부터 기준 충족"의 N — 그 층과 그 위 모든 층이 충족하는 가장 낮은 층.
 * 최상층도 충족하지 못하면 null. 중간에 미충족 층이 끼어 있으면 그 위부터 센다.
 */
export function firstMeetingFloor(stats: readonly FloorStat[]): number | null {
  let first: number | null = null;
  for (let k = stats.length - 1; k >= 0; k--) {
    if (!stats[k]!.meets) break;
    first = stats[k]!.floor;
  }
  return first;
}
