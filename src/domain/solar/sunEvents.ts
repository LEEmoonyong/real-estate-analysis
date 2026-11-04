// 일출·남중·일몰 (PLAN.md 9.1)
// 일출·일몰 정의: 태양 중심의 기하 고도 −0.833° (대기 굴절 34′ + 태양 반지름 16′) — NOAA 관례
import { julianDay, kstToUtcMs, KST_OFFSET_MIN } from '../time/kst';
import { solarCoordinates } from './solarPosition';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const SUNRISE_ZENITH_DEG = 90.833;

export interface SunEvents {
  /** KST 0시부터의 분. 극야·백야면 null */
  sunriseMin: number | null;
  solarNoonMin: number;
  sunsetMin: number | null;
  /** 남중 고도 [°] */
  noonAltitudeDeg: number;
  /** 낮 길이 [분] (극야 0, 백야 1440) */
  dayLengthMin: number;
  polar: 'day' | 'night' | null;
}

function coordsAt(date: string, minuteOfDay: number) {
  return solarCoordinates(julianDay(kstToUtcMs(date, minuteOfDay)));
}

/** 시간각 H0 [°] — 해가 이 시간각에서 기준 고도를 지난다. 없으면 NaN */
function hourAngleAtHorizon(lat: number, declinationDeg: number): number {
  const cosH0 =
    Math.cos(SUNRISE_ZENITH_DEG * RAD) / (Math.cos(lat * RAD) * Math.cos(declinationDeg * RAD)) -
    Math.tan(lat * RAD) * Math.tan(declinationDeg * RAD);
  return cosH0 < -1 || cosH0 > 1 ? NaN : Math.acos(cosH0) * DEG;
}

/** 남중 시각 [KST 분] = 720 − 4λ − EoT + 60·tz */
function solarNoonAt(lng: number, eqTimeMin: number): number {
  return 720 - 4 * lng - eqTimeMin + KST_OFFSET_MIN;
}

export function sunEvents(lat: number, lng: number, date: string): SunEvents {
  // 남중: 정오 근사값의 적위·균시차로 계산 → 그 시각으로 한 번 더 보정
  let noon = solarNoonAt(lng, coordsAt(date, 720).equationOfTimeMin);
  const noonCoords = coordsAt(date, noon);
  noon = solarNoonAt(lng, noonCoords.equationOfTimeMin);
  const noonAltitudeDeg = 90 - Math.abs(lat - noonCoords.declinationDeg);

  // 일출·일몰: 각 사건 시각의 적위·균시차로 2회 반복 보정 (±1분 정확도 목표)
  const event = (sign: -1 | 1): number | null => {
    let t = noon;
    for (let i = 0; i < 3; i++) {
      const c = coordsAt(date, t);
      const h0 = hourAngleAtHorizon(lat, c.declinationDeg);
      if (Number.isNaN(h0)) return null;
      t = solarNoonAt(lng, c.equationOfTimeMin) + sign * 4 * h0;
    }
    return t;
  };

  const sunriseMin = event(-1);
  const sunsetMin = event(1);
  if (sunriseMin === null || sunsetMin === null) {
    const polar = noonAltitudeDeg > -0.833 ? 'day' : 'night';
    return {
      sunriseMin: null,
      solarNoonMin: noon,
      sunsetMin: null,
      noonAltitudeDeg,
      dayLengthMin: polar === 'day' ? 1440 : 0,
      polar,
    };
  }
  return {
    sunriseMin,
    solarNoonMin: noon,
    sunsetMin,
    noonAltitudeDeg,
    dayLengthMin: sunsetMin - sunriseMin,
    polar: null,
  };
}
