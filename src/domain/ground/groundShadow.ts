// 지면 그림자 누적 맵 (PLAN.md 9.11)
// 장면을 정사각 격자로 나누고 셀 중심(지면 위 0.1m)에서 각 시각의 태양 쪽 광선이 막히는지 센다.
// shadowMinutes[cell] = Δ · (해가 떠 있는데 막힌 칸 수). 건물 외곽선 안의 셀은 NaN(투명).
// 해가 진 칸은 그림자로 세지 않는다(그 시각은 어디나 어둡기 때문) — 기본 구간 08~16시에는 동지에도 해가 떠 있다.
import { pointInPolygon } from '../geometry/polygon';
import type { Prism } from '../geometry/prism';
import type { RayCaster } from '../spatial/rayCast';

export interface GroundGridSpec {
  /** 격자 왼쪽 위(서·북) 모서리 x, z [m] */
  originX: number;
  originZ: number;
  cellSize: number;
  cols: number;
  rows: number;
}

/** 셀 크기 선택지 [m] (모바일은 4m 이상만) */
export const GROUND_CELL_SIZES = [2, 4, 8] as const;
/** 셀 수 상한 — 너무 촘촘하면 셀 크기를 키운다 */
export const MAX_GROUND_CELLS = 250_000;
/** 셀 중심 높이 [m] */
export const GROUND_SAMPLE_Y = 0.1;

/** 장면 반경을 덮는 정사각 격자 (셀 수가 상한을 넘으면 셀 크기를 두 배씩 키운다) */
export function groundGridFor(radiusM: number, cellSize: number): GroundGridSpec {
  const extent = Math.max(radiusM, 50) + 10;
  let size = cellSize;
  let n = Math.ceil((extent * 2) / size);
  while (n * n > MAX_GROUND_CELLS) {
    size *= 2;
    n = Math.ceil((extent * 2) / size);
  }
  return { originX: -extent, originZ: -extent, cellSize: size, cols: n, rows: n };
}

export function cellCenter(spec: GroundGridSpec, index: number): [number, number] {
  const col = index % spec.cols;
  const row = Math.floor(index / spec.cols);
  return [spec.originX + (col + 0.5) * spec.cellSize, spec.originZ + (row + 0.5) * spec.cellSize];
}

/** 로컬 좌표 (x, z) → 셀 인덱스 (격자 밖이면 −1) */
export function cellIndexAt(spec: GroundGridSpec, x: number, z: number): number {
  const col = Math.floor((x - spec.originX) / spec.cellSize);
  const row = Math.floor((z - spec.originZ) / spec.cellSize);
  if (col < 0 || row < 0 || col >= spec.cols || row >= spec.rows) return -1;
  return row * spec.cols + col;
}

/** 셀 중심이 건물 외곽선 안이면 1 — 건물 bbox가 덮는 셀만 검사한다 */
export function buildingCellMask(spec: GroundGridSpec, prisms: readonly Prism[]): Uint8Array {
  const mask = new Uint8Array(spec.cols * spec.rows);
  const { originX, originZ, cellSize, cols, rows } = spec;
  for (const p of prisms) {
    const c0 = Math.max(0, Math.floor((p.minX - originX) / cellSize));
    const c1 = Math.min(cols - 1, Math.floor((p.maxX - originX) / cellSize));
    const r0 = Math.max(0, Math.floor((p.minZ - originZ) / cellSize));
    const r1 = Math.min(rows - 1, Math.floor((p.maxZ - originZ) / cellSize));
    for (let r = r0; r <= r1; r++) {
      const z = originZ + (r + 0.5) * cellSize;
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (mask[i]) continue;
        if (pointInPolygon(originX + (c + 0.5) * cellSize, z, p.ring)) mask[i] = 1;
      }
    }
  }
  return mask;
}

/**
 * 셀 [from, to)의 그림자 시간 [분]을 out[0 .. to−from)에 채운다. 쏜 광선 수를 돌려준다.
 * @param directions 태양 방향 (dx, dy, dz) × K — 구간 안의 칸만
 */
export function fillGroundShadow(
  spec: GroundGridSpec,
  mask: Uint8Array,
  caster: RayCaster,
  directions: Float32Array,
  stepCount: number,
  stepMinutes: number,
  from: number,
  to: number,
  out: Float32Array,
): number {
  let rays = 0;
  for (let i = from; i < to; i++) {
    if (mask[i]) {
      out[i - from] = NaN;
      continue;
    }
    const [x, z] = cellCenter(spec, i);
    let blocked = 0;
    for (let k = 0; k < stepCount; k++) {
      const dy = directions[k * 3 + 1]!;
      if (dy <= 0) continue;
      rays++;
      if (caster.isBlocked(x, GROUND_SAMPLE_Y, z, directions[k * 3]!, dy, directions[k * 3 + 2]!)) blocked++;
    }
    out[i - from] = blocked * stepMinutes;
  }
  return rays;
}

/** 하루 칸(SunSteps)에서 [startMin, endMin) 구간 칸의 태양 방향만 잘라낸다 */
export function sliceStepDirections(
  steps: { startMinute: number; stepMinutes: number; count: number; directions: Float32Array },
  startMin: number,
  endMin: number,
): { directions: Float32Array; count: number } {
  const k0 = Math.max(0, Math.ceil((startMin - steps.startMinute) / steps.stepMinutes));
  const k1 = Math.min(steps.count, Math.floor((endMin - steps.startMinute) / steps.stepMinutes));
  const count = Math.max(0, k1 - k0);
  return { directions: steps.directions.slice(k0 * 3, (k0 + count) * 3), count };
}
