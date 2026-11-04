// 광선 차폐 판정 — 균일 그리드를 2D DDA(Amanatides–Woo)로 따라가며 후보 프리즘만 검사 (PLAN.md 9.5)
//
// - 가시성만 필요하므로 첫 교차에서 바로 true를 반환한다(최근접 교차 불필요).
// - 같은 광선에서 여러 셀에 등록된 프리즘을 중복 검사하지 않도록 mailbox(프리즘별 마지막 rayId)를 쓴다.
// - 광선이 셀에 들어갈 때 이미 그 셀의 최고 지붕보다 높으면(d_y > 0이라 계속 올라가므로) 셀을 건너뛴다.
// - 장면 최고 높이에 도달하는 t 이후로는 더 볼 필요가 없다.

import { hitsPrism, rayHitsBox2D, RAY_EPSILON, type Prism } from '../geometry/prism';
import type { UniformGrid } from './uniformGrid';

export interface RayCaster {
  /** p에서 d 방향(태양 쪽) 반직선이 어떤 프리즘에 막히면 true */
  isBlocked(px: number, py: number, pz: number, dx: number, dy: number, dz: number): boolean;
}

/** 전수 검사 — 그리드 결과 검증용 기준 구현 */
export function isBlockedBruteForce(
  prisms: readonly Prism[],
  px: number,
  py: number,
  pz: number,
  dx: number,
  dy: number,
  dz: number,
): boolean {
  for (const prism of prisms) {
    if (hitsPrism(px, py, pz, dx, dy, dz, prism)) return true;
  }
  return false;
}

export function createRayCaster(grid: UniformGrid): RayCaster {
  const { prisms, cellSize, minX, minZ, nx, nz, cellStart, cellItems, cellMaxHeight, maxHeight } = grid;
  const maxX = minX + nx * cellSize;
  const maxZ = minZ + nz * cellSize;
  const mailbox = new Uint32Array(prisms.length);
  let rayId = 0;

  function isBlocked(px: number, py: number, pz: number, dx: number, dy: number, dz: number): boolean {
    if (prisms.length === 0 || py >= maxHeight) return false;
    // 장면 최고 높이에 닿는 t (그 뒤로는 어떤 건물에도 막히지 않음)
    const tLimit = dy > 0 ? (maxHeight - py) / dy : Infinity;
    if (tLimit <= RAY_EPSILON) return false;
    // 천정 방향(수평 성분 0)은 벽과 만나지 않는다 — hitsPrism과 같은 판단
    if (Math.abs(dx) < 1e-12 && Math.abs(dz) < 1e-12) return false;

    // 그리드 진입 지점 (시작점이 그리드 밖일 수도 있다)
    let tStart = 0;
    if (px < minX || px > maxX || pz < minZ || pz > maxZ) {
      if (!rayHitsBox2D(px, pz, dx, dz, 0, tLimit, minX, maxX, minZ, maxZ)) return false;
      const tx = dx !== 0 ? Math.min((minX - px) / dx, (maxX - px) / dx) : -Infinity;
      const tz = dz !== 0 ? Math.min((minZ - pz) / dz, (maxZ - pz) / dz) : -Infinity;
      tStart = Math.max(0, tx, tz);
    }

    rayId = (rayId + 1) >>> 0;
    if (rayId === 0) {
      mailbox.fill(0);
      rayId = 1;
    }

    const sx = px + dx * tStart;
    const sz = pz + dz * tStart;
    let ix = Math.min(nx - 1, Math.max(0, Math.floor((sx - minX) / cellSize)));
    let iz = Math.min(nz - 1, Math.max(0, Math.floor((sz - minZ) / cellSize)));
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? cellSize / Math.abs(dx) : Infinity;
    const tDeltaZ = dz !== 0 ? cellSize / Math.abs(dz) : Infinity;
    let tNextX = dx !== 0 ? (minX + (ix + (dx > 0 ? 1 : 0)) * cellSize - px) / dx : Infinity;
    let tNextZ = dz !== 0 ? (minZ + (iz + (dz > 0 ? 1 : 0)) * cellSize - pz) / dz : Infinity;
    let tEnter = tStart;

    while (tEnter <= tLimit) {
      const c = iz * nx + ix;
      const cellTop = cellMaxHeight[c]!;
      // 셀 진입 시 광선 높이가 이미 셀 최고 지붕보다 높으면 이 셀에서는 막힐 수 없다
      if (cellTop > 0 && !(dy > 0 && py + tEnter * dy > cellTop)) {
        const end = cellStart[c + 1]!;
        for (let k = cellStart[c]!; k < end; k++) {
          const index = cellItems[k]!;
          if (mailbox[index] === rayId) continue;
          mailbox[index] = rayId;
          if (hitsPrism(px, py, pz, dx, dy, dz, prisms[index]!)) return true;
        }
      }
      if (tNextX < tNextZ) {
        ix += stepX;
        if (ix < 0 || ix >= nx) break;
        tEnter = tNextX;
        tNextX += tDeltaX;
      } else {
        iz += stepZ;
        if (iz < 0 || iz >= nz) break;
        tEnter = tNextZ;
        tNextZ += tDeltaZ;
      }
    }
    return false;
  }

  return { isBlocked };
}
