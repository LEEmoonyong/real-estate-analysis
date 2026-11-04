import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA } from '../../config/constants';
import { createPrism, prismsFromBuildings } from '../geometry/prism';
import { buildBuildings } from '../scene/buildBuildings';
import { createRayCaster } from '../spatial/rayCast';
import { buildUniformGrid } from '../spatial/uniformGrid';
import type { LatLng, RawBuilding } from '../types';
import { generateUnits } from '../units/generateUnits';
import { criteriaKey, evaluateCriteria } from './criteria';
import { aggregateSunlight } from './sunlight';
import { computeSunSteps } from './sunSteps';
import { fillVisibilityMask } from './visibility';

const C = { ...DEFAULT_CRITERIA };

/** 07:00부터 10분 칸으로 만든 마스크 한 줄 */
function maskFrom(bits: string) {
  return Uint8Array.from(bits.replace(/\s/g, ''), (c) => (c === '1' ? 1 : 0));
}

describe('aggregateSunlight — 수작업 마스크', () => {
  // 07:00 시작, 10분 칸 60개 (07:00~17:00)
  const start = 7 * 60;

  it('하루 총 일조와 구간 총 일조', () => {
    // 07:00~08:00 6칸 일조, 12:00~13:00 6칸 일조
    const bits = '111111' + '0'.repeat(24) + '111111' + '0'.repeat(24);
    const s = aggregateSunlight(maskFrom(bits), 1, 60, start, 10, C);
    expect(s.totalMinutes[0]).toBe(120);
    expect(s.windowTotalMinutes[0]).toBe(60); // 07~08시는 08~16시 구간 밖
    expect(s.windowMaxContinuous[0]).toBe(60);
  });

  it('연속 일조는 09~15시 안에서만 센다 (구간 경계에서 끊김)', () => {
    // 08:00~10:00 일조 12칸 → 09~15시 안에서는 09:00~10:00만 연속 60분
    const bits = '0'.repeat(6) + '1'.repeat(12) + '0'.repeat(42);
    const s = aggregateSunlight(maskFrom(bits), 1, 60, start, 10, C);
    expect(s.windowMaxContinuous[0]).toBe(60);
    expect(s.windowTotalMinutes[0]).toBe(120);
  });

  it('여러 구간 중 가장 긴 연속', () => {
    // 09:00~09:30(3칸), 10:00~11:40(10칸), 13:00~13:20(2칸)
    const bits = '0'.repeat(12) + '111000' + '1'.repeat(10) + '0'.repeat(8) + '11' + '0'.repeat(22);
    const s = aggregateSunlight(maskFrom(bits), 1, 60, start, 10, C);
    expect(s.windowMaxContinuous[0]).toBe(100);
    expect(s.totalMinutes[0]).toBe(150);
  });

  it('행 = 세대: 여러 세대를 독립적으로 집계', () => {
    const a = '1'.repeat(60);
    const b = '0'.repeat(60);
    const s = aggregateSunlight(maskFrom(a + b), 2, 60, start, 10, C);
    expect(Array.from(s.totalMinutes)).toEqual([600, 0]);
    expect(Array.from(s.meets)).toEqual([1, 0]);
  });

  it('칸 경계를 시계에 맞추면 중점 규칙으로 구간이 정확히 나뉜다 (Δ = 15분)', () => {
    // 07:00 시작 15분 칸 40개, 전부 일조 → 08~16시 = 32칸 = 480분, 09~15시 연속 = 24칸 = 360분
    const s = aggregateSunlight(new Uint8Array(40).fill(1), 1, 40, start, 15, C);
    expect(s.windowTotalMinutes[0]).toBe(480);
    expect(s.windowMaxContinuous[0]).toBe(360);
  });
});

describe('evaluateCriteria — 경계값', () => {
  it.each([
    [119, 0, false],
    [120, 0, true],
    [0, 239, false],
    [0, 240, true],
    [119, 239, false],
  ])('연속 %d분, 총 %d분 → 충족 %s', (cont, total, meets) => {
    expect(evaluateCriteria(cont, total, C).meets).toBe(meets);
  });

  it('부족한 시간', () => {
    const e = evaluateCriteria(90, 200, C);
    expect(e.continuousShortfallMin).toBe(30);
    expect(e.totalShortfallMin).toBe(40);
    expect(evaluateCriteria(150, 300, C).continuousShortfallMin).toBe(0);
  });

  it('criteriaKey는 값이 같으면 같다', () => {
    expect(criteriaKey({ ...C })).toBe(criteriaKey(DEFAULT_CRITERIA));
    expect(criteriaKey({ ...C, totalRequiredMin: 180 })).not.toBe(criteriaKey(C));
  });
});

