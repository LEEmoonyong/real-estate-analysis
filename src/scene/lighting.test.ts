import { describe, expect, it } from 'vitest';
import { lightingForAltitude, shadowFrustum } from './lighting';

describe('lightingForAltitude', () => {
  it('지평선 아래면 직사광을 끈다', () => {
    expect(lightingForAltitude(-0.1).sunIntensity).toBe(0);
    expect(lightingForAltitude(-20).sunIntensity).toBe(0);
  });

  it('고도가 높을수록 직사광이 세진다 (단조 증가)', () => {
    const values = [0.5, 5, 15, 30, 60].map((a) => lightingForAltitude(a).sunIntensity);
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
  });

  it('밤·낮 하늘색', () => {
    expect(lightingForAltitude(-20).skyColor).toBe('#1f2738');
    expect(lightingForAltitude(40).skyColor).toBe('#cfe3f5');
  });

  it('색 문자열 형식', () => {
    for (const a of [-10, -3, 0, 3, 10, 50]) {
      const l = lightingForAltitude(a);
      expect(l.skyColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(l.sunColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('shadowFrustum', () => {
  it('장면 구를 감싸고 near < 구 앞면, far > 구 뒷면', () => {
    const f = shadowFrustum(400, 150);
    const sphere = Math.hypot(400, 150);
    expect(f.halfSize).toBeGreaterThanOrEqual(sphere);
    expect(f.near).toBeLessThan(f.distance - sphere);
    expect(f.far).toBeGreaterThan(f.distance + sphere);
  });
});
