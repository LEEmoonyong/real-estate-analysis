import { describe, expect, it } from 'vitest';
import { buildingFocusPose, easeInOutCubic, unitFocusPose } from './focusPose';

describe('unitFocusPose', () => {
  it('창문 법선 방향 바깥, 창보다 위에서 창을 바라본다', () => {
    const pose = unitFocusPose([10, 30, 6], [0, 1], 75); // 남향 창
    expect(pose.lookAt).toEqual([10, 30, 6]);
    expect(pose.position[0]).toBeCloseTo(10, 6);
    expect(pose.position[2]).toBeGreaterThan(6 + 60); // 남쪽으로 떨어져 있음
    expect(pose.position[1]).toBeGreaterThan(30);
    const d = Math.hypot(pose.position[0] - 10, pose.position[1] - 30, pose.position[2] - 6);
    expect(d).toBeCloseTo(90, 6); // 75m × 1.2
  });

  it('거리는 70~170m로 제한', () => {
    const near = unitFocusPose([0, 2, 0], [1, 0], 10);
    expect(Math.hypot(near.position[0], near.position[1] - 2, near.position[2])).toBeCloseTo(70, 6);
    const far = unitFocusPose([0, 2, 0], [1, 0], 300);
    expect(Math.hypot(far.position[0], far.position[1] - 2, far.position[2])).toBeCloseTo(170, 6);
  });
});

describe('buildingFocusPose', () => {
  const ring = new Float64Array([100, 0, 124, 0, 124, 12, 100, 12]);

  it('건물 중심(높이 절반)을 바라보고 시선 방향을 유지한다', () => {
    const dir: [number, number, number] = [0, 0.6, 0.8];
    const pose = buildingFocusPose(ring, 60, dir);
    expect(pose.lookAt).toEqual([112, 30, 6]);
    const v = pose.position.map((p, i) => p - pose.lookAt[i]!);
    const len = Math.hypot(...v);
    expect(len).toBeCloseTo(120, 6); // max(80, 60×2, 반경×3)
    expect(v[1]! / len).toBeCloseTo(0.6, 6);
  });

  it('수평에 가까운 시선이면 위에서 보도록 올린다', () => {
    const pose = buildingFocusPose(ring, 30, [1, 0, 0]);
    expect(pose.position[1]).toBeGreaterThan(pose.lookAt[1] + 30);
  });
});

it('easeInOutCubic: 0 → 0, 0.5 → 0.5, 1 → 1, 단조 증가', () => {
  expect(easeInOutCubic(0)).toBe(0);
  expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
  expect(easeInOutCubic(1)).toBe(1);
  for (let t = 0; t < 1; t += 0.05) expect(easeInOutCubic(t + 0.05)).toBeGreaterThan(easeInOutCubic(t));
});
