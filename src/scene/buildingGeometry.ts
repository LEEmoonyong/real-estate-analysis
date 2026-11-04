// 건물 지오메트리·색상 (컴포넌트와 분리해 단위 테스트)
import { ExtrudeGeometry, Shape } from 'three';

export const BUILDING_COLORS = {
  apartment: '#d9dee6',
  other: '#e6dfd3',
  estimated: '#c9c4bb',
  corrected: '#b9d7f0',
  hovered: '#fbe7b5',
  selected: '#f5a524',
} as const;

/**
 * 로컬 링 (x, z) → three.js 돌출 지오메트리.
 * Shape는 XY 평면에 그리고 +Z로 돌출되므로, 점을 (x, −z)로 넣고 X축으로 −90° 회전하면
 * (x, y_s, z_s) → (x, z_s, −y_s) 가 되어 바닥이 y=0, 지붕이 y=height인 건물이 된다.
 */
export function createBuildingGeometry(ring: Float64Array, heightM: number): ExtrudeGeometry {
  const shape = new Shape();
  for (let i = 0; i < ring.length; i += 2) {
    const x = ring[i]!;
    const y = -ring[i + 1]!;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** 남남동 상공에서 내려다보는 기본 카메라 위치 (남향 아파트 정면이 잘 보이도록) */
export function defaultCameraPosition(radiusM: number): [number, number, number] {
  const r = Math.max(radiusM, 80);
  return [r * 0.35, r * 0.9, r * 1.15];
}
