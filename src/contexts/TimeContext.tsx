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

/** 기본 날짜: 올해 동지 근처(12월 22일) — 일조 참고 기준이 동지 기준이므로 */
export function defaultDate(now = new Date()): string {
  const kstYear = new Date(now.getTime() + 9 * 3600_000).getUTCFullYear();
  return `${kstYear}-12-22`;
}

const TimeStateContext = createContext<TimeState | null>(null);
const TimeActionsContext = createContext<TimeActions | null>(null);

export function TimeProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string>(() => defaultDate());
  const [minuteOfDay, setMinuteOfDay] = useState(12 * 60);

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