describe('computeSunSteps', () => {
  const seoul = { lat: 37.5665, lng: 126.978 };

  it('칸은 시계 격자에 맞고 일출~일몰을 덮는다', () => {
    const s = computeSunSteps(seoul.lat, seoul.lng, '2026-12-22', 10);
    expect(s.startMinute % 10).toBe(0);
    expect(s.startMinute).toBeLessThanOrEqual(7 * 60 + 47);
    expect(s.startMinute + s.count * 10).toBeGreaterThanOrEqual(17 * 60 + 17);
    expect(s.directions.length).toBe(s.count * 3);
  });

  it('해가 진 칸은 방향 0, 뜬 칸은 단위 벡터', () => {
    const s = computeSunSteps(seoul.lat, seoul.lng, '2026-06-21', 10);
    for (let k = 0; k < s.count; k++) {
      const len = Math.hypot(s.directions[k * 3]!, s.directions[k * 3 + 1]!, s.directions[k * 3 + 2]!);
      expect(len === 0 || Math.abs(len - 1) < 1e-6).toBe(true);
    }
  });
});

describe('fillVisibilityMask — 해석적 상황', () => {
  const seoul = { lat: 37.5665, lng: 126.978 };
  const steps = computeSunSteps(seoul.lat, seoul.lng, '2026-12-22', 10);

  it('빈 들판의 남향 창은 동지에 해가 떠 있는 내내 일조', () => {
    const caster = createRayCaster(buildUniformGrid([]));
    const units = { positions: new Float32Array([0, 1.2, 0]), normals: new Float32Array([0, 1]) };
    const mask = new Uint8Array(steps.count);
    fillVisibilityMask(units, 0, 1, steps, caster, mask);
    let up = 0;
    for (let k = 0; k < steps.count; k++) if (steps.directions[k * 3 + 1]! > 0) up++;
    expect(mask.reduce((a, b) => a + b, 0)).toBe(up);
  });

  it('북향 창은 동지에 직사광이 없다', () => {
    const caster = createRayCaster(buildUniformGrid([]));
    const units = { positions: new Float32Array([0, 1.2, 0]), normals: new Float32Array([0, -1]) };
    const mask = new Uint8Array(steps.count);
    fillVisibilityMask(units, 0, 1, steps, caster, mask);
    expect(mask.every((v) => v === 0)).toBe(true);
  });

  it('남쪽 바로 앞 고층 건물에 막히면 일조가 크게 줄어든다', () => {
    // 창 남쪽 20m에 폭 200m·높이 60m 건물 → 동지 남중 고도 29°에서 tan29°·20 ≈ 11m < 60m → 한낮 내내 막힘
    const wall = createPrism(new Float64Array([-100, 20, 100, 20, 100, 30, -100, 30]), 60);
    const caster = createRayCaster(buildUniformGrid([wall]));
    const units = { positions: new Float32Array([0, 1.2, 0]), normals: new Float32Array([0, 1]) };
    const mask = new Uint8Array(steps.count);
    fillVisibilityMask(units, 0, 1, steps, caster, mask);
    const s = aggregateSunlight(mask, 1, steps.count, steps.startMinute, 10, C);
    expect(s.windowTotalMinutes[0]).toBe(0);
    expect(s.meets[0]).toBe(0);
  });
});

describe('샘플링 간격 Δ = 5/10/15분 비교 (실제 샘플)', () => {
  const sample = JSON.parse(readFileSync('public/samples/sejong-hansol.json', 'utf8')) as {
    center: LatLng;
    buildings: RawBuilding[];
  };
  const { buildings } = buildBuildings(sample.buildings, sample.center, 2.9, { floors: {}, dongs: {} });
  const units = generateUnits(buildings);
  const caster = createRayCaster(buildUniformGrid(prismsFromBuildings(buildings)));

  function totals(step: number) {
    const steps = computeSunSteps(sample.center.lat, sample.center.lng, '2026-12-22', step);
    const mask = new Uint8Array(units.count * steps.count);
    fillVisibilityMask(units, 0, units.count, steps, caster, mask);
    return aggregateSunlight(mask, units.count, steps.count, steps.startMinute, step, C).totalMinutes;
  }

  it('Δ=10·15분 결과가 Δ=5분 대비 세대 중앙값 오차 ±Δ 안', () => {
    const t5 = totals(5);
    for (const step of [10, 15]) {
      const t = totals(step);
      const diffs = Array.from(t, (v, i) => Math.abs(v - t5[i]!)).sort((a, b) => a - b);
      const median = diffs[Math.floor(diffs.length / 2)]!;
      const p90 = diffs[Math.floor(diffs.length * 0.9)]!;
      expect(median).toBeLessThanOrEqual(step);
      expect(p90).toBeLessThanOrEqual(step * 2);
    }
  });
});
