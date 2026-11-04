// 태양 고도 → 조명 세기·하늘색 (컴포넌트와 분리해 단위 테스트)
// 물리적으로 정확한 하늘 모델이 아니라, 시각 변화를 알아보기 쉽게 하는 표현용 근사다.

export interface LightingLevels {
  /** 태양 직사광 세기 (지평선 아래면 0) */
  sunIntensity: number;
  /** 하늘·지면 반사광(HemisphereLight) 세기 */
  ambientIntensity: number;
  /** 배경 하늘색 '#rrggbb' */
  skyColor: string;
  /** 직사광 색 (낮을수록 주황빛) */
  sunColor: string;
}

const NIGHT_SKY = [0x1f, 0x27, 0x38];
const TWILIGHT_SKY = [0xf0, 0xc9, 0xa4];
const DAY_SKY = [0xcf, 0xe3, 0xf5];
const LOW_SUN = [0xff, 0xc8, 0x8a];
const HIGH_SUN = [0xff, 0xf8, 0xee];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * t));
const hex = (rgb: number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function lightingForAltitude(altitudeDeg: number): LightingLevels {
  // −6°(시민 박명 끝) ~ 0°: 밤 → 노을, 0° ~ 12°: 노을 → 낮
  const dusk = smoothstep(-6, 0, altitudeDeg);
  const day = smoothstep(0, 12, altitudeDeg);
  const sky = altitudeDeg < 0 ? mix(NIGHT_SKY, TWILIGHT_SKY, dusk) : mix(TWILIGHT_SKY, DAY_SKY, day);
  return {
    sunIntensity: altitudeDeg > 0 ? 0.6 + 1.9 * smoothstep(0, 30, altitudeDeg) : 0,
    ambientIntensity: 0.25 + 0.6 * dusk * (0.5 + 0.5 * day),
    skyColor: hex(sky),
    sunColor: hex(mix(LOW_SUN, HIGH_SUN, smoothstep(2, 25, altitudeDeg))),
  };
}

/**
 * 그림자 카메라 범위: 장면을 감싸는 구(반경 r, 최고 높이 h)를 태양 방향에서 본 직교 투영.
 * 구 반지름을 쓰면 태양 방향과 관계없이 장면 전체가 들어간다.
 */
export function shadowFrustum(radiusM: number, maxHeightM: number) {
  const r = Math.hypot(Math.max(radiusM, 50), maxHeightM) * 1.05;
  return { halfSize: r, distance: r * 2, near: r * 0.5, far: r * 3.5 };
}
