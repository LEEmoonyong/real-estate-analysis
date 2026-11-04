import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ensureCcw } from '../geometry/polygon';
import { buildBuildings } from '../scene/buildBuildings';
import type { Building, LatLng, RawBuilding } from '../types';
import { generateUnits, unitAt } from './generateUnits';
import { parseDongHo, parseDongInput } from './parseDongHo';
import { buildDongIndex, lookupDongHo, lookupMessage, type LookupFailure } from './unitLookup';

describe('parseDongHo', () => {
  it.each([
    ['101동 1203호', '101', '1203'],
    ['101-1203', '101', '1203'],
    ['101 1203', '101', '1203'],
    ['  101동1203호 ', '101', '1203'],
    ['101동 - 1203', '101', '1203'],
    ['제101동 302호', '101', '302'],
    ['0101동 302호', '101', '302'],
    ['a동 302호', 'A', '302'],
    ['B-1501', 'B', '1501'],
    ['１０１동 １２０３호', '101', '1203'],
    ['101－1203', '101', '1203'],
  ])('%s → %s동 %s호', (input, dong, ho) => {
    expect(parseDongHo(input)).toEqual({ ok: true, dong, ho });
  });

  it('동만 입력하면 호는 null', () => {
    expect(parseDongHo('101동')).toEqual({ ok: true, dong: '101', ho: null });
    expect(parseDongHo('C동')).toEqual({ ok: true, dong: 'C', ho: null });
  });

  it.each(['1011203', '101동 12호', '101동 123456호', '가동 101호', '101호', '12345동 101호', '동 101호'])(
    '%s → 형식 오류',
    (input) => {
      expect(parseDongHo(input)).toEqual({ ok: false, reason: 'FORMAT' });
    },
  );

  it('빈 입력', () => {
    expect(parseDongHo('   ')).toEqual({ ok: false, reason: 'EMPTY' });
  });
});

describe('parseDongInput (동 번호 지정 검증)', () => {
  it('1~4자리 숫자 또는 영문 한 글자, "동"은 생략 가능', () => {
    expect(parseDongInput('101')).toBe('101');
    expect(parseDongInput('101동')).toBe('101');
    expect(parseDongInput(' 007 ')).toBe('7');
    expect(parseDongInput('b동')).toBe('B');
  });
  it('형식이 아니면 null', () => {
    for (const s of ['', '0', '12345', '1a', '가', '101호']) expect(parseDongInput(s)).toBeNull();
  });
});

function box(id: string, x0: number, floors: number, dong?: string, usage = 'apartments'): Building {
  // 동서 24m × 남북 12m → 남쪽 주향 면 4라인
  return {
    id,
    source: 'sample',
    ring: ensureCcw(new Float64Array([x0, -6, x0 + 24, -6, x0 + 24, 6, x0, 6])),
    areaM2: 288,
    floors,
    heightM: floors * 2.9,
    heightSource: 'floors',
    isEstimated: false,
    isUserCorrected: false,
    originalFloors: floors,
    originalHeightSource: 'floors',
    ...(dong ? { dongNumber: dong, dongSource: 'data' as const } : {}),
    usage,
    geometryRepaired: false,
  };
}

