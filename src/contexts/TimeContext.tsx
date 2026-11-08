// [요구사항: 상태관리] 공유 상태 — 선택 날짜·시각 (useState)
// 재생 중에는 minuteOfDay가 자주 바뀌므로 이 Context는 시각 표시 관련 컴포넌트만 구독한다 (PLAN.md 5.2).
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface TimeState {
  /** KST 날짜 'YYYY-MM-DD' */
  date: string;
  /** KST 0시부터 분 (0~1439) */
  minuteOfDay: number;
}

interface TimeActions {
  setDate: (date: string) => void;
  setMinuteOfDay: (minute: number | ((prev: number) => number)) => void;
}

/** 기본 날짜: 프로그램을 실행한 오늘 (한국 시간) — 태양 정보·3D 태양 경로도 오늘 기준으로 시작한다 */
export function defaultDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 기본 시각: 지금 (한국 시간, 분) */
export function defaultMinuteOfDay(now = new Date()): number {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

const TimeStateContext = createContext<TimeState | null>(null);
const TimeActionsContext = createContext<TimeActions | null>(null);

export function TimeProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string>(() => defaultDate());
  const [minuteOfDay, setMinuteOfDay] = useState<number>(() => defaultMinuteOfDay());

  const state = useMemo(() => ({ date, minuteOfDay }), [date, minuteOfDay]);
  // useState의 setter는 참조가 고정되므로 actions 객체도 한 번만 만든다
  const actions = useMemo(() => ({ setDate, setMinuteOfDay }), []);

  return (
    <TimeActionsContext.Provider value={actions}>
      <TimeStateContext.Provider value={state}>{children}</TimeStateContext.Provider>
    </TimeActionsContext.Provider>
  );
}

export function useTime(): TimeState {
  const ctx = useContext(TimeStateContext);
  if (!ctx) throw new Error('useTime은 TimeProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useTimeActions(): TimeActions {
  const ctx = useContext(TimeActionsContext);
  if (!ctx) throw new Error('useTimeActions는 TimeProvider 안에서 사용해야 합니다.');
  return ctx;
}
