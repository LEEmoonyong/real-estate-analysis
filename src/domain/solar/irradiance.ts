// 일사량 추정 — 청천(맑은 날) 모델 (PLAN.md 9.10)
// G = vis · DNI · max(0, cos θi) + DHI · F_sky + ρg · GHI · (1 − cos β)/2
// - I0 = 1361 · (1 + 0.033 cos(2π n/365))            태양 상수 (Kopp & Lean 2011)
// - AM = 1 / (cos θz + 0.50572 (96.07995 − θz)^−1.6364) (Kasten & Young 1989)
// - DNI = I0 · 0.7^(AM^0.678)                          (Meinel & Meinel 1976)
// - DHI = 0.1 · DNI, GHI = DNI cos θz + DHI
// - F_sky: 천공률(SVF)이 있으면 그 값, 없으면 등방 (1 + cos β)/2
// 실제 구름·미세먼지는 반영하지 않은 "맑은 날 상한" 추정치다.

export const SOLAR_CONSTANT = 1361;
export const DEFAULT_ALBEDO = 0.2;
export const DIFFUSE_RATIO = 0.1;

/** 'YYYY-MM-DD' → 1월 1일 = 1 */
export function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

export function extraterrestrial(doy: number): number {
  return SOLAR_CONSTANT * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
}

/** 대기 질량 — 천정각 [°] */
export function airMass(zenithDeg: number): number {
  if (zenithDeg >= 90) return Infinity;
  return 1 / (Math.cos((zenithDeg * Math.PI) / 180) + 0.50572 * (96.07995 - zenithDeg) ** -1.6364);
}

export interface ClearSky {
  dni: number;
  dhi: number;
  ghi: number;
}

/** 태양 방향 y 성분(= sin 고도)으로 청천 일사 [W/m²] */
export function clearSky(sinAltitude: number, doy: number): ClearSky {
  if (sinAltitude <= 0) return { dni: 0, dhi: 0, ghi: 0 };
  const zenith = (Math.acos(Math.min(1, sinAltitude)) * 180) / Math.PI;
  const dni = extraterrestrial(doy) * 0.7 ** (airMass(zenith) ** 0.678);
  const dhi = DIFFUSE_RATIO * dni;
  return { dni, dhi, ghi: dni * sinAltitude + dhi };
}

/**
 * 면 하나의 순간 일사 [W/m²]
 * @param cosIncidence n · d (음수면 직달 0)
 * @param cosTilt 면 기울기 cos β (벽 0, 지붕 1)
 * @param fSky 천공 산란 형태계수 (없으면 등방값)
 */
export function surfaceIrradiance(
  sky: ClearSky,
  visible: boolean,
  cosIncidence: number,
  cosTilt: number,
  fSky = (1 + cosTilt) / 2,
  albedo = DEFAULT_ALBEDO,
): number {
  const direct = visible ? sky.dni * Math.max(0, cosIncidence) : 0;
  return direct + sky.dhi * fSky + albedo * sky.ghi * ((1 - cosTilt) / 2);
}

/**
 * 세대별 하루 일사량 [kWh/m²·day] — 일조 가시성 마스크를 그대로 재사용한다(광선 추가 없음).
 * @param mask 세대 × K 가시성 (1 = 직사광)
 * @param svf 세대별 천공률 (없으면 등방 0.5)
 */
export function unitDailyIrradiance(
  mask: Uint8Array,
  unitCount: number,
  directions: Float32Array,
  stepCount: number,
  stepMinutes: number,
  normals: Float32Array,
  doy: number,
  svf: Float32Array | null,
): Float32Array {
  const skies = Array.from({ length: stepCount }, (_, k) => clearSky(directions[k * 3 + 1]!, doy));
  const out = new Float32Array(unitCount);
  const hours = stepMinutes / 60;
  for (let u = 0; u < unitCount; u++) {
    const nx = normals[u * 2]!;
    const nz = normals[u * 2 + 1]!;
    const fSky = svf ? svf[u]! : 0.5;
    let wh = 0;
    for (let k = 0; k < stepCount; k++) {
      const sky = skies[k]!;
      if (sky.ghi === 0) continue;
      const cosI = nx * directions[k * 3]! + nz * directions[k * 3 + 2]!;
      wh += surfaceIrradiance(sky, mask[u * stepCount + k] === 1, cosI, 0, fSky) * hours;
    }
    out[u] = wh / 1000;
  }
  return out;
}

/** 수평 지붕 하루 일사량 [kWh/m²·day] — visible(k)는 지붕 중심에서 태양 쪽 광선이 막히지 않는지 */
export function roofDailyIrradiance(
  directions: Float32Array,
  stepCount: number,
  stepMinutes: number,
  doy: number,
  visible: (k: number) => boolean,
): number {
  let wh = 0;
  for (let k = 0; k < stepCount; k++) {
    const dy = directions[k * 3 + 1]!;
    const sky = clearSky(dy, doy);
    if (sky.ghi === 0) continue;
    wh += surfaceIrradiance(sky, visible(k), dy, 1) * (stepMinutes / 60);
  }
  return wh / 1000;
}

export interface SolarPotentialOptions {
  /** 패널 효율 η (기본 0.20) */
  efficiency: number;
  /** 지붕 활용률 (기본 0.6) */
  usableRatio: number;
  /** 성능비 PR (기본 0.8) */
  performanceRatio: number;
}

export const DEFAULT_SOLAR_OPTIONS: SolarPotentialOptions = {
  efficiency: 0.2,
  usableRatio: 0.6,
  performanceRatio: 0.8,
};

/** 옥상 태양광 하루 발전량 [kWh/day] */
export function solarPotentialKwh(roofKwhPerM2: number, roofAreaM2: number, o: SolarPotentialOptions): number {
  return roofKwhPerM2 * roofAreaM2 * o.usableRatio * o.efficiency * o.performanceRatio;
}

/** 일사량 범례 상한 [kWh/m²] — 값 분포의 95% 지점을 0.5 단위로 올림 (최소 1) */
export function irradianceScaleMax(values: Float32Array): number {
  if (values.length === 0) return 1;
  const sorted = Float32Array.from(values).sort();
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 1;
  return Math.max(1, Math.ceil(p95 * 2) / 2);
}
