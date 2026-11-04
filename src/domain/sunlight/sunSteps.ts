// 일조 판정 시각 칸 (PLAN.md 9.6)
//
// 칸은 시계 기준 Δ분 격자 [kΔ, (k+1)Δ)에 맞추고, 각 칸 중점 시각의 태양 방향으로 판정한다(중점 규칙).
// 격자를 시계에 맞추면 기준 구간(08:00~16:00, 09:00~15:00)의 경계와 칸 경계가 일치한다.
// 일출~일몰을 덮는 칸만 만들고, 중점에서 해가 지평선 아래인 칸은 방향을 0으로 둔다(항상 그늘).

import { solarPosition } from '../solar/solarPosition';
import { sunEvents } from '../solar/sunEvents';

export interface SunSteps {
  stepMinutes: number;
  /** 첫 칸의 시작 시각 [KST 분] */
  startMinute: number;
  /** 칸 수 K */
  count: number;
  /** 칸 중점의 태양 방향 (dx, dy, dz) × K. 해가 지평선 아래면 (0, 0, 0) */
  directions: Float32Array;
}

export function computeSunSteps(lat: number, lng: number, date: string, stepMinutes: number): SunSteps {
  const ev = sunEvents(lat, lng, date);
  const rise = ev.sunriseMin ?? (ev.polar === 'day' ? 0 : ev.solarNoonMin);
  const set = ev.sunsetMin ?? (ev.polar === 'day' ? 1440 : ev.solarNoonMin);
  const startMinute = Math.floor(rise / stepMinutes) * stepMinutes;
  const endMinute = Math.ceil(set / stepMinutes) * stepMinutes;
  const count = Math.max(0, Math.round((endMinute - startMinute) / stepMinutes));
  const directions = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    const mid = startMinute + (k + 0.5) * stepMinutes;
    const sun = solarPosition(lat, lng, date, mid);
    if (!sun.isUp) continue;
    directions[k * 3] = sun.direction[0];
    directions[k * 3 + 1] = sun.direction[1];
    directions[k * 3 + 2] = sun.direction[2];
  }
  return { stepMinutes, startMinute, count, directions };
}

/** k번째 칸의 시작 시각 [분] */
export function stepStartMinute(steps: Pick<SunSteps, 'startMinute' | 'stepMinutes'>, k: number): number {
  return steps.startMinute + k * steps.stepMinutes;
}
