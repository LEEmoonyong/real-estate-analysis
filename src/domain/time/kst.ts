// KST(UTC+9) 날짜·시각 ↔ UTC·율리우스일 변환 (PLAN.md 9.1)
// 실행 PC의 시간대와 무관하도록 Date의 로컬 메서드(getHours 등)를 쓰지 않는다.

export const KST_OFFSET_MIN = 9 * 60;
const MS_PER_DAY = 86_400_000;
/** 1970-01-01T00:00Z의 율리우스일 */
const JD_UNIX_EPOCH = 2_440_587.5;
/** J2000.0 (2000-01-01T12:00 TT)의 율리우스일 */
export const JD_J2000 = 2_451_545.0;

export interface YMD {
  year: number;
  month: number; // 1~12
  day: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → {year, month, day}. 형식·범위가 잘못되면 예외 */
export function parseDate(date: string): YMD {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`날짜 형식이 올바르지 않습니다: ${date}`);
  const ymd = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  // 2월 30일 같은 값은 Date.UTC가 다음 달로 넘기므로 왕복 비교로 걸러낸다
  const check = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  if (check.getUTCMonth() !== ymd.month - 1 || check.getUTCDate() !== ymd.day) {
    throw new RangeError(`존재하지 않는 날짜입니다: ${date}`);
  }
  return ymd;
}

export function isValidDate(date: string): boolean {
  try {
    parseDate(date);
    return true;
  } catch {
    return false;
  }
}

/** KST 날짜 + 그날 0시부터의 분 → UTC 밀리초 */
export function kstToUtcMs(date: string, minuteOfDay: number): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day) + (minuteOfDay - KST_OFFSET_MIN) * 60_000;
}

/** UTC 밀리초 → KST 날짜와 분 */
export function utcMsToKst(ms: number): { date: string; minuteOfDay: number } {
  const kst = new Date(ms + KST_OFFSET_MIN * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`,
    minuteOfDay: kst.getUTCHours() * 60 + kst.getUTCMinutes() + kst.getUTCSeconds() / 60 + kst.getUTCMilliseconds() / 60_000,
  };
}

/** UTC 밀리초 → 율리우스일 */
export function julianDay(utcMs: number): number {
  return utcMs / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** 율리우스 세기 (J2000.0 기준) */
export function julianCentury(jd: number): number {
  return (jd - JD_J2000) / 36_525;
}

/** 1월 1일 = 1 */
export function dayOfYear(date: string): number {
  const { year, month, day } = parseDate(date);
  return (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / MS_PER_DAY + 1;
}

/** 분 → 'HH:MM' (반올림, 24:00 이상은 다음 날로 넘기지 않고 그대로 표기) */
export function formatMinute(minuteOfDay: number): string {
  const total = Math.round(minuteOfDay);
  const h = Math.floor(total / 60);
  const m = total - h * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
