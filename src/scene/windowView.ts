// 창문 시점 시선 계산 (C7) — three.js와 무관한 순수 함수

const RAD = Math.PI / 180;
/** 둘러보기 범위: 좌우 ±80°, 위아래 −30°~+70° */
export const YAW_LIMIT = 80 * RAD;
export const PITCH_MIN = -30 * RAD;
export const PITCH_MAX = 70 * RAD;

/** 창문 법선 (nx, nz)와 둘러보기 각도 → 시선 방향 단위 벡터 */
export function windowLookDirection(nx: number, nz: number, yaw: number, pitch: number): [number, number, number] {
  const a = Math.atan2(nx, nz) + yaw;
  return [Math.sin(a) * Math.cos(pitch), Math.sin(pitch), Math.cos(a) * Math.cos(pitch)];
}

/** 끈 거리 → 제한 범위 안의 (yaw, pitch) */
export function clampLook(yaw: number, pitch: number): { yaw: number; pitch: number } {
  return {
    yaw: Math.min(YAW_LIMIT, Math.max(-YAW_LIMIT, yaw)),
    pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch)),
  };
}
