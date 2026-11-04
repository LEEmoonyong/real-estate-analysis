// 절기 프리셋과 시각 범위 (PLAN.md A2)
// 절기 날짜는 연도마다 하루 정도 달라지지만 일조 판단에 주는 영향이 작아 고정 근사값을 쓴다.
import { formatMinute } from './kst';

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonPreset {
  id: SeasonId;
  label: string;
  /** 'MM-DD' */
  monthDay: string;
  description: string;
}

export const SEASON_PRESETS: readonly SeasonPreset[] = [
  { id: 'spring', label: '춘분', monthDay: '03-20', description: '낮과 밤의 길이가 거의 같은 날 (3월 20일 무렵)' },
  { id: 'summer', label: '하지', monthDay: '06-21', description: '해가 가장 높고 낮이 가장 긴 날 (6월 21일 무렵)' },
  { id: 'autumn', label: '추분', monthDay: '09-23', description: '낮과 밤의 길이가 거의 같은 날 (9월 23일 무렵)' },
  {
    id: 'winter',
    label: '동지',
    monthDay: '12-22',
    description: '해가 가장 낮고 낮이 가장 짧은 날 (12월 22일 무렵) — 일조 참고 기준일',
  },
];

/** 해당 연도의 절기 날짜 'YYYY-MM-DD' */
export function seasonDate(year: number, preset: SeasonPreset): string {
  return `${String(year).padStart(4, '0')}-${preset.monthDay}`;
}

/** 날짜가 어느 절기 프리셋과 같으면 그 id (연도 무관) */
export function matchSeason(date: string): SeasonId | null {
  return SEASON_PRESETS.find((p) => date.slice(5) === p.monthDay)?.id ?? null;
}

/** 시각 슬라이더 간격 [분] */
export const TIME_STEP_MIN = 5;

export interface MinuteRange {
  min: number;
  max: number;
}

/**
 * 슬라이더 범위: 일출을 5분 단위로 내림 ~ 일몰을 5분 단위로 올림.
 * 극야·백야(국내에서는 생기지 않음)면 하루 전체.
 */
export function daylightRange(sunriseMin: number | null, sunsetMin: number | null): MinuteRange {
  if (sunriseMin === null || sunsetMin === null) return { min: 0, max: 1440 - TIME_STEP_MIN };
  return {
    min: Math.floor(sunriseMin / TIME_STEP_MIN) * TIME_STEP_MIN,
    max: Math.ceil(sunsetMin / TIME_STEP_MIN) * TIME_STEP_MIN,
  };
}

export function clampMinute(minute: number, range: MinuteRange): number {
  return Math.min(range.max, Math.max(range.min, minute));
}

/** 스크린 리더용 시각 표현: '13시 20분' */
export function spokenTime(minuteOfDay: number): string {
  const [h, m] = formatMinute(minuteOfDay).split(':');
  return `${Number(h)}시 ${Number(m)}분`;
}
