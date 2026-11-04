import { describe, expect, it } from 'vitest';
import { sunEvents } from './sunEvents';
import { directionAzimuthDeg, sunPath } from './sunPath';

const SEOUL = { lat: 37.5665, lng: 126.978 };

describe('sunPath', () => {
  it('남중점은 정남 (x ≈ 0, z > 0)', () => {
    const path = sunPath(SEOUL.lat, SEOUL.lng, '2026-12-22');
    const top = path.points.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(Math.abs(top[0])).toBeLessThan(0.02); // 5분 간격 샘플이라 최대 ~1.2° 차이
    expect(top[2]).toBeGreaterThan(0);
  });

  it('춘분 일출 방위 ≈ 90° (±1°), 일몰 ≈ 270°', () => {
    const path = sunPath(SEOUL.lat, SEOUL.lng, '2026-03-20');
    expect(Math.abs(directionAzimuthDeg(path.sunrise!.direction) - 90)).toBeLessThanOrEqual(1);
    expect(Math.abs(directionAzimuthDeg(path.sunset!.direction) - 270)).toBeLessThanOrEqual(1);
  });

  it('하지 일출은 북동, 동지 일출은 남동', () => {
    expect(directionAzimuthDeg(sunPath(SEOUL.lat, SEOUL.lng, '2026-06-21').sunrise!.direction)).toBeLessThan(70);
    expect(directionAzimuthDeg(sunPath(SEOUL.lat, SEOUL.lng, '2026-12-22').sunrise!.direction)).toBeGreaterThan(110);
  });

  it('점은 모두 단위 벡터, 지평선 위, 일출~일몰 5분 간격 + 끝점', () => {
    const date = '2026-12-22';
    const path = sunPath(SEOUL.lat, SEOUL.lng, date);
    const ev = sunEvents(SEOUL.lat, SEOUL.lng, date);
    for (const p of path.points) {
      expect(Math.hypot(...p)).toBeCloseTo(1, 9);
      expect(p[1]).toBeGreaterThanOrEqual(0);
    }
    const expected = Math.ceil((ev.sunsetMin! - ev.sunriseMin!) / 5);
    expect(Math.abs(path.points.length - expected)).toBeLessThanOrEqual(2);
    expect(
      path.hourMarks.every((m) => m.minute % 60 === 0 && m.minute > ev.sunriseMin! && m.minute < ev.sunsetMin!),
    ).toBe(true);
  });

  it('극야(북위 80°, 동지)는 빈 궤적', () => {
    expect(sunPath(80, 15, '2026-12-22').points).toEqual([]);
  });
});
