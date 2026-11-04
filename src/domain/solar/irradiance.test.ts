import { describe, expect, it } from 'vitest';
import { computeSunSteps } from '../sunlight/sunSteps';
import {
  airMass,
  clearSky,
  dayOfYear,
  roofDailyIrradiance,
  solarPotentialKwh,
  unitDailyIrradiance,
} from './irradiance';
import { solarPosition } from './solarPosition';
import { sunEvents } from './sunEvents';

const SEOUL = { lat: 37.5665, lng: 126.978 };

describe('청천 일사 모델', () => {
  it('dayOfYear', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-03-20')).toBe(79);
    expect(dayOfYear('2024-12-31')).toBe(366);
  });

  it('대기 질량: 천정 1, 60°에서 약 2', () => {
    expect(airMass(0)).toBeCloseTo(1, 2);
    expect(airMass(60)).toBeCloseTo(2, 1);
  });

  it('서울 춘분 남중 수평면 GHI ≈ 800 ± 100 W/m²', () => {
    const date = '2026-03-20';
    const noon = sunEvents(SEOUL.lat, SEOUL.lng, date).solarNoonMin;
    const sun = solarPosition(SEOUL.lat, SEOUL.lng, date, noon);
    const { ghi } = clearSky(sun.direction[1], dayOfYear(date));
    expect(ghi).toBeGreaterThan(700);
    expect(ghi).toBeLessThan(900);
  });

  it('동지: 남향 벽 일적산 > 북향 벽, 가림이 전부면 산란·반사만', () => {
    const date = '2026-12-22';
    const steps = computeSunSteps(SEOUL.lat, SEOUL.lng, date, 10);
    const K = steps.count;
    const normals = new Float32Array([0, 1, 0, -1]); // 남향, 북향
    const allSun = new Uint8Array(2 * K).fill(1);
    const none = new Uint8Array(2 * K);
    const doy = dayOfYear(date);
    const [south, north] = unitDailyIrradiance(allSun, 2, steps.directions, K, 10, normals, doy, null);
    expect(south!).toBeGreaterThan(north! * 3);
    const [shadedSouth] = unitDailyIrradiance(none, 2, steps.directions, K, 10, normals, doy, null);
    expect(shadedSouth!).toBeLessThan(south! * 0.4);
    expect(shadedSouth!).toBeGreaterThan(0);
    // 천공률이 낮으면 산란이 줄어든다
    const [lowSvf] = unitDailyIrradiance(none, 2, steps.directions, K, 10, normals, doy, new Float32Array([0.1, 0.1]));
    expect(lowSvf!).toBeLessThan(shadedSouth!);
  });

  it('지붕: 하지 > 동지, 발전량 = 일사 × 면적 × 활용률 × 효율 × 성능비', () => {
    const roof = (date: string) => {
      const s = computeSunSteps(SEOUL.lat, SEOUL.lng, date, 10);
      return roofDailyIrradiance(s.directions, s.count, 10, dayOfYear(date), () => true);
    };
    const summer = roof('2026-06-21');
    const winter = roof('2026-12-22');
    expect(summer).toBeGreaterThan(winter * 2);
    expect(summer).toBeGreaterThan(6); // 맑은 날 하지 수평면 약 7~8 kWh/m²
    expect(summer).toBeLessThan(9.5);
    expect(solarPotentialKwh(5, 100, { efficiency: 0.2, usableRatio: 0.6, performanceRatio: 0.8 })).toBeCloseTo(48, 6);
  });
});
