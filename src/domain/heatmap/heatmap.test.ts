import { describe, expect, it } from 'vitest';
import { ensureCcw } from '../geometry/polygon';
import type { Building } from '../types';
import { findUnitIndex, generateUnits, nearestUnitOnBuilding, unitAt } from '../units/generateUnits';
import { relativeLuminance, SUNLIGHT_STOPS, hexToRgb, sunlightColor } from './colorScale';
import { patchMatrices, PATCH_EXTRA_OFFSET_M } from './patches';

function box(id: string, x0: number, z0: number, x1: number, z1: number, floors: number): Building {
  return {
    id,
    source: 'sample',
    ring: ensureCcw(new Float64Array([x0, z0, x1, z0, x1, z1, x0, z1])),
    areaM2: (x1 - x0) * (z1 - z0),
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

describe('sunlightColor', () => {
  it('끝점: 0시간 = 첫 색, 8시간 이상 = 마지막 색', () => {
    expect(sunlightColor(0)).toEqual(hexToRgb(SUNLIGHT_STOPS[0]!));
    expect(sunlightColor(480)).toEqual(hexToRgb(SUNLIGHT_STOPS.at(-1)!));
    expect(sunlightColor(900)).toEqual(hexToRgb(SUNLIGHT_STOPS.at(-1)!));
    expect(sunlightColor(-10)).toEqual(hexToRgb(SUNLIGHT_STOPS[0]!));
  });

  it('정시 값은 해당 단계 색 (4시간 = 5번째)', () => {
    expect(sunlightColor(240)).toEqual(hexToRgb(SUNLIGHT_STOPS[4]!));
  });

  it('밝기가 시간에 따라 단조 증가 (색각 이상·흑백에서도 순서 구분)', () => {
    let prev = -1;
    for (let m = 0; m <= 480; m += 10) {
      const l = relativeLuminance(sunlightColor(m));
      expect(l).toBeGreaterThan(prev);
      prev = l;
    }
  });
});

describe('patchMatrices', () => {
  const slab = box('A', -24, -6, 24, 6, 15);
  const units = generateUnits([slab]);
  const m = patchMatrices(units);

  it('위치는 세대 점에서 법선 방향으로 0.1m 더 바깥', () => {
    for (const i of [0, 37, units.count - 1]) {
      const nx = units.normals[i * 2]!;
      const nz = units.normals[i * 2 + 1]!;
      expect(m[i * 16 + 12]).toBeCloseTo(units.positions[i * 3]! + nx * PATCH_EXTRA_OFFSET_M, 5);
      expect(m[i * 16 + 14]).toBeCloseTo(units.positions[i * 3 + 2]! + nz * PATCH_EXTRA_OFFSET_M, 5);
    }
  });

  it('패치의 +z 축이 세대 법선, 크기는 라인 폭 × 0.8 · 층고 × 0.6', () => {
    for (let i = 0; i < units.count; i += 13) {
      expect(m[i * 16 + 8]).toBeCloseTo(units.normals[i * 2]!, 6);
      expect(m[i * 16 + 10]).toBeCloseTo(units.normals[i * 2 + 1]!, 6);
      const width = Math.hypot(m[i * 16]!, m[i * 16 + 2]!);
      expect(width).toBeCloseTo(6 * 0.8, 4);
      expect(m[i * 16 + 5]).toBeCloseTo(2.9 * 0.6, 4);
    }
  });
});

describe('세대 찾기', () => {
  const a = box('osm:way/1', -24, -6, 24, 6, 15);
  const b = box('osm:way/2', -24, 30, 24, 42, 10);
  const units = generateUnits([a, b]);

  it('건물별 세대 범위가 연속이다', () => {
    expect(units.buildingStart[0]).toBe(0);
    expect(units.buildingStart[2]).toBe(units.count);
    for (let i = units.buildingStart[1]!; i < units.count; i++) expect(units.buildingIndex[i]).toBe(1);
  });

  it('id → 인덱스 왕복 (건물 id에 콜론이 있어도)', () => {
    for (const i of [0, 100, units.count - 1]) {
      const id = unitAt(units, i, [a, b]).id;
      expect(findUnitIndex(units, [a, b], id)).toBe(i);
    }
    expect(findUnitIndex(units, [a, b], 'osm:way/9:0:0:1')).toBe(-1);
  });

  it('벽 위 클릭 지점에서 가장 가까운 세대 (남쪽 벽 5층, 서쪽 끝)', () => {
    const y = 4 * 2.9 + 1.0;
    const i = nearestUnitOnBuilding(units, 0, [-21, y, 6], a.heightM);
    const u = unitAt(units, i, [a, b]);
    expect(u.floor).toBe(5);
    expect(u.hoNumber).toBe('501');
  });

  it('지붕 클릭은 세대 없음', () => {
    expect(nearestUnitOnBuilding(units, 0, [0, a.heightM, 0], a.heightM)).toBe(-1);
  });
});
