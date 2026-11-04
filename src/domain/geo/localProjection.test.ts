import { describe, expect, it } from 'vitest';
import { createProjection, meridianRadius, primeVerticalRadius, projectRing } from './localProjection';

/**
 * Vincenty 역해 (WGS84) — 측지선 거리 참조 구현 (테스트 전용).
 * Vincenty, T. (1975) "Direct and Inverse Solutions of Geodesics on the Ellipsoid", Survey Review 23(176).
 */
function vincentyDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const a = 6_378_137;
  const f = 1 / 298.257223563;
  const b = (1 - f) * a;
  const rad = Math.PI / 180;
  const L = (lng2 - lng1) * rad;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * rad));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * rad));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1), sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
  let lambda = L;
  let sinSigma = 0, cosSigma = 0, sigma = 0, cos2Alpha = 0, cos2SigmaM = 0;
  for (let i = 0; i < 200; i++) {
    const sinL = Math.sin(lambda), cosL = Math.cos(lambda);
    sinSigma = Math.hypot(cosU2 * sinL, cosU1 * sinU2 - sinU1 * cosU2 * cosL);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinL) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cos2Alpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cos2Alpha;
    const C = (f / 16) * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha));
    const prev = lambda;
    lambda = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(lambda - prev) < 1e-12) break;
  }
  const u2 = (cos2Alpha * (a * a - b * b)) / (b * b);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dSigma =
    B * sinSigma * (cos2SigmaM + (B / 4) * (cosSigma * (-1 + 2 * cos2SigmaM ** 2) - (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return b * A * (sigma - dSigma);
}

const ORIGINS = [
  { name: '서울', lat: 37.5115, lng: 127.083 },
  { name: '부산', lat: 35.1567, lng: 129.145 },
  { name: '제주', lat: 33.4996, lng: 126.5312 },
];

describe('localProjection', () => {
  it('곡률 반경: 적도에서 M < N, 위도 37.5°의 값 범위', () => {
    expect(meridianRadius(0)).toBeLessThan(primeVerticalRadius(0));
    expect(meridianRadius(37.5)).toBeCloseTo(6_359_000, -4);
  });

  it('축 방향: 북쪽 점은 z < 0, 동쪽 점은 x > 0', () => {
    const p = createProjection(ORIGINS[0]!);
    const [, zNorth] = p.toLocal(127.083, 37.5125);
    const [xEast, zEast] = p.toLocal(127.084, 37.5115);
    expect(zNorth).toBeLessThan(0);
    expect(xEast).toBeGreaterThan(0);
    expect(zEast).toBeCloseTo(0, 9);
  });

  it.each(ORIGINS)('$name: 왕복 변환 오차 < 1e-6 m', (origin) => {
    const p = createProjection(origin);
    for (const [x, z] of [[123.4, -456.7], [-500, 500], [0, 0]] as const) {
      const [lng, lat] = p.toLngLat(x, z);
      const [x2, z2] = p.toLocal(lng, lat);
      expect(Math.abs(x2 - x)).toBeLessThan(1e-6);
      expect(Math.abs(z2 - z)).toBeLessThan(1e-6);
    }
  });

  it.each(ORIGINS)('$name: 반경 500m 안 8방향 거리가 Vincenty 측지 거리와 상대 오차 < 1e-4', (origin) => {
    const p = createProjection(origin);
    let worst = 0;
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4;
      for (const r of [100, 300, 500]) {
        const [lng, lat] = p.toLngLat(r * Math.sin(angle), -r * Math.cos(angle));
        const geodesic = vincentyDistance(origin.lat, origin.lng, lat, lng);
        worst = Math.max(worst, Math.abs(geodesic - r) / r);
      }
    }
    expect(worst).toBeLessThan(1e-4);
  });

  it('projectRing은 (x, z) 쌍을 Float64Array로 낸다', () => {
    const p = createProjection(ORIGINS[0]!);
    const ring = projectRing(p, [
      [127.083, 37.5115],
      [127.084, 37.5115],
      [127.084, 37.5125],
    ]);
    expect(ring).toHaveLength(6);
    expect(ring[0]).toBeCloseTo(0, 9);
    expect(ring[2]).toBeGreaterThan(80); // 동쪽 약 88m
    expect(ring[5]).toBeLessThan(-100); // 북쪽 약 111m
  });
});
