// 태양 위치 계산 — NOAA Solar Calculator 방식 직접 구현 (PLAN.md 9.1)
// 출처: NOAA Global Monitoring Laboratory, Solar Calculation Details
//       (Jean Meeus, "Astronomical Algorithms" 기반 스프레드시트 식)
// 기호: φ 위도, λ 경도(동경 +), δ 적위, H 시간각, h 고도각, A 방위각(북=0°, 시계 방향)
import { julianCentury, julianDay, kstToUtcMs } from '../time/kst';
import type { Vec3 } from '../types';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const sinD = (d: number) => Math.sin(d * RAD);
const cosD = (d: number) => Math.cos(d * RAD);
const tanD = (d: number) => Math.tan(d * RAD);
const mod360 = (d: number) => ((d % 360) + 360) % 360;

export interface SolarCoordinates {
  /** 태양 적위 δ [°] */
  declinationDeg: number;
  /** 균시차 [분] (진태양시 − 평균태양시) */
  equationOfTimeMin: number;
}

export interface SunPosition {
  /** 기하학적 고도각 [°] (대기 굴절 미적용) */
  altitudeDeg: number;
  /** 방위각 [°] 북=0, 동=90, 남=180, 서=270 */
  azimuthDeg: number;
  /** 로컬 좌표계 단위 방향 벡터 (x=동, y=위, z=남) — 태양 쪽을 가리킴 */
  direction: Vec3;
  /** 고도각 > 0 */
  isUp: boolean;
}

/** 율리우스일 → 적위·균시차 (NOAA 스프레드시트 식) */
export function solarCoordinates(jd: number): SolarCoordinates {
  const T = julianCentury(jd);
  const L0 = mod360(280.46646 + T * (36000.76983 + 0.0003032 * T)); // 평균 황경
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T); // 평균 근점이각
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T); // 궤도 이심률
  const C =
    sinD(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    sinD(2 * M) * (0.019993 - 0.000101 * T) +
    sinD(3 * M) * 0.000289; // 중심차
  const trueLong = L0 + C; // 진황경
  const omega = 125.04 - 1934.136 * T;
  const apparentLong = trueLong - 0.00569 - 0.00478 * sinD(omega); // 겉보기 황경 (장동·광행차 보정)
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60; // 평균 황도경사
  const eps = eps0 + 0.00256 * cosD(omega); // 보정 황도경사
  const declinationDeg = Math.asin(sinD(eps) * sinD(apparentLong)) * DEG;

  const y = tanD(eps / 2) ** 2;
  const eqTimeRad =
    y * sinD(2 * L0) -
    2 * e * sinD(M) +
    4 * e * y * sinD(M) * cosD(2 * L0) -
    0.5 * y * y * sinD(4 * L0) -
    1.25 * e * e * sinD(2 * M);
  return { declinationDeg, equationOfTimeMin: 4 * eqTimeRad * DEG };
}

/** 고도각·방위각 → 로컬 방향 벡터 (x=동, y=위, z=남; 북 = −z) */
export function sunDirection(altitudeDeg: number, azimuthDeg: number): Vec3 {
  const cosH = cosD(altitudeDeg);
  return [cosH * sinD(azimuthDeg), sinD(altitudeDeg), -cosH * cosD(azimuthDeg)];
}

/** 율리우스일과 관측 위치에서의 태양 위치 */
export function solarPositionAtJd(lat: number, lng: number, jd: number): SunPosition {
  const { declinationDeg: dec, equationOfTimeMin } = solarCoordinates(jd);
  // UTC 기준 그날 0시부터의 분
  const utcMinutes = (((jd - 0.5) % 1) + 1) % 1 * 1440;
  const trueSolarTime = (((utcMinutes + equationOfTimeMin + 4 * lng) % 1440) + 1440) % 1440; // [분]
  const hourAngle = trueSolarTime / 4 - 180; // [°] 남중 = 0, 오후 +

  const cosZenith = sinD(lat) * sinD(dec) + cosD(lat) * cosD(dec) * cosD(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith))) * DEG;
  const altitudeDeg = 90 - zenith;

  // atan2 형태가 acos 형태보다 수치적으로 안정적이다 (남중 부근·고위도)
  const azimuthDeg = mod360(
    Math.atan2(sinD(hourAngle), cosD(hourAngle) * sinD(lat) - tanD(dec) * cosD(lat)) * DEG + 180,
  );

  return { altitudeDeg, azimuthDeg, direction: sunDirection(altitudeDeg, azimuthDeg), isUp: altitudeDeg > 0 };
}

/**
 * KST 날짜·시각에서의 태양 위치.
 * @param date 'YYYY-MM-DD' (KST)
 * @param minuteOfDay KST 0시부터의 분
 */
export function solarPosition(lat: number, lng: number, date: string, minuteOfDay: number): SunPosition {
  return solarPositionAtJd(lat, lng, julianDay(kstToUtcMs(date, minuteOfDay)));
}

/**
 * 대기 굴절에 의한 고도 보정량 [°] (Sæmundsson 1986 식, 표준 기압·기온).
 * 기본 일조 판정에는 쓰지 않는다(보수적 기하 고도 사용). 설정에서 켤 때와 검증용.
 */
export function atmosphericRefractionDeg(altitudeDeg: number): number {
  if (altitudeDeg < -1) return 0;
  const h = Math.max(altitudeDeg, -0.5);
  // R[′] = 1.02 / tan(h + 10.3/(h + 5.11)), h는 도 단위
  return 1.02 / tanD(h + 10.3 / (h + 5.11)) / 60;
}
