// [요구사항: Hooks] 커스텀 훅 — 위치·날짜·시각 → 태양 고도·방위·방향 벡터 (useMemo로 입력이 바뀔 때만 계산)
import { useMemo } from 'react';
import { solarPosition, type SunPosition } from '../domain/solar/solarPosition';
import { sunEvents, type SunEvents } from '../domain/solar/sunEvents';

export function useSunPosition(lat: number, lng: number, date: string, minuteOfDay: number): SunPosition {
  return useMemo(() => solarPosition(lat, lng, date, minuteOfDay), [lat, lng, date, minuteOfDay]);
}

/** 일출·남중·일몰 — 날짜·위치가 바뀔 때만 계산 */
export function useSunEvents(lat: number, lng: number, date: string): SunEvents {
  return useMemo(() => sunEvents(lat, lng, date), [lat, lng, date]);
}
