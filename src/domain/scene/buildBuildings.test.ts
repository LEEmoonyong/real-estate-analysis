import { describe, expect, it } from 'vitest';
import type { RawBuilding } from '../types';
import { buildBuildings, maxBuildingHeight, sceneRadius } from './buildBuildings';

const ORIGIN = { lat: 37.5, lng: 127 };
const dLat = 20 / 111_000;
const dLng = 20 / (111_000 * Math.cos((37.5 * Math.PI) / 180));

/** 원점 근처 약 20m 정사각형 건물 */
const raw = (id: string, patch: Partial<RawBuilding> = {}): RawBuilding => ({
  id,
  source: 'osm',
  footprint: [
    [127, 37.5],
    [127 + dLng, 37.5],
    [127 + dLng, 37.5 + dLat],
    [127, 37.5 + dLat],
  ],
  floors: 10,
  heightM: null,
  heightSource: 'floors',
  ...patch,
});

const NO_OVERRIDES = { floors: {}, dongs: {} };

describe('buildBuildings', () => {
  it('층수 × 층고로 높이를 정하고 외곽선을 로컬 좌표로 바꾼다', () => {
    const { buildings, dropped } = buildBuildings([raw('a')], ORIGIN, 2.9, NO_OVERRIDES);
    expect(dropped).toBe(0);
    const b = buildings[0]!;
    expect(b.heightM).toBeCloseTo(29);
    expect(b.areaM2).toBeCloseTo(400, -1);
    expect(b.ring).toBeInstanceOf(Float64Array);
    expect(b.isEstimated).toBe(false);
  });

  it('실측 높이가 있으면 우선한다', () => {
    const { buildings } = buildBuildings(
      [raw('a', { heightM: 92.5, heightSource: 'measured', floors: 30 })],
      ORIGIN,
      2.9,
      NO_OVERRIDES,
    );
    expect(buildings[0]!.heightM).toBe(92.5);
  });

  it('추정 높이는 isEstimated', () => {
    const { buildings } = buildBuildings([raw('a', { heightSource: 'default' })], ORIGIN, 2.9, NO_OVERRIDES);
    expect(buildings[0]!.isEstimated).toBe(true);
  });

  it('사용자 층수 보정이 실측 높이보다 우선하고 표시된다', () => {
    const { buildings } = buildBuildings(
      [raw('a', { heightM: 92.5, heightSource: 'measured', floors: 30 })],
      ORIGIN,
      3,
      { floors: { a: 20 }, dongs: {} },
    );
    expect(buildings[0]).toMatchObject({
      floors: 20,
      heightM: 60,
      heightSource: 'user',
      isUserCorrected: true,
      isEstimated: false,
      originalFloors: 30,
    });
  });

  it('원래 층수와 같은 보정값은 보정으로 보지 않는다', () => {
    const { buildings } = buildBuildings([raw('a')], ORIGIN, 2.9, { floors: { a: 10 }, dongs: {} });
    expect(buildings[0]!.isUserCorrected).toBe(false);
  });

  it('사용자 동 번호가 데이터 동 번호보다 우선한다', () => {
    const { buildings } = buildBuildings(
      [raw('a', { dongNumber: '101' }), raw('b', { dongNumber: '102' })],
      ORIGIN,
      2.9,
      {
        floors: {},
        dongs: { b: '205' },
      },
    );
    expect(buildings[0]).toMatchObject({ dongNumber: '101', dongSource: 'data' });
    expect(buildings[1]).toMatchObject({ dongNumber: '205', dongSource: 'user' });
  });

  it('잘못된 외곽선은 제외하고 개수를 보고한다', () => {
    const bad = raw('x', {
      footprint: [
        [127, 37.5],
        [127.00001, 37.5],
        [127, 37.50001],
      ],
    });
    const { buildings, dropped } = buildBuildings([raw('a'), bad], ORIGIN, 2.9, NO_OVERRIDES);
    expect(buildings).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it('장면 반경과 최고 높이', () => {
    const { buildings } = buildBuildings([raw('a'), raw('b', { floors: 25 })], ORIGIN, 2.9, NO_OVERRIDES);
    expect(sceneRadius(buildings)).toBeCloseTo(Math.hypot(20, 20), -1);
    expect(maxBuildingHeight(buildings)).toBeCloseTo(72.5);
  });
});
