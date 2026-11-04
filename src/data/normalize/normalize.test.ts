import { describe, expect, it } from 'vitest';
import { approxAreaM2, cleanLngLatRing, extractDongNumber, parsePositive, resolveHeight } from './common';
import { normalizeOsm, type OverpassElement } from './osm';

// 위도 37.5°에서 약 20m × 20m 정사각형
const dLat = 20 / 111_320;
const dLng = 20 / (111_320 * Math.cos((37.5 * Math.PI) / 180));
const square = (lng = 127, lat = 37.5): [number, number][] => [
  [lng, lat],
  [lng + dLng, lat],
  [lng + dLng, lat + dLat],
  [lng, lat + dLat],
  [lng, lat], // 닫힘 정점
];

describe('cleanLngLatRing', () => {
  it('닫힘 정점과 연속 중복 정점을 제거한다', () => {
    const ring = square();
    const withDup = [ring[0]!, ring[0]!, ...ring.slice(1)];
    expect(cleanLngLatRing(withDup)).toHaveLength(4);
  });

  it('정점이 3개 미만이거나 숫자가 아니면 null', () => {
    expect(cleanLngLatRing([[127, 37.5], [127.001, 37.5], [127, 37.5]])).toBeNull();
    expect(cleanLngLatRing([[NaN, 37.5], [127.001, 37.5], [127, 37.501]])).toBeNull();
  });
});

describe('approxAreaM2', () => {
  it('20m 정사각형은 약 400m²', () => {
    expect(approxAreaM2(cleanLngLatRing(square())!)).toBeCloseTo(400, -1);
  });
});

describe('parsePositive', () => {
  it.each([
    ['45', 45],
    ['45 m', 45],
    ['18.4', 18.4],
    [12, 12],
  ])('%o → %o', (input, expected) => expect(parsePositive(input)).toBe(expected));

  it.each(['', '0', '-3', 'ten', '45 ft', undefined, null])('%o → null', (input) =>
    expect(parsePositive(input)).toBeNull(),
  );
});

describe('extractDongNumber', () => {
  it.each([
    ['101동', '101'],
    ['101', '101'],
    ['제101동', '101'],
    ['  205 동 ', '205'],
    ['A동', 'A'],
    ['b', 'B'],
  ])('%o → %o', (input, expected) => expect(extractDongNumber(input)).toBe(expected));

  // V-World·OSM 실측에 나온 비숫자 동 이름
  it.each(['주동3', '상가동', '부속건축물제1동', '마린시티자이', 'Tower1', '씨동', '', undefined])('%o → null', (input) =>
    expect(extractDongNumber(input)).toBeNull(),
  );
});

describe('resolveHeight', () => {
  it('실측 높이가 있으면 measured', () => {
    expect(resolveHeight(30, 92.5, 2000)).toEqual({ floors: 30, heightM: 92.5, heightSource: 'measured' });
  });
  it('층수만 있으면 floors', () => {
    expect(resolveHeight(25, null, 800)).toEqual({ floors: 25, heightM: null, heightSource: 'floors' });
  });
  it('둘 다 없으면 작은 부속 건물은 1층, 나머지는 기본값', () => {
    expect(resolveHeight(null, null, 20)).toMatchObject({ floors: 1, heightSource: 'default' });
    expect(resolveHeight(null, null, 300)).toMatchObject({ floors: 5, heightSource: 'default' });
    expect(resolveHeight(null, null, 900, 26)).toMatchObject({ floors: 26, heightSource: 'default' });
  });
});

describe('normalizeOsm', () => {
  const way = (id: number, tags: Record<string, string>): OverpassElement => ({
    type: 'way',
    id,
    tags,
    geometry: square().map(([lon, lat]) => ({ lat, lon })),
  });

  it('태그를 RawBuilding으로 변환하고 동 번호를 추출한다', () => {
    const { buildings, report } = normalizeOsm([
      way(1, { building: 'apartments', 'building:levels': '25', name: '101' }),
      way(2, { building: 'apartments', height: '45 m', name: 'Tower1' }),
    ]);
    expect(report).toMatchObject({ total: 2, kept: 2 });
    expect(buildings[0]).toMatchObject({
      id: 'osm:way/1',
      source: 'osm',
      floors: 25,
      heightSource: 'floors',
      dongNumber: '101',
      usage: 'apartments',
    });
    expect(buildings[0]!.footprint).toHaveLength(4);
    expect(buildings[1]).toMatchObject({ heightM: 45, heightSource: 'measured' });
    expect(buildings[1]!.dongNumber).toBeUndefined();
  });

  it('층수 없는 아파트는 지정한 대체 층수를 쓴다', () => {
    const { buildings } = normalizeOsm([way(1, { building: 'apartments' })], { apartmentFallbackFloors: 26 });
    expect(buildings[0]).toMatchObject({ floors: 26, heightSource: 'default' });
  });

  it('지붕·공사 중 건물과 잘못된 지오메트리는 제외하고 보고한다', () => {
    const broken: OverpassElement = { type: 'way', id: 9, tags: { building: 'yes' }, geometry: [] };
    const { buildings, report } = normalizeOsm([
      way(1, { building: 'roof' }),
      way(2, { building: 'construction' }),
      broken,
      { type: 'way', id: 3, tags: {}, geometry: [] },
    ]);
    expect(buildings).toHaveLength(0);
    expect(report).toMatchObject({ skippedExcludedType: 3, skippedInvalidGeometry: 1 });
  });

  it('multipolygon relation은 outer 멤버를 쓴다', () => {
    const rel: OverpassElement = {
      type: 'relation',
      id: 7,
      tags: { building: 'yes', 'building:levels': '3' },
      members: [{ type: 'way', role: 'outer', geometry: square().map(([lon, lat]) => ({ lat, lon })) }],
    };
    expect(normalizeOsm([rel]).buildings[0]).toMatchObject({ id: 'osm:relation/7', floors: 3 });
  });
});
