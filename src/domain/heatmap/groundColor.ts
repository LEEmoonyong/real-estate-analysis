// 지면 그림자 색 (PLAN.md 9.11) — 그림자가 길수록 진한 남색 반투명, 그림자 없음은 투명, 건물 안(NaN)은 투명
// 지면 위에 덮는 오버레이라 "어두울수록 오래 그늘"이 직관적이다. 밝기만으로 구분되므로 색각 이상에도 읽힌다.

export const GROUND_SHADOW_RGB = [0x31, 0x2e, 0x81] as const; // indigo-900
const MIN_ALPHA = 0.12;
const MAX_ALPHA = 0.82;

/** 그림자 시간 → 불투명도 0~1 */
export function groundShadowAlpha(minutes: number, windowMinutes: number): number {
  if (!(minutes > 0) || windowMinutes <= 0) return 0; // NaN·0
  const t = Math.min(1, minutes / windowMinutes);
  return MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * t;
}

/**
 * 셀 배열(행 0 = 북쪽) → RGBA8 텍스처 데이터.
 * 지면 평면의 텍스처 v=0이 남쪽이므로 행 순서를 뒤집어 쓴다.
 */
export function groundTextureData(
  shadowMinutes: Float32Array,
  cols: number,
  rows: number,
  windowMinutes: number,
): Uint8Array {
  const data = new Uint8Array(cols * rows * 4);
  const [r, g, b] = GROUND_SHADOW_RGB;
  for (let row = 0; row < rows; row++) {
    const texRow = rows - 1 - row;
    for (let col = 0; col < cols; col++) {
      const o = (texRow * cols + col) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = Math.round(groundShadowAlpha(shadowMinutes[row * cols + col]!, windowMinutes) * 255);
    }
  }
  return data;
}

/** 범례용 CSS 그라데이션 */
export function groundLegendGradient(): string {
  const [r, g, b] = GROUND_SHADOW_RGB;
  return `linear-gradient(to right, rgb(${r} ${g} ${b} / ${MIN_ALPHA}), rgb(${r} ${g} ${b} / ${MAX_ALPHA}))`;
}
