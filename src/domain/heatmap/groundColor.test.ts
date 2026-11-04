import { describe, expect, it } from 'vitest';
import { groundShadowAlpha, groundTextureData } from './groundColor';

describe('지면 그림자 색', () => {
  it('그림자 없음·건물 안은 투명, 길수록 진하다', () => {
    expect(groundShadowAlpha(0, 480)).toBe(0);
    expect(groundShadowAlpha(NaN, 480)).toBe(0);
    expect(groundShadowAlpha(60, 480)).toBeLessThan(groundShadowAlpha(240, 480));
    expect(groundShadowAlpha(480, 480)).toBeCloseTo(0.82, 6);
    expect(groundShadowAlpha(999, 480)).toBeCloseTo(0.82, 6);
  });

  it('텍스처는 행을 뒤집는다 (행 0 = 북쪽 → 텍스처 맨 위)', () => {
    // 2 × 2: 북쪽 행은 그림자 480분, 남쪽 행은 0분
    const data = groundTextureData(new Float32Array([480, 480, 0, 0]), 2, 2, 480);
    expect(data[3]).toBe(0); // 텍스처 행 0 = 남쪽
    expect(data[2 * 4 * 1 + 3]).toBe(Math.round(0.82 * 255)); // 텍스처 행 1 = 북쪽
  });
});
