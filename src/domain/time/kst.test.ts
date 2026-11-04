import { describe, expect, it } from 'vitest';
import { dayOfYear, formatMinute, isValidDate, julianDay, kstToUtcMs, parseDate, utcMsToKst } from './kst';

describe('KST 변환', () => {
  it('KST 09:00 = UTC 00:00', () => {
    expect(new Date(kstToUtcMs('2026-12-22', 9 * 60)).toISOString()).toBe('2026-12-22T00:00:00.000Z');
  });

  it('KST 새벽은 UTC 전날', () => {
    expect(new Date(kstToUtcMs('2026-01-01', 3 * 60)).toISOString()).toBe('2025-12-31T18:00:00.000Z');
  });

  it('왕복 변환', () => {
    const ms = kstToUtcMs('2026-06-21', 13 * 60 + 25);
    expect(utcMsToKst(ms)).toEqual({ date: '2026-06-21', minuteOfDay: 13 * 60 + 25 });
  });
});

describe('julianDay', () => {
  it('J2000.0 (2000-01-01T12:00Z) = 2451545.0', () => {
    expect(julianDay(Date.UTC(2000, 0, 1, 12))).toBe(2_451_545);
  });
  it('유닉스 기점 = 2440587.5', () => {
    expect(julianDay(0)).toBe(2_440_587.5);
  });
});

describe('날짜 검증', () => {
  it('정상 날짜', () => {
    expect(parseDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });
  it.each(['2026-02-29', '2026-13-01', '2026-1-1', 'abc', ''])('%o 는 거부', (d) => {
    expect(isValidDate(d)).toBe(false);
  });
});

describe('dayOfYear', () => {
  it.each([
    ['2026-01-01', 1],
    ['2026-12-31', 365],
    ['2028-12-31', 366],
  ])('%s → %i', (d, n) => expect(dayOfYear(d)).toBe(n));
});

describe('formatMinute', () => {
  it.each([
    [0, '00:00'],
    [463.45, '07:43'],
    [1196.6, '19:57'],
  ])('%o → %s', (m, s) => expect(formatMinute(m)).toBe(s));
});
