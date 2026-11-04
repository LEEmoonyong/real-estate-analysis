// [요구사항: 상태관리] 공유 상태 — 계절 타임랩스 (C11): 켜짐·재생·속도·월별 요약 (useState)
// [요구사항: Hooks] useSeasonTimelapse — useEffect(setInterval로 월 넘기기, 정리)
// 재생은 전역 날짜를 매월 21일로 바꾸는 방식이다. 대표일 결과는 미리 계산해 일조 캐시에 넣어 두므로
// 날짜를 바꾸는 즉시 히트맵·태양 경로·그림자·세대 상세가 모두 그 달로 바뀐다(따로 그리는 경로가 없음).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { monthDate, representativeMonth } from '../domain/time/season';
import { useSceneData } from './SceneDataContext';
import { useTime, useTimeActions } from './TimeContext';

/** 한 달(대표일)의 세대별 요약 — 마스크는 버리고 필요한 값만 둔다 */
export interface MonthSummary {
  date: string;
  /** 세대별 08~16시 총 일조 [분] */
  windowTotal: Uint16Array;
  /** 세대별 하루 일사량 [kWh/m²] (맑은 날) */
  irradiance: Float32Array;
  /** 주향 세대 평균·하위 10% [분] */
  mean: number;
  p10: number;
}

export type SeasonSpeed = 0.5 | 1 | 2;

interface SeasonState {
  active: boolean;
  playing: boolean;
  /** 한 달에 머무는 시간 [초] */
  speed: SeasonSpeed;
  /** 지금 장면의 월별 요약 (계산된 달만) */
  months: (MonthSummary | null)[];
  /** 지금 날짜가 대표일이면 월 인덱스 */
  currentMonth: number;
  year: number;
}

interface SeasonActions {
  setActive: (active: boolean) => void;
  togglePlay: () => void;
  setSpeed: (speed: SeasonSpeed) => void;
  goToMonth: (m: number) => void;
  /** 계산 훅이 한 달씩 넣는다 */
  putMonth: (sceneHash: string, m: number, summary: MonthSummary) => void;
}

const SeasonStateContext = createContext<SeasonState | null>(null);
const SeasonActionsContext = createContext<SeasonActions | null>(null);

const EMPTY_MONTHS: (MonthSummary | null)[] = Array.from({ length: 12 }, () => null);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { sceneHash } = useSceneData();
  const { date } = useTime();
  const { setDate } = useTimeActions();
  const [active, setActiveState] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SeasonSpeed>(1);
  const [store, setStore] = useState<{ sceneHash: string; months: (MonthSummary | null)[] }>({
    sceneHash: '',
    months: EMPTY_MONTHS,
  });
  const months = store.sceneHash === sceneHash ? store.months : EMPTY_MONTHS;
  const year = Number(date.slice(0, 4));
  const currentMonth = representativeMonth(date);

  const putMonth = useCallback((hash: string, m: number, summary: MonthSummary) => {
    setStore((prev) => {
      const base = prev.sceneHash === hash ? prev.months : EMPTY_MONTHS;
      const next = [...base];
      next[m] = summary;
      return { sceneHash: hash, months: next };
    });
  }, []);

  const goToMonth = useCallback((m: number) => setDate(monthDate(year, m)), [setDate, year]);

  const setActive = useCallback(
    (value: boolean) => {
      setActiveState(value);
      setPlaying(false);
      // 켜면 지금 달의 대표일로 맞춘다
      if (value && representativeMonth(date) < 0) setDate(monthDate(year, Number(date.slice(5, 7)) - 1));
    },
    [date, setDate, year],
  );

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  // [요구사항: Hooks] useSeasonTimelapse — 재생 중이면 speed초마다 다음 달로 (아직 계산 안 된 달이면 기다림)
  useEffect(() => {
    if (!active || !playing) return;
    const timer = window.setInterval(() => {
      const from = currentMonth < 0 ? 0 : currentMonth;
      const next = (from + 1) % 12;
      if (months[next]) setDate(monthDate(year, next));
    }, speed * 1000);
    return () => window.clearInterval(timer);
  }, [active, playing, speed, currentMonth, months, year, setDate]);

  const state = useMemo(
    () => ({ active, playing, speed, months, currentMonth, year }),
    [active, playing, speed, months, currentMonth, year],
  );
  const actions = useMemo(
    () => ({ setActive, togglePlay, setSpeed, goToMonth, putMonth }),
    [setActive, togglePlay, goToMonth, putMonth],
  );
  return (
    <SeasonActionsContext.Provider value={actions}>
      <SeasonStateContext.Provider value={state}>{children}</SeasonStateContext.Provider>
    </SeasonActionsContext.Provider>
  );
}

export function useSeason(): SeasonState {
  const ctx = useContext(SeasonStateContext);
  if (!ctx) throw new Error('useSeason은 SeasonProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useSeasonActions(): SeasonActions {
  const ctx = useContext(SeasonActionsContext);
  if (!ctx) throw new Error('useSeasonActions는 SeasonProvider 안에서 사용해야 합니다.');
  return ctx;
}
