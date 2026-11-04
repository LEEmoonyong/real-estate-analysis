import { describe, expect, it } from 'vitest';
import { sunEvents } from '../solar/sunEvents';
import { clampMinute, daylightRange, matchSeason, SEASON_PRESETS, seasonDate, spokenTime } from './seasons';

describe('절기 프리셋', () => {
  it('연도별 날짜 문자열', () => {
    const winter = SEASON_PRESETS.find((p) => p.id === 'winter')!;
    expect(seasonDate(2026, winter)).toBe('2026-12-22');
  });

  it('날짜 → 절기 판별 (연도 무관)', () => {
    expect(matchSeason('2031-06-21')).toBe('summer');
    expect(matchSeason('2026-06-22')).toBeNull();
  });
});

describe('daylightRange', () => {
  it('일출 내림·일몰 올림 (5분 단위)', () => {
    expect(daylightRange(457.3, 1037.8)).toEqual({ min: 455, max: 1040 });
    expect(daylightRange(455, 1040)).toEqual({ min: 455, max: 1040 });
  });

  it('극야·백야면 하루 전체', () => {
    expect(daylightRange(null, null)).toEqual({ min: 0, max: 1435 });
  });

  it('서울 동지 범위는 07:40 무렵 ~ 17:20 무렵', () => {
    const ev = sunEvents(37.5665, 126.978, '2026-12-22');
    const r = daylightRange(ev.sunriseMin, ev.sunsetMin);
    expect(r.min).toBeGreaterThanOrEqual(7 * 60 + 35);
    expect(r.min).toBeLessThanOrEqual(7 * 60 + 50);
    expect(r.max).toBeGreaterThanOrEqual(17 * 60 + 15);
    expect(r.max).toBeLessThanOrEqual(17 * 60 + 25);
  });

  it('clampMinute', () => {
    expect(clampMinute(300, { min: 455, max: 1040 })).toBe(455);
    expect(clampMinute(2000, { min: 455, max: 1040 })).toBe(1040);
    expect(clampMinute(720, { min: 455, max: 1040 })).toBe(720);
  });
});

it('spokenTime', () => {
  expect(spokenTime(13 * 60 + 20)).toBe('13시 20분');
  expect(spokenTime(7 * 60 + 5)).toBe('7시 5분');
});
