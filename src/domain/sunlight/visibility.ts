// 가시성 마스크 (PLAN.md 9.5·9.6) — 세대 u, 칸 k에 직사광이 닿으면 vis[u·K + k] = 1
//
// 판정 조건: (1) 해가 떠 있음, (2) 창이 태양 쪽을 향함 (n · d > 0), (3) 태양 쪽 반직선이 건물에 막히지 않음.
// 일조·기준 판정·일사량 등 모든 분석이 이 마스크 하나를 재사용한다.

import type { RayCaster } from '../spatial/rayCast';
import type { SunSteps } from './sunSteps';

/** 세대 위치·법선 (UnitSet의 일부 — Worker에는 이 두 배열만 보낸다) */
export interface UnitGeometry {
  /** (x, y, z) × U */
  positions: Float32Array;
  /** (nx, nz) × U */
  normals: Float32Array;
}

/**
 * [from, to) 범위 세대의 마스크를 out에 채운다. out은 (to − from) × K 크기, 행 = 세대.
 * @returns 실제로 쏜 광선 수 (성능 측정용)
 */
export function fillVisibilityMask(
  units: UnitGeometry,
  from: number,
  to: number,
  steps: Pick<SunSteps, 'count' | 'directions'>,
  caster: RayCaster,
  out: Uint8Array,
  outOffset = 0,
): number {
  const K = steps.count;
  const dirs = steps.directions;
  const { positions, normals } = units;
  let rays = 0;
  for (let u = from; u < to; u++) {
    const px = positions[u * 3]!;
    const py = positions[u * 3 + 1]!;
    const pz = positions[u * 3 + 2]!;
    const nx = normals[u * 2]!;
    const nz = normals[u * 2 + 1]!;
    const row = outOffset + (u - from) * K;
    for (let k = 0; k < K; k++) {
      const dy = dirs[k * 3 + 1]!;
      if (dy <= 0) {
        out[row + k] = 0;
        continue;
      }
      const dx = dirs[k * 3]!;
      const dz = dirs[k * 3 + 2]!;
      if (nx * dx + nz * dz <= 0) {
        out[row + k] = 0; // 창이 태양 반대쪽
        continue;
      }
      rays++;
      out[row + k] = caster.isBlocked(px, py, pz, dx, dy, dz) ? 0 : 1;
    }
  }
  return rays;
}
