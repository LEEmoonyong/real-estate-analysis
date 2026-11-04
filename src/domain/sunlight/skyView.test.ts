import { describe, expect, it } from 'vitest';
import { createPrism } from '../geometry/prism';
import { createRayCaster } from '../spatial/rayCast';
import { buildUniformGrid } from '../spatial/uniformGrid';
import { cosineHemisphereSamples, skyOpenness, skyViewFactorAt } from './skyView';

const empty = createRayCaster(buildUniformGrid([]));

describe('천공률 (해석해 비교)', () => {
  const samples = cosineHemisphereSamples(1024);

  it('가림 없는 수직 벽 → 0.5 ± 0.01', () => {
    const { svf } = skyViewFactorAt(0, 10, 0, 0, 0, 1, samples, empty);
    expect(svf).toBeCloseTo(0.5, 1);
    expect(Math.abs(svf - 0.5)).toBeLessThan(0.01);
    expect(skyOpenness(svf)).toBeCloseTo(1, 1);
  });

  it('가림 없는 수평 지붕 → 1.0', () => {
    expect(skyViewFactorAt(0, 10, 0, 0, 1, 0, samples, empty).svf).toBe(1);
  });

  it('무한 협곡 바닥 중앙 → cos(atan(2H/W)) ± 0.02', () => {
    // 폭 W = 20m, 높이 H = 20m, 길이 2km (무한 근사): 협곡은 x 방향
    const W = 20;
    const H = 20;
    const L = 1000;
    const north = createPrism(new Float64Array([-L, -W / 2 - 10, L, -W / 2 - 10, L, -W / 2, -L, -W / 2]), H);
    const south = createPrism(new Float64Array([-L, W / 2, L, W / 2, L, W / 2 + 10, -L, W / 2 + 10]), H);
    const caster = createRayCaster(buildUniformGrid([north, south]));
    const { svf } = skyViewFactorAt(0, 0.01, 0, 0, 1, 0, cosineHemisphereSamples(4096), caster);
    const expected = Math.cos(Math.atan((2 * H) / W));
    expect(Math.abs(svf - expected)).toBeLessThan(0.02);
  });

  it('수렴: N = 64·128·256의 오차가 N = 16384 기준값 대비 작다', () => {
    const tower = createPrism(new Float64Array([20, -15, 40, -15, 40, 15, 20, 15]), 60);
    const caster = createRayCaster(buildUniformGrid([tower]));
    const at = (n: number) => skyViewFactorAt(0, 5, 0, 1, 0, 0, cosineHemisphereSamples(n), caster).svf;
    const ref = at(16384);
    const err = [64, 128, 256, 1024].map((n) => Math.abs(at(n) - ref));
    expect(err[2]).toBeLessThan(0.03); // N=256
    expect(err[3]).toBeLessThan(0.01); // N=1024
    expect(ref).toBeLessThan(0.5); // 앞에 탑이 있어 가림 없는 벽보다 작다
  });
});
