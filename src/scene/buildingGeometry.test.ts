// 돌출 지오메트리가 로컬 좌표 규칙(x=동, y=위, z=남)과 일치하는지 확인
import { describe, expect, it } from 'vitest';
import { createBuildingGeometry } from './buildingGeometry';

describe('createBuildingGeometry', () => {
  // x 10~30, z −20~−5 (원점 북쪽) 의 CCW 직사각형
  const ring = new Float64Array([10, -5, 30, -5, 30, -20, 10, -20]);
  const geometry = createBuildingGeometry(ring, 42);
  const box = geometry.boundingBox!;

  it('바닥은 y=0, 지붕은 y=높이', () => {
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(42, 6);
  });

  it('x·z 범위가 외곽선과 같다 (z 부호가 뒤집히지 않음)', () => {
    expect(box.min.x).toBeCloseTo(10, 6);
    expect(box.max.x).toBeCloseTo(30, 6);
    expect(box.min.z).toBeCloseTo(-20, 6);
    expect(box.max.z).toBeCloseTo(-5, 6);
  });

  it('삼각형 면이 만들어진다', () => {
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
  });
});
