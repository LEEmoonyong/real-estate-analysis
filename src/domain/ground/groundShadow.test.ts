import { describe, expect, it } from 'vitest';
import { createPrism } from '../geometry/prism';
import { sunDirection } from '../solar/solarPosition';
import { createRayCaster } from '../spatial/rayCast';
import { buildUniformGrid } from '../spatial/uniformGrid';
import { computeSunSteps } from '../sunlight/sunSteps';
import {
  buildingCellMask,
  cellCenter,
  cellIndexAt,
  fillGroundShadow,
  groundGridFor,
  sliceStepDirections,
} from './groundShadow';

/** 원점 중심 한 변 20m, 높이 H인 정육면체형 건물 */
function cube(h: number) {
  return createPrism(new Float64Array([-10, -10, 10, -10, 10, 10, -10, 10]), h);
}

describe('groundGridFor', () => {
  it('장면 반경 + 여유를 덮는 정사각 격자', () => {
    const g = groundGridFor(100, 4);
    expect(g.cols).toBe(55); // (100 + 10) × 2 / 4
    expect(g.originX).toBe(-110);
    expect(cellIndexAt(g, ...cellCenter(g, 1234))).toBe(1234);
    expect(cellIndexAt(g, 500, 0)).toBe(-1);
  });
  it('셀 수가 상한을 넘으면 셀을 키운다', () => {
    const g = groundGridFor(2000, 2);
    expect(g.cols * g.rows).toBeLessThanOrEqual(250_000);
    expect(g.cellSize).toBeGreaterThan(2);
  });
});

describe('지면 그림자', () => {
  const H = 30;
  const prisms = [cube(H)];
  const caster = createRayCaster(buildUniformGrid(prisms));
  const spec = groundGridFor(100, 2);
  const mask = buildingCellMask(spec, prisms);

  it('건물 안 셀은 마스크(NaN)', () => {
    const inside = cellIndexAt(spec, 0, 0);
    const outside = cellIndexAt(spec, 50, 50);
    expect(mask[inside]).toBe(1);
    expect(mask[outside]).toBe(0);
    // 20m × 20m → 2m 셀 100개
    expect(mask.reduce((a, b) => a + b, 0)).toBe(100);
    const out = new Float32Array(1);
    fillGroundShadow(spec, mask, caster, new Float32Array([0, 1, 0]), 1, 10, inside, inside + 1, out);
    expect(out[0]).toBeNaN();
  });

  it('정오(정남 고도 h) 그림자 길이 = H / tan h — 북쪽으로', () => {
    const h = 30; // 고도 30°
    const d = sunDirection(h, 180); // 정남에서 비춤
    const len = H / Math.tan((h * Math.PI) / 180); // ≈ 52m
    const dirs = new Float32Array(d);
    const shadowAt = (x: number, z: number) => {
      const i = cellIndexAt(spec, x, z);
      const out = new Float32Array(1);
      fillGroundShadow(spec, mask, caster, dirs, 1, 10, i, i + 1, out);
      return out[0];
    };
    // 북쪽(−z) 벽에서 그림자 길이 안쪽은 그늘, 바깥은 양지
    expect(shadowAt(0, -10 - len * 0.9)).toBe(10);
    expect(shadowAt(0, -10 - len * 1.1)).toBe(0);
    // 남쪽은 항상 양지
    expect(shadowAt(0, 20)).toBe(0);
  });

  it('셀 크기를 바꿔도 그림자 면적(분·m²)이 비슷하다', () => {
    const steps = computeSunSteps(37.5, 127, '2026-12-22', 10);
    const { directions, count } = sliceStepDirections(steps, 8 * 60, 16 * 60);
    expect(count).toBe(48);
    const total = (cell: number) => {
      const g = groundGridFor(150, cell);
      const m = buildingCellMask(g, prisms);
      const out = new Float32Array(g.cols * g.rows);
      fillGroundShadow(g, m, caster, directions, count, 10, 0, out.length, out);
      let sum = 0;
      for (const v of out) if (!Number.isNaN(v)) sum += v * cell * cell;
      return sum;
    };
    const a = total(2);
    const b = total(4);
    expect(Math.abs(a - b) / a).toBeLessThan(0.05);
  });
});
