// 일조 히트맵 색상 (PLAN.md A5)
//
// 값: 기준 총량 구간(기본 08~16시) 일조 시간 — 0~8시간이라 범례 0~8h+와 정확히 맞고, 참고 기준(총 4시간)과 바로 비교된다.
// 팔레트: viridis 계열 순차 팔레트. 밝기가 단조 증가해 색각 이상이나 흑백 인쇄에서도 많고 적음이 구분된다.

export type Rgb = readonly [number, number, number];

/** viridis 9단계 (0h, 1h, …, 8h) — matplotlib viridis 표본값 */
export const SUNLIGHT_STOPS: readonly string[] = [
  '#440154',
  '#472d7b',
  '#3b528b',
  '#2c728e',
  '#21918c',
  '#28ae80',
  '#5ec962',
  '#addc30',
  '#fde725',
];

export const SUNLIGHT_MAX_MINUTES = 8 * 60;

export function hexToRgb(hex: string): Rgb {
  const v = Number.parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const STOPS_RGB = SUNLIGHT_STOPS.map(hexToRgb);

/** 일조 시간 [분] → 색 (0~1 RGB, sRGB). 8시간 이상은 같은 색 */
export function sunlightColor(minutes: number): Rgb {
  return viridisColor(minutes / SUNLIGHT_MAX_MINUTES);
}

/** 0~1 → viridis 색 (모든 세대 레이어 공용: 일조·천공률·일사량) */
export function viridisColor(ratio: number): Rgb {
  const t = Math.min(1, Math.max(0, ratio)) * (STOPS_RGB.length - 1);
  const i = Math.min(STOPS_RGB.length - 2, Math.floor(t));
  const f = t - i;
  const a = STOPS_RGB[i]!;
  const b = STOPS_RGB[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** 상대 휘도 (WCAG) — 팔레트 단조성 검증용 */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** 범례 CSS 그라디언트 */
export function legendGradient(): string {
  return `linear-gradient(to right, ${SUNLIGHT_STOPS.join(', ')})`;
}
