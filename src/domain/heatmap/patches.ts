// 세대 창문 패치 배치 (PLAN.md A5) — 패치 하나 = 세대 하나
// 크기: 폭 = 라인 폭 × 0.8, 높이 = 층고 × 0.6. 세대 점(벽에서 0.05m)보다 0.1m 더 띄워 벽면과 겹쳐 깜빡이지 않게 한다.
// 행렬 계산은 three.js 없이 직접 해서 Float32Array(16 × U, 열 우선)로 돌려준다 → InstancedMesh.instanceMatrix에 그대로 복사.

import type { UnitSet } from '../units/generateUnits';

export const PATCH_WIDTH_RATIO = 0.8;
export const PATCH_HEIGHT_RATIO = 0.6;
export const PATCH_EXTRA_OFFSET_M = 0.1;

/**
 * XY 평면의 1×1 사각형(+z를 바라봄)을 세대 위치·방향·크기로 옮기는 행렬들.
 * 회전은 y축 기준 yaw = atan2(nx, nz) — +z 법선을 (nx, 0, nz)로 돌린다.
 */
export function patchMatrices(units: UnitSet): Float32Array {
  const out = new Float32Array(units.count * 16);
  for (let i = 0; i < units.count; i++) {
    const nx = units.normals[i * 2]!;
    const nz = units.normals[i * 2 + 1]!;
    const w = units.lineWidth[i]! * PATCH_WIDTH_RATIO;
    const h = units.floorHeight[i]! * PATCH_HEIGHT_RATIO;
    // yaw 회전: cos = nz, sin = nx
    const c = nz;
    const s = nx;
    const o = i * 16;
    // 열 0: 회전된 x축 × 폭
    out[o] = c * w;
    out[o + 1] = 0;
    out[o + 2] = -s * w;
    out[o + 3] = 0;
    // 열 1: y축 × 높이
    out[o + 4] = 0;
    out[o + 5] = h;
    out[o + 6] = 0;
    out[o + 7] = 0;
    // 열 2: 회전된 z축 (법선)
    out[o + 8] = s;
    out[o + 9] = 0;
    out[o + 10] = c;
    out[o + 11] = 0;
    // 열 3: 위치
    out[o + 12] = units.positions[i * 3]! + nx * PATCH_EXTRA_OFFSET_M;
    out[o + 13] = units.positions[i * 3 + 1]!;
    out[o + 14] = units.positions[i * 3 + 2]! + nz * PATCH_EXTRA_OFFSET_M;
    out[o + 15] = 1;
  }
  return out;
}
