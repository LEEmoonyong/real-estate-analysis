// 건물 외곽선 정리 (PLAN.md 9.3)
// 링은 로컬 좌표 Float64Array (x0, z0, x1, z1, …), 닫힘 정점 없음.
//
// 방향 규칙: 위에서 내려다본 평면 (x = 동, n = 북 = −z)에서 반시계(CCW)를 표준으로 한다.
//   부호 있는 면적 A = ½ Σ (x_i·n_{i+1} − x_{i+1}·n_i) > 0  ⇔  CCW
//   CCW 링에서 변 a→b의 외향 법선(xz) = (−dz, dx) / |d|   (진행 방향의 오른쪽)

export type Ring = Float64Array;

export interface CleanOptions {
  /** 이보다 가까운 연속 정점은 하나로 합친다 [m] */
  duplicateEpsilon: number;
  /** 세 점이 이루는 각의 sin이 이보다 작으면 가운데 점을 제거 (공선·스파이크) */
  collinearSin: number;
  /** 이보다 작은 면적의 외곽선은 버린다 [m²] */
  minArea: number;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  duplicateEpsilon: 0.05,
  collinearSin: Math.sin((0.5 * Math.PI) / 180),
  minArea: 10,
};

export type CleanResult = { ring: Ring; area: number; repaired: boolean } | null;

export const vertexCount = (ring: Ring) => ring.length / 2;

/** 부호 있는 면적 [m²] (CCW > 0, 북 = −z 기준) */
export function signedArea(ring: Ring): number {
  const n = vertexCount(ring);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // n = −z 이므로 x_i·n_j − x_j·n_i = −x_i·z_j + x_j·z_i
    sum += ring[j * 2]! * ring[i * 2 + 1]! - ring[i * 2]! * ring[j * 2 + 1]!;
  }
  return sum / 2;
}

/** 정점 순서를 뒤집는다 */
export function reverseRing(ring: Ring): Ring {
  const n = vertexCount(ring);
  const out = new Float64Array(ring.length);
  for (let i = 0; i < n; i++) {
    out[i * 2] = ring[(n - 1 - i) * 2]!;
    out[i * 2 + 1] = ring[(n - 1 - i) * 2 + 1]!;
  }
  return out;
}

/** CCW로 맞춘 링 (이미 CCW면 그대로 반환) */
export function ensureCcw(ring: Ring): Ring {
  return signedArea(ring) < 0 ? reverseRing(ring) : ring;
}

/** CCW 링의 i번째 변(i → i+1) 외향 단위 법선 [nx, nz] */
export function edgeOutwardNormal(ring: Ring, i: number): [number, number] {
  const n = vertexCount(ring);
  const j = (i + 1) % n;
  const dx = ring[j * 2]! - ring[i * 2]!;
  const dz = ring[j * 2 + 1]! - ring[i * 2 + 1]!;
  const len = Math.hypot(dx, dz);
  return [-dz / len, dx / len];
}

/** 점이 다각형 내부에 있는지 (반직선 교차 횟수, 경계 위 점은 정의하지 않음) */
export function pointInPolygon(x: number, z: number, ring: Ring): boolean {
  const n = vertexCount(ring);
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2]!,
      zi = ring[i * 2 + 1]!;
    const xj = ring[j * 2]!,
      zj = ring[j * 2 + 1]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;