describe('lookupDongHo', () => {
  const buildings = [
    box('a', 0, 25, '101'),
    box('b', 100, 15, '101'), // 다른 단지의 101동 (15층)
    box('c', 200, 20, '102'),
    box('d', 300, 5, '103', 'commercial'),
  ];
  const units = generateUnits(buildings);
  const index = buildDongIndex(buildings);
  const run = (input: string, only?: number) => lookupDongHo(input, buildings, units, index, only);
  const fail = (input: string) => run(input) as LookupFailure;

  it('호수 → 해당 층·라인 세대', () => {
    const r = run('102동 1203호');
    expect(r).toMatchObject({ ok: true, buildingIndex: 2 });
    if (!r.ok || r.unitIndex === null) throw new Error('세대를 찾지 못함');
    const unit = unitAt(units, r.unitIndex, buildings);
    expect(unit).toMatchObject({ buildingId: 'c', floor: 12, hoNumber: '1203', isMainFace: true });
  });

  it('같은 동 번호가 둘이어도 호수가 성립하는 건물이 하나면 바로 찾는다', () => {
    expect(run('101동 2002호')).toMatchObject({ ok: true, buildingIndex: 0 }); // 20층은 a만 있음
  });

  it('둘 다 성립하면 후보를 돌려주고, 고르면 그 건물에서 찾는다', () => {
    expect(run('101동 1001호')).toMatchObject({ ok: false, reason: 'AMBIGUOUS', candidates: [0, 1] });
    expect(run('101동 1001호', 1)).toMatchObject({ ok: true, buildingIndex: 1 });
    expect(run('101동')).toMatchObject({ ok: false, reason: 'AMBIGUOUS', candidates: [0, 1] });
    expect(run('101동', 0)).toMatchObject({ ok: true, buildingIndex: 0, unitIndex: null });
  });

  it('동만 입력하면 건물 선택', () => {
    expect(run('102동')).toEqual({ ok: true, buildingIndex: 2, unitIndex: null, dong: '102', ho: null });
  });

  it('실패 메시지 4종 (형식·동 없음·층 초과·라인 없음)', () => {
    expect(lookupMessage(fail('101x'))).toBe('형식 예: 101동 1203호, 101-1203, 101 1203');
    expect(lookupMessage(fail('999동 101호'))).toBe(
      '999동이 지정된 건물이 없습니다 — 건물을 클릭해 동 번호를 지정하세요.',
    );
    // 후보가 여럿이면 가장 높은 건물 기준
    expect(lookupMessage(fail('101동 3001호'))).toBe('101동은 25층까지입니다.');
    expect(lookupMessage(fail('102동 1205호'))).toBe('5라인이 없습니다(1~4라인).');
    expect(fail('102동 001호')).toMatchObject({ reason: 'NO_FLOOR', floor: 0 });
  });

  it('주거 건물이 아니면 세대 없음', () => {
    expect(fail('103동 101호')).toMatchObject({ reason: 'NO_UNITS' });
  });
});

describe('lookupDongHo — 샘플 3곳', () => {
  const index = JSON.parse(readFileSync('public/samples/index.json', 'utf8')) as { file: string }[];
  const samples = index.map(
    (e) =>
      JSON.parse(readFileSync(`public/samples/${e.file}`, 'utf8')) as {
        id: string;
        center: LatLng;
        buildings: RawBuilding[];
      },
  );

  it.each(samples.map((s) => [s.id, s] as const))('%s: 동 번호가 있는 모든 아파트를 최상층 1호로 찾는다', (_id, s) => {
    const { buildings } = buildBuildings(s.buildings, s.center, 2.9, { floors: {}, dongs: {} });
    const units = generateUnits(buildings);
    const dongIndex = buildDongIndex(buildings);
    let checked = 0;
    buildings.forEach((b, bi) => {
      if (!b.dongNumber || units.mainLineCount[bi] === 0) return;
      const ho = String(b.floors * (units.mainLineCount[bi]! >= 100 ? 1000 : 100) + 1);
      const first = lookupDongHo(`${b.dongNumber}동 ${ho}호`, buildings, units, dongIndex);
      // 같은 동 번호가 여러 단지에 있으면 후보 목록에 들어 있어야 하고, 고르면 찾아진다
      if (!first.ok) {
        expect(first).toMatchObject({ reason: 'AMBIGUOUS' });
        expect((first as { candidates: number[] }).candidates).toContain(bi);
      }
      const r = lookupDongHo(`${b.dongNumber}동 ${ho}호`, buildings, units, dongIndex, bi);
      expect(r).toMatchObject({ ok: true, buildingIndex: bi });
      checked++;
    });
    expect(checked).toBeGreaterThan(20);
  });
});
