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

/** 카메라 방향: 남남동(방위 약 162°) 위쪽, 고도각 약 37° — 남향 아파트 정면이 잘 보이도록 */
const VIEW_DIR = (() => {
  const v = [0.3, 0.75, 0.95] as const;
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len] as const;
})();

/** 단지 대부분(반경의 FIT_RATIO)이 화면에 들어오게 맞춘다. 외곽 건물까지 다 넣으면 너무 작아진다. */
const FIT_RATIO = 0.75;

/**
 * 기본 카메라 위치 — 반경 r·fitR인 구가 세로·가로 시야각 중 좁은 쪽에 꼭 맞는 거리.
 * 세로로 긴 화면(모바일·태블릿 세로)에서는 가로 시야각이 좁아 더 멀리 물러난다.
 */
export function defaultCameraPosition(radiusM: number, fovDeg = 45, aspect = 1.5): [number, number, number] {
  const r = Math.max(radiusM, 80) * FIT_RATIO;
  const halfV = (fovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 0.1));
  const dist = r / Math.sin(Math.min(halfV, halfH));
  return [VIEW_DIR[0] * dist, VIEW_DIR[1] * dist, VIEW_DIR[2] * dist];
}