/** 두 선분 p1p2, p3p4가 교차(접촉 포함)하는지 */
export function segmentsIntersect(
  p1x: number,
  p1z: number,
  p2x: number,
  p2z: number,
  p3x: number,
  p3z: number,
  p4x: number,
  p4z: number,
): boolean {
  const d1 = cross(p4x - p3x, p4z - p3z, p1x - p3x, p1z - p3z);
  const d2 = cross(p4x - p3x, p4z - p3z, p2x - p3x, p2z - p3z);
  const d3 = cross(p2x - p1x, p2z - p1z, p3x - p1x, p3z - p1z);
  const d4 = cross(p2x - p1x, p2z - p1z, p4x - p1x, p4z - p1z);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const onSegment = (ax: number, az: number, bx: number, bz: number, px: number, pz: number) =>
    Math.min(ax, bx) <= px && px <= Math.max(ax, bx) && Math.min(az, bz) <= pz && pz <= Math.max(az, bz);
  return (
    (d1 === 0 && onSegment(p3x, p3z, p4x, p4z, p1x, p1z)) ||
    (d2 === 0 && onSegment(p3x, p3z, p4x, p4z, p2x, p2z)) ||
    (d3 === 0 && onSegment(p1x, p1z, p2x, p2z, p3x, p3z)) ||
    (d4 === 0 && onSegment(p1x, p1z, p2x, p2z, p4x, p4z))
  );
}

/** 인접하지 않은 변끼리 교차하는지 — O(n²), 건물 외곽선은 보통 n < 50 */
export function isSelfIntersecting(ring: Ring): boolean {
  const n = vertexCount(ring);
  if (n < 4) return false;
  const px = (i: number) => ring[(i % n) * 2]!;
  const pz = (i: number) => ring[(i % n) * 2 + 1]!;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // 첫 변과 마지막 변은 정점을 공유
      if (segmentsIntersect(px(i), pz(i), px(i + 1), pz(i + 1), px(j), pz(j), px(j + 1), pz(j + 1))) return true;
    }
  }
  return false;
}

/** 볼록 껍질 (Andrew monotone chain) — 결과는 CCW */
export function convexHull(ring: Ring): Ring {
  // (x, n = −z) 평면에서 계산하면 표준 수학 좌표계라 결과가 그대로 CCW
  const pts = Array.from(
    { length: vertexCount(ring) },
    (_, i) => [ring[i * 2]!, -ring[i * 2 + 1]!] as [number, number],
  );
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const out = new Float64Array(hull.length * 2);
  hull.forEach(([x, n], i) => {
    out[i * 2] = x;
    out[i * 2 + 1] = -n;
  });
  return out;
}

/** 연속 중복 정점 제거 (닫힘 정점 포함) */
function removeDuplicates(pts: [number, number][], eps: number): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) >= eps) out.push(p);
  }
  while (out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < eps) out.pop();
    else break;
  }
  return out;
}

/** 공선 정점·스파이크(되돌아가는 점) 제거 — 변화가 없을 때까지 반복 */
function removeCollinear(pts: [number, number][], minSin: number): [number, number][] {
  let out = pts;
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length]!;
      const b = out[i]!;
      const c = out[(i + 1) % out.length]!;
      const ux = b[0] - a[0],
        uz = b[1] - a[1];
      const vx = c[0] - b[0],
        vz = c[1] - b[1];
      const sin = Math.abs(cross(ux, uz, vx, vz)) / (Math.hypot(ux, uz) * Math.hypot(vx, vz));
      if (sin < minSin) {
        out = out.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return out;
}

/**
 * 외곽선 정리 파이프라인:
 * 중복 제거 → 공선·스파이크 제거 → 정점 수·면적 검사 → CCW 통일 → 자기교차면 볼록 껍질로 복구.
 * 쓸 수 없는 외곽선이면 null.
 */
export function cleanFootprint(input: Ring, options: CleanOptions = DEFAULT_CLEAN_OPTIONS): CleanResult {
  let pts = Array.from(
    { length: vertexCount(input) },
    (_, i) => [input[i * 2]!, input[i * 2 + 1]!] as [number, number],
  );
  if (pts.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) return null;
  pts = removeDuplicates(pts, options.duplicateEpsilon);
  pts = removeCollinear(pts, options.collinearSin);
  if (pts.length < 3) return null;

  let ring: Ring = new Float64Array(pts.flat());
  let repaired = false;
  if (isSelfIntersecting(ring)) {
    ring = convexHull(ring);
    repaired = true;
  }
  ring = ensureCcw(ring);
  const area = signedArea(ring);
  if (vertexCount(ring) < 3 || area < options.minArea) return null;
  return { ring, area, repaired };
}
