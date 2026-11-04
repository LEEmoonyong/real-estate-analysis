import { describe, expect, it } from 'vitest';
import { ensureCcw } from '../geometry/polygon';
import type { Building } from '../types';
import { generateUnits } from '../units/generateUnits';
import { firstMeetingFloor, floorColumn, floorStats, type FloorStat } from './floorStats';

function box(id: string, floors: number): Building {
  return {
    id,
    source: 'sample',
    ring: ensureCcw(new Float64Array([0, -6, 24, -6, 24, 6, 0, 6])),
    areaM2: 288,
    floors,
    heightM: floors * 2.9,
    heightSource: 'floors',
    isEstimated: false,
    isUserCorrected: false,
    originalFloors: floors,
    originalHeightSource: 'floors',
    usage: 'apartments',
    geometryRepaired: false,
  };
}

describe('floorColumn', () => {
  const units = generateUnits([box('a', 10), box('b', 7)]);

  it('같은 건물·면·라인의 1층~최상층', () => {
    // 두 번째 건물의 어떤 세대
    const i = units.buildingStart[1]! + 5;
    const col = floorColumn(units, i);
    expect(col.map((k) => units.floor[k])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const k of col) {
      expect(units.buildingIndex[k]).toBe(1);
      expect(units.faceIndex[k]).toBe(units.faceIndex[i]);
      expect(units.lineIndex[k]).toBe(units.lineIndex[i]);
    }
    expect(col).toContain(i);
  });
});

describe('firstMeetingFloor', () => {
  const stats = (meets: boolean[]): FloorStat[] =>
    meets.map((m, k) => ({ floor: k + 1, unitIndex: k, minutes: 0, meets: m }));

  it('위층부터 연속으로 충족하는 가장 낮은 층', () => {
    expect(firstMeetingFloor(stats([false, false, true, true, true]))).toBe(3);
    expect(firstMeetingFloor(stats([true, true, true]))).toBe(1);
  });
  it('중간에 미충족 층이 있으면 그 위부터', () => {
    expect(firstMeetingFloor(stats([true, false, true, true]))).toBe(3);
  });
  it('최상층도 미충족이면 null', () => {
    expect(firstMeetingFloor(stats([true, true, false]))).toBeNull();
    expect(firstMeetingFloor([])).toBeNull();
  });

  it('floorStats: 기준값 이상이면 충족', () => {
    const units = generateUnits([box('a', 3)]);
    const col = floorColumn(units, 0);
    const values = new Uint16Array(units.count);
    col.forEach((k, n) => (values[k] = [100, 120, 200][n]!));
    expect(floorStats(units, col, values, 120).map((s) => [s.floor, s.minutes, s.meets])).toEqual([
      [1, 100, false],
      [2, 120, true],
      [3, 200, true],
    ]);
  });
});
