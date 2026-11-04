// 태양 위치 검증 (PLAN.md 9.1)
// 1) NASA/JPL Horizons(DE441) 기준값 — 독립적인 고정밀 천체력
// 2) suncalc — 널리 쓰이는 저정밀 라이브러리 (테스트 전용 devDependency)
// 3) 천문학적 성질 (남중 방위, 절기별 남중 고도)
import { readFileSync } from 'node:fs';
import * as SunCalc from 'suncalc';
import { describe, expect, it } from 'vitest';
import { kstToUtcMs } from '../time/kst';
import { atmosphericRefractionDeg, solarPosition, sunDirection } from './solarPosition';
import { sunEvents } from './sunEvents';

interface ReferenceCase {
  site: string;
  lat: number;
  lng: number;
  date: string;
  samples: { kstMinute: number; azimuthDeg: number; altitudeDeg: number }[];
  sunriseKstMinute: number;
  sunsetKstMinute: number;
}

const reference = JSON.parse(readFileSync('src/test/fixtures/sun-reference.json', 'utf8')) as {
  cases: ReferenceCase[];
};

/** 방위각 차이 (0/360 경계 처리) */
const azDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('solarPosition vs JPL Horizons', () => {
  const rows = reference.cases.flatMap((c) =>
    c.samples.map((s) => ({ ...s, site: c.site, date: c.date, lat: c.lat, lng: c.lng })),
  );

  it(`기준값 ${rows.length}개 모두 고도·방위 오차 < 0.02° (실측 최대 0.007°)`, () => {
    let maxAlt = 0;
    let maxAz = 0;
    for (const r of rows) {
      const p = solarPosition(r.lat, r.lng, r.date, r.kstMinute);
      maxAlt = Math.max(maxAlt, Math.abs(p.altitudeDeg - r.altitudeDeg));
      maxAz = Math.max(maxAz, azDiff(p.azimuthDeg, r.azimuthDeg));
    }
    expect(maxAlt).toBeLessThan(0.02);
    expect(maxAz).toBeLessThan(0.02);
  });

  it.each(reference.cases.map((c) => [c.site, c.date, c] as const))('%s %s 일출·일몰 ±0.5분', (_s, _d, c) => {
    const ev = sunEvents(c.lat, c.lng, c.date);
    expect(Math.abs(ev.sunriseMin! - c.sunriseKstMinute)).toBeLessThan(0.5);
    expect(Math.abs(ev.sunsetMin! - c.sunsetKstMinute)).toBeLessThan(0.5);
  });
});

describe('solarPosition vs suncalc', () => {
  const sites = [
    { lat: 37.5665, lng: 126.978 },
    { lat: 35.1796, lng: 129.0756 },
    { lat: 33.4996, lng: 126.5312 },
  ];
  const dates = ['2026-03-20', '2026-06-21', '2026-12-22'];

  it('고도 2° 이상 구간에서 차이 < 0.2° (suncalc 고도는 대기 굴절 포함 → 같은 보정을 더해 비교)', () => {
    let checked = 0;
    for (const { lat, lng } of sites) {
      for (const date of dates) {
        for (let minute = 6 * 60; minute <= 18 * 60; minute += 30) {
          const ours = solarPosition(lat, lng, date, minute);
          if (ours.altitudeDeg < 2) continue;
          const sc = SunCalc.getPosition(new Date(kstToUtcMs(date, minute)), lat, lng);
          // suncalc 2.x: 도 단위, 방위각은 북 기준 시계 방향 (1.x의 라디안·남 기준과 다름)
          const scAz = sc.azimuth;
          const scAlt = sc.altitude;
          const ourApparent = ours.altitudeDeg + atmosphericRefractionDeg(ours.altitudeDeg);
          expect(Math.abs(ourApparent - scAlt)).toBeLessThan(0.2);
          expect(azDiff(ours.azimuthDeg, scAz)).toBeLessThan(0.2);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
});

describe('천문학적 성질', () => {
  const SEOUL = { lat: 37.5665, lng: 126.978 };

  it('남중 시각에 방위각 ≈ 180°', () => {
    for (const date of ['2026-03-20', '2026-06-21', '2026-12-22']) {
      const { solarNoonMin } = sunEvents(SEOUL.lat, SEOUL.lng, date);
      const p = solarPosition(SEOUL.lat, SEOUL.lng, date, solarNoonMin);
      expect(azDiff(p.azimuthDeg, 180)).toBeLessThan(0.1);
    }
  });

  it('서울 남중 시각은 경도 차이만큼 12시보다 늦다 (약 12:20~12:45)', () => {
    const { solarNoonMin } = sunEvents(SEOUL.lat, SEOUL.lng, '2026-12-22');
    expect(solarNoonMin).toBeGreaterThan(12 * 60 + 20);
    expect(solarNoonMin).toBeLessThan(12 * 60 + 45);
  });

  it('하지 남중 고도 ≈ 90 − φ + 23.44°, 동지 ≈ 90 − φ − 23.44°', () => {
    expect(sunEvents(SEOUL.lat, SEOUL.lng, '2026-06-21').noonAltitudeDeg).toBeCloseTo(90 - SEOUL.lat + 23.44, 0);
    expect(sunEvents(SEOUL.lat, SEOUL.lng, '2026-12-22').noonAltitudeDeg).toBeCloseTo(90 - SEOUL.lat - 23.44, 0);
  });

  it('동지에는 낮이 짧고 하지에는 길다', () => {
    const winter = sunEvents(SEOUL.lat, SEOUL.lng, '2026-12-22').dayLengthMin;
    const summer = sunEvents(SEOUL.lat, SEOUL.lng, '2026-06-21').dayLengthMin;
    expect(winter).toBeLessThan(10 * 60);
    expect(summer).toBeGreaterThan(14 * 60);
  });

  it('극지방 백야·극야를 처리한다', () => {
    expect(sunEvents(78, 15, '2026-06-21')).toMatchObject({ polar: 'day', sunriseMin: null, dayLengthMin: 1440 });
    expect(sunEvents(78, 15, '2026-12-22')).toMatchObject({ polar: 'night', sunsetMin: null, dayLengthMin: 0 });
  });
});

describe('sunDirection (축 규칙: x=동, y=위, z=남)', () => {
  const close = (v: number[], e: number[]) => v.forEach((x, i) => expect(x).toBeCloseTo(e[i]!, 10));

  it('정남·고도 0 → +z', () => close(sunDirection(0, 180), [0, 0, 1]));
  it('정동·고도 0 → +x', () => close(sunDirection(0, 90), [1, 0, 0]));
  it('정북 → −z', () => close(sunDirection(0, 0), [0, 0, -1]));
  it('천정 → +y', () => close(sunDirection(90, 123), [0, 1, 0]));
  it('항상 단위 벡터', () => {
    const [x, y, z] = sunDirection(31.4, 211);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
  });
});
