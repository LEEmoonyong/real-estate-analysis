// 방위각 → 8방위 이름 (북 = 0°, 시계 방향)

const COMPASS_8 = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const;

export function compass8(azimuthDeg: number): string {
  const a = ((azimuthDeg % 360) + 360) % 360;
  return COMPASS_8[Math.round(a / 45) % 8]!;
}
