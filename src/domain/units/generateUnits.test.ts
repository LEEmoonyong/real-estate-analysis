import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ensureCcw, pointInPolygon } from '../geometry/polygon';
import { buildBuildings } from '../scene/buildBuildings';
import type { Building, LatLng, RawBuilding } from '../types';
import { formatHo, parseHo } from './hoNumber';
import { generateUnits, normalAzimuthDeg, unitAt } from './generateUnits';

/** 축 정렬 직사각형 건물 (x ∈ [x0, x1], z ∈ [z0, z1]) */
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
    dongSource: 'data',
    name: id,
    usage: 'apartments',
    geometryRepaired: false,
  } as Building;
}

describe('generateUnits — 판상형 동', () => {
  // 동서 48m × 남북 12m, 15층 → 남·북 면 8라인, 동·서 면 2라인
  const slab = box('A', -24, -6, 24, 6, 15);
  const set = generateUnits([slab]);

  it('세대 수 = (8 + 8 + 2 + 2) 라인 × 15층', () => {
    expect(set.count).toBe(20 * 15);
  });

  it('1층 창 높이 1.2m, 15층은 14 × 2.9 + 1.2', () => {
    const ys = new Set<number>();
    for (let i = 0; i < set.count; i++) ys.add(Math.round(set.positions[i * 3 + 1]! * 1000) / 1000);
    expect(Math.min(...ys)).toBeCloseTo(1.2, 5);
    expect(Math.max(...ys)).toBeCloseTo(14 * 2.9 + 1.2, 4);
  });

  it('모든 법선은 바깥을 향한다 (점 + 법선 1m가 외곽선 밖)', () => {
    for (let i = 0; i < set.count; i++) {
      const x = set.positions[i * 3]! + set.normals[i * 2]!;
      const z = set.positions[i * 3 + 2]! + set.normals[i * 2 + 1]!;
      expect(pointInPolygon(x, z, slab.ring)).toBe(false);
      // 법선 반대쪽 1m는 건물 안
      const xi = set.positions[i * 3]! - set.normals[i * 2]!;
      const zi = set.positions[i * 3 + 2]! - set.normals[i * 2 + 1]!;
      expect(pointInPolygon(xi, zi, slab.ring)).toBe(true);
    }
  });

  it('주향 면은 남쪽 긴 면 (법선 +z)', () => {
    for (let i = 0; i < set.count; i++) {
      if (set.isMainFace[i]) expect(set.normals[i * 2 + 1]).toBeCloseTo(1, 6);
    }
    expect(set.mainLineCount[0]).toBe(8);
  });

  it('호수: 남쪽에서 볼 때 왼쪽(서쪽)부터 1라인 → 12층 서쪽 끝은 1201호, 동쪽 끝은 1208호', () => {
    const units = Array.from({ length: set.count }, (_, i) => unitAt(set, i, [slab]));
    const floor12 = units.filter((u) => u.floor === 12 && u.isMainFace).sort((a, b) => a.position[0] - b.position[0]);
    expect(floor12.map((u) => u.hoNumber)).toEqual(['1201', '1202', '1203', '1204', '1205', '1206', '1207', '1208']);
    expect(units.filter((u) => !u.isMainFace).every((u) => u.hoNumber === undefined)).toBe(true);
  });

  it('창 방위: 남쪽 면 180°, 북쪽 면 0°', () => {
    const azimuths = new Set<number>();
    for (let i = 0; i < set.count; i++) {
      azimuths.add(Math.round(normalAzimuthDeg(set.normals[i * 2]!, set.normals[i * 2 + 1]!)));
    }
    expect([...azimuths].sort((a, b) => a - b)).toEqual([0, 90, 180, 270]);
  });

  it('세대 id 형식', () => {
    expect(unitAt(set, 0, [slab]).id).toMatch(/^A:\d+:\d+:\d+$/);
  });
});

describe('generateUnits — 탑상형·짧은 변', () => {
  it('45° 돌린 정사각형 탑상형은 남동·남서 두 면이 주향 면이고 서쪽부터 이어서 번호', () => {
    const h = 15 / Math.SQRT2;
    const ring = ensureCcw(new Float64Array([0, -2 * h, 2 * h, 0, 0, 2 * h, -2 * h, 0]));
    const tower = { ...box('T', 0, 0, 1, 1, 30), ring };
    const set = generateUnits([tower]);
    const units = Array.from({ length: set.count }, (_, i) => unitAt(set, i, [tower]));
    const main = units.filter((u) => u.isMainFace && u.floor === 1).sort((a, b) => a.position[0] - b.position[0]);
    // 한 변 30m → 면마다 5라인, 두 면 합쳐 10라인
    expect(main.map((u) => u.hoNumber)).toEqual(['101', '102', '103', '104', '105', '106', '107', '108', '109', '110']);
    expect(main.every((u) => u.position[2] > 0)).toBe(true); // 모두 남쪽
  });

  it('상가·학교 등 비주거 건물에는 세대를 두지 않는다 (장애물로만 사용)', () => {
    const shop = { ...box('C', 0, 0, 30, 30, 3), usage: 'commercial' };
    expect(generateUnits([shop]).count).toBe(0);
    expect(generateUnits([{ ...shop, usage: undefined }]).count).toBeGreaterThan(0);
  });

  it('4m 미만 변에는 세대를 두지 않는다', () => {
    const tiny = box('S', 0, 0, 3, 3, 2);
    expect(generateUnits([tiny]).count).toBe(0);
  });
});

describe('호수 생성·역매핑', () => {
  it.each([
    [12, 3, 8, '1203'],
    [1, 1, 4, '101'],
    [35, 12, 12, '3512'],
    [7, 105, 120, '7105'],
  ])('%d층 %d라인 (라인 %d개) ↔ %s호', (floor, line, count, ho) => {
    expect(formatHo(floor, line, count)).toBe(ho);
    expect(parseHo(ho, count)).toEqual({ floor, line });
  });

  it('범위를 벗어난 호수는 null', () => {
    expect(parseHo('1209', 8)).toBeNull(); // 9라인 없음
    expect(parseHo('0001', 8)).toBeNull();
    expect(parseHo('12a3', 8)).toBeNull();
  });
});

describe('실제 샘플 단지 세대 규모', () => {
  const index = JSON.parse(readFileSync('public/samples/index.json', 'utf8')) as { file: string }[];
  const samples = index.map(
    (e) =>
      JSON.parse(readFileSync(`public/samples/${e.file}`, 'utf8')) as {
        id: string;
        center: LatLng;
        buildings: RawBuilding[];
      },
  );

  // 잠실 샘플은 400m 안에 대단지 3곳(초고층 포함)이라 PLAN 가정(1만)보다 크다 → 성능 목표의 상한 규모로 확인
  it.each(samples.map((s) => [s.id, s] as const))('%s: 세대 6만 개 이하, 주향 면이 있다', (_id, s) => {
    const { buildings } = buildBuildings(s.buildings, s.center, 2.9, { floors: {}, dongs: {} });
    const set = generateUnits(buildings);
    expect(set.count).toBeGreaterThan(1000);
    expect(set.count).toBeLessThanOrEqual(60_000);
    expect(set.isMainFace.some((v) => v === 1)).toBe(true);
  });
});
