// 태양 경로 (PLAN.md 9.8) — 하루 동안 태양 방향 벡터의 궤적
// 일출~일몰을 5분 간격으로 샘플링하고, 일출·일몰 시각은 끝점으로 정확히 넣는다.
// 반환값은 단위 방향 벡터 — 3D에서는 반구 반지름 R을 곱해 그린다. 복잡도 O(K).
import type { Vec3 } from '../types';
import { solarPosition } from './solarPosition';
import { sunEvents } from './sunEvents';

export interface SunPathMark {
  minute: number;
  direction: Vec3;
}

export interface SunPath {
  /** 궤적 점 (단위 벡터, y는 0 이상으로 자름) — 해가 뜨지 않는 날은 빈 배열 */
  points: Vec3[];
  /** 정시 표시 (해가 떠 있는 시각만) */
  hourMarks: SunPathMark[];
  sunrise: SunPathMark | null;
  sunset: SunPathMark | null;
}

const clampToHorizon = ([x, y, z]: Vec3): Vec3 => {
  if (y >= 0) return [x, y, z];
  // 일출·일몰 기준 고도(−0.833°)는 지평선 살짝 아래 → 지평선 위로 올려 그린다
  const h = Math.hypot(x, z) || 1;
  return [x / h, 0, z / h];
};

export function sunPath(lat: number, lng: number, date: string, stepMinutes = 5): SunPath {
  const events = sunEvents(lat, lng, date);
  const dir = (m: number) => clampToHorizon(solarPosition(lat, lng, date, m).direction);

  if (events.polar === 'night') return { points: [], hourMarks: [], sunrise: null, sunset: null };
  const start = events.sunriseMin ?? 0;
  const end = events.sunsetMin ?? 1440;

  const points: Vec3[] = [dir(start)];
  for (let m = Math.ceil(start / stepMinutes) * stepMinutes; m < end; m += stepMinutes) {
    if (m > start) points.push(dir(m));
  }
  points.push(dir(end));

  const hourMarks: SunPathMark[] = [];
  for (let m = Math.ceil(start / 60) * 60; m < end; m += 60) hourMarks.push({ minute: m, direction: dir(m) });

  return {
    points,
    hourMarks,
    sunrise: events.sunriseMin === null ? null : { minute: start, direction: dir(start) },
    sunset: events.sunsetMin === null ? null : { minute: end, direction: dir(end) },
  };
}

/** 방향 벡터 → 방위각 [°] (북 = 0, 동 = 90) */
export function directionAzimuthDeg([x, , z]: Vec3): number {
  return ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
}
