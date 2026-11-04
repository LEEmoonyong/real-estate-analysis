import { describe, expect, it } from 'vitest';
import { clampLook, PITCH_MAX, PITCH_MIN, windowLookDirection, YAW_LIMIT } from './windowView';

describe('창문 시점', () => {
  it('둘러보기 0이면 창문 법선 방향(수평)을 본다', () => {
    const [x, y, z] = windowLookDirection(0, 1, 0, 0); // 남향 창
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(1, 9);
    const [x2, , z2] = windowLookDirection(-0.6, 0.8, 0, 0);
    expect(x2).toBeCloseTo(-0.6, 9);
    expect(z2).toBeCloseTo(0.8, 9);
  });

  it('위로 올려 보면 y가 커지고 단위 벡터를 유지', () => {
    const d = windowLookDirection(0, 1, 0.3, 0.5);
    expect(d[1]).toBeCloseTo(Math.sin(0.5), 9);
    expect(Math.hypot(...d)).toBeCloseTo(1, 9);
  });

  it('범위: 좌우 ±80°, 위아래 −30°~+70°', () => {
    expect(clampLook(10, 10)).toEqual({ yaw: YAW_LIMIT, pitch: PITCH_MAX });
    expect(clampLook(-10, -10)).toEqual({ yaw: -YAW_LIMIT, pitch: PITCH_MIN });
    expect(clampLook(0.1, 0.2)).toEqual({ yaw: 0.1, pitch: 0.2 });
  });
});
