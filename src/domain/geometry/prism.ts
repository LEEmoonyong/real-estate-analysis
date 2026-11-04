// 돌출 다각형(프리즘)과 반직선의 교차 판정 (PLAN.md 9.5) — 외부 엔진 없이 직접 구현
//
// 좌표: x=동, y=위, z=남. 링은 (x, z) 쌍의 평탄 배열이고 바닥 y=0, 지붕 y=height.
//
// 핵심 관찰: 태양 방향 d의 d_y > 0이면 광선은 위로만 올라간다. 시작점이 지붕보다 아래면
// 광선은 옆면(벽)을 통해서만 프리즘에 들어가거나 나갈 수 있으므로 지붕·바닥 면은 검사하지 않는다.
// 벽과의 교차는 xz 평면의 2D 반직선–선분 교차로 바꾸고, 교차 지점 높이가 지붕 아래인지(t ≤ tMax)만 본다.

import type { Ring } from './polygon';

export interface Prism {
  /** (x, z) 쌍, 닫는 점 없음 */
  ring: Ring;
  /** 지붕 높이 [m] */
  height: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 시작점이 자기 면 위에 있을 때 그 면과의 교차를 배제하는 최소 t */
export const RAY_EPSILON = 1e-3;

export function createPrism(ring: Ring, height: number): Prism {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    const x = ring[i]!;
    const z = ring[i + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { ring, height, minX, maxX, minZ, maxZ };
}

/**
 * 2D 슬랩 테스트: 반직선 o + t·u (t ∈ [tMin, tMax])가 bbox를 지나는지.
 * u를 정규화하지 않으므로 t는 3D 광선 매개변수와 같다.
 */
export function rayHitsBox2D(
  ox: number,
  oz: number,
  ux: number,
  uz: number,
  tMin: number,
  tMax: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  let t0 = tMin;
  let t1 = tMax;
  if (Math.abs(ux) < 1e-15) {
    if (ox < minX || ox > maxX) return false;
  } else {
    let a = (minX - ox) / ux;
    let b = (maxX - ox) / ux;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  if (Math.abs(uz) < 1e-15) {
    if (oz < minZ || oz > maxZ) return false;
  } else {
    let a = (minZ - oz) / uz;
    let b = (maxZ - oz) / uz;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * 반직선 p + t·d (t > ε)가 프리즘에 막히는지.
 * - p_y ≥ height면 막히지 않는다 (d_y ≥ 0 가정: 지붕 위에서 위로 가는 광선).
 * - 꼭짓점을 정확히 지나거나 변에 닿는 경우(s ∈ [0, 1] 경계 포함)는 막힘으로 본다 — 보수적 판정.
 * - 태양이 천정에 가까워 xz 성분이 0이면 벽과 만나지 않으므로 막히지 않는다.
 */
export function hitsPrism(
  px: number,
  py: number,
  pz: number,
  dx: number,
  dy: number,
  dz: number,
  prism: Prism,
): boolean {
  const H = prism.height;
  if (py >= H) return false;
  // 지붕 높이에 도달하는 t. 수평(d_y ≤ 0) 광선은 높이가 줄지 않으므로 무한대
  const tMax = dy > 0 ? (H - py) / dy : Infinity;
  if (tMax <= RAY_EPSILON) return false;
  if (!rayHitsBox2D(px, pz, dx, dz, RAY_EPSILON, tMax, prism.minX, prism.maxX, prism.minZ, prism.maxZ)) {
    return false;
  }

  const ring = prism.ring;
  const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const ax = ring[i]!;
    const az = ring[i + 1]!;
    const j = i + 2 < n ? i + 2 : 0;
    const ex = ring[j]! - ax;
    const ez = ring[j + 1]! - az;
    // cross2(u, e)
    const denom = dx * ez - dz * ex;
    if (Math.abs(denom) < 1e-12) continue; // 평행 (변을 따라 미끄러지는 경우는 양 끝 꼭짓점 쪽 변에서 잡힌다)
    const wx = ax - px;
    const wz = az - pz;
    const t = (wx * ez - wz * ex) / denom; // 광선 매개변수
    if (t <= RAY_EPSILON || t > tMax) continue;
    const s = (wx * dz - wz * dx) / denom; // 변 매개변수
    if (s >= 0 && s <= 1) return true;
  }
  return false;
}

/** 장면 건물 → 프리즘 목록 (순서 유지: prisms[i]는 buildings[i]) */
export function prismsFromBuildings(buildings: readonly { ring: Ring; heightM: number }[]): Prism[] {
  return buildings.map((b) => createPrism(b.ring, b.heightM));
}
