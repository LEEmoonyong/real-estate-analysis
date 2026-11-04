// 천공률 (Sky View Factor, PLAN.md 9.9)
// SVF = (1/π) ∫ V(ω) cos θ dω — 창문 면에서 보이는 반구 중 하늘이 차지하는 코사인 가중 비율.
// 피보나치 원판 점을 반구로 올리는 코사인 가중 매핑(Malley)으로 샘플링하면 SVF ≈ (하늘이 보이는 샘플 수) / N.
// 가림이 전혀 없는 수직 벽은 반구의 절반이 지면이라 0.5 → 화면에는 "하늘 개방도 = SVF / 0.5"를 함께 보인다.
import type { RayCaster } from '../spatial/rayCast';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 기본 샘플 수 — 데스크톱 256, 태블릿 192, 모바일 128 */
export const SKY_SAMPLES = { desktop: 256, tablet: 192, mobile: 128 } as const;

/**
 * 법선 z_local 기준 코사인 가중 반구 방향 N개 (x, y, z_local) — 법선과 무관하게 한 번만 만든다.
 */
export function cosineHemisphereSamples(n: number): Float64Array {
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n);
    const psi = i * GOLDEN_ANGLE;
    out[i * 3] = r * Math.cos(psi);
    out[i * 3 + 1] = r * Math.sin(psi);
    out[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - r * r));
  }
  return out;
}

/**
 * 한 지점의 SVF. 법선 n(단위 벡터, 3D)에 대한 로컬 → 월드 변환(TBN)을 만들어 샘플을 돌린다.
 * 지면 쪽(ω_y ≤ 0) 방향은 광선 없이 0, 위쪽은 건물에 막히는지 검사한다.
 */
export function skyViewFactorAt(
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  samples: Float64Array,
  caster: RayCaster,
): { svf: number; rays: number } {
  // 법선에 수직인 두 축 t, b (법선이 거의 수직이면 x축 기준)
  let tx: number;
  let ty: number;
  let tz: number;
  if (Math.abs(ny) < 0.9) {
    // t = normalize(up × n)
    tx = nz;
    ty = 0;
    tz = -nx;
  } else {
    // t = normalize(x × n)
    tx = 0;
    ty = -nz;
    tz = ny;
  }
  const tl = Math.hypot(tx, ty, tz);
  tx /= tl;
  ty /= tl;
  tz /= tl;
  // b = n × t
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;

  const n = samples.length / 3;
  let sky = 0;
  let rays = 0;
  for (let i = 0; i < n; i++) {
    const a = samples[i * 3]!;
    const b = samples[i * 3 + 1]!;
    const c = samples[i * 3 + 2]!;
    const dy = a * ty + b * by + c * ny;
    if (dy <= 0) continue; // 지면
    const dx = a * tx + b * bx + c * nx;
    const dz = a * tz + b * bz + c * nz;
    rays++;
    if (!caster.isBlocked(px, py, pz, dx, dy, dz)) sky++;
  }
  return { svf: sky / n, rays };
}

/** 세대 [from, to)의 SVF를 out[0 .. to−from)에 채운다 (창문 법선은 수평) */
export function fillSkyView(
  positions: Float32Array,
  normals: Float32Array,
  from: number,
  to: number,
  samples: Float64Array,
  caster: RayCaster,
  out: Float32Array,
): number {
  let rays = 0;
  for (let u = from; u < to; u++) {
    const r = skyViewFactorAt(
      positions[u * 3]!,
      positions[u * 3 + 1]!,
      positions[u * 3 + 2]!,
      normals[u * 2]!,
      0,
      normals[u * 2 + 1]!,
      samples,
      caster,
    );
    out[u - from] = r.svf;
    rays += r.rays;
  }
  return rays;
}

/** 하늘 개방도 0~1 (가림 없는 수직 벽 = 1) */
export function skyOpenness(svf: number): number {
  return Math.min(1, svf / 0.5);
}
