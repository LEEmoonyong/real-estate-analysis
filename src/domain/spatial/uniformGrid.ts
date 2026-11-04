// xz 평면 균일 그리드 (PLAN.md 9.5 가속 구조 2)
// 각 프리즘을 bbox가 겹치는 모든 셀에 등록한다. 셀 목록은 CSR(압축 행) 형식으로
// 두 개의 typed array에 담아 Worker로 넘기기 쉽고 메모리도 적게 쓴다.

import type { Prism } from '../geometry/prism';

export interface UniformGrid {
  prisms: readonly Prism[];
  cellSize: number;
  minX: number;
  minZ: number;
  nx: number;
  nz: number;
  /** 셀 c의 프리즘 번호는 cellItems[cellStart[c] .. cellStart[c+1]) */
  cellStart: Uint32Array;
  cellItems: Uint32Array;
  /** 셀에 등록된 프리즘 중 가장 높은 지붕 [m] — 광선이 이미 그보다 높으면 셀을 건너뛴다 */
  cellMaxHeight: Float64Array;
  /** 전체 최고 높이 [m] */
  maxHeight: number;
}

export const DEFAULT_CELL_SIZE_M = 20;

/** 경계에 정확히 걸친 교차점도 등록 셀 안에 들도록 bbox를 살짝 넓힌다 */
const PAD = 1e-6;

export function cellIndexRange(grid: Pick<UniformGrid, 'cellSize' | 'minX' | 'minZ' | 'nx' | 'nz'>, p: Prism) {
  const clamp = (v: number, max: number) => Math.min(max - 1, Math.max(0, v));
  return {
    x0: clamp(Math.floor((p.minX - PAD - grid.minX) / grid.cellSize), grid.nx),
    x1: clamp(Math.floor((p.maxX + PAD - grid.minX) / grid.cellSize), grid.nx),
    z0: clamp(Math.floor((p.minZ - PAD - grid.minZ) / grid.cellSize), grid.nz),
    z1: clamp(Math.floor((p.maxZ + PAD - grid.minZ) / grid.cellSize), grid.nz),
  };
}

export function buildUniformGrid(prisms: readonly Prism[], cellSize = DEFAULT_CELL_SIZE_M): UniformGrid {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let maxHeight = 0;
  for (const p of prisms) {
    minX = Math.min(minX, p.minX);
    maxX = Math.max(maxX, p.maxX);
    minZ = Math.min(minZ, p.minZ);
    maxZ = Math.max(maxZ, p.maxZ);
    maxHeight = Math.max(maxHeight, p.height);
  }
  if (prisms.length === 0) {
    minX = maxX = minZ = maxZ = 0;
  }
  // 경계 바깥으로 한 칸 여유 (PAD로 넓힌 bbox가 마지막 셀에 들어가도록)
  minX -= cellSize * 0.5;
  minZ -= cellSize * 0.5;
  const nx = Math.max(1, Math.ceil((maxX + cellSize * 0.5 - minX) / cellSize));
  const nz = Math.max(1, Math.ceil((maxZ + cellSize * 0.5 - minZ) / cellSize));
  const cellCount = nx * nz;
  const base = { cellSize, minX, minZ, nx, nz };

  // 1차: 셀별 개수
  const counts = new Uint32Array(cellCount);
  const cellMaxHeight = new Float64Array(cellCount); // Float32는 반올림으로 실제 높이보다 낮아질 수 있어 건너뛰기 판정이 틀어진다
  for (const p of prisms) {
    const r = cellIndexRange(base, p);
    for (let iz = r.z0; iz <= r.z1; iz++) {
      for (let ix = r.x0; ix <= r.x1; ix++) {
        const c = iz * nx + ix;
        counts[c]!++;
        if (p.height > cellMaxHeight[c]!) cellMaxHeight[c] = p.height;
      }
    }
  }
  // 누적합 → 시작 위치
  const cellStart = new Uint32Array(cellCount + 1);
  for (let c = 0; c < cellCount; c++) cellStart[c + 1] = cellStart[c]! + counts[c]!;
  // 2차: 채우기
  const cellItems = new Uint32Array(cellStart[cellCount]!);
  const cursor = cellStart.slice(0, cellCount);
  prisms.forEach((p, index) => {
    const r = cellIndexRange(base, p);
    for (let iz = r.z0; iz <= r.z1; iz++) {
      for (let ix = r.x0; ix <= r.x1; ix++) {
        const c = iz * nx + ix;
        cellItems[cursor[c]!++] = index;
      }
    }
  });

  return { prisms, ...base, cellStart, cellItems, cellMaxHeight, maxHeight };
}
