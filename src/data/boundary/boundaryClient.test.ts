import { describe, expect, it } from 'vitest';
import { boundaryContains } from './boundaryClient';

describe('테두리 안 클릭 판별', () => {
  // 경도 127~127.1, 위도 37~37.1 사각형 + 떨어진 섬 하나 (MultiPolygon처럼)
  const b = {
    rings: [
      [
        [127, 37],
        [127.1, 37],
        [127.1, 37.1],
        [127, 37.1],
        [127, 37],
      ],
      [
        [126.5, 37.5],
        [126.6, 37.5],
        [126.6, 37.6],
        [126.5, 37.5],
      ],
    ] as [number, number][][],
  };
  it('안·밖·다른 고리', () => {
    expect(boundaryContains(b, 37.05, 127.05)).toBe(true);
    expect(boundaryContains(b, 37.2, 127.05)).toBe(false);
    expect(boundaryContains(b, 37.52, 126.58)).toBe(true);
  });
});

describe('확대 수준 → 지도 클릭 행정구역 단계', () => {
  it('동 · 구 · 시 · 시·도', async () => {
    const { levelForZoom } = await import('./boundaryClient');
    expect([3, 5, 6, 7, 8, 9, 10, 13].map(levelForZoom)).toEqual([
      'emd',
      'emd',
      'sigungu',
      'sigungu',
      'si',
      'si',
      'sido',
      'sido',
    ]);
  });
});
