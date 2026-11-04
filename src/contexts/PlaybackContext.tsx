// [요구사항: 상태관리] 공유 상태 — 시각 자동 재생 (useReducer는 useTimePlayback 안)
// 재생 상태를 TimeControls 안에 두면 모바일 탭을 바꿀 때(컴포넌트가 사라질 때) 재생이 멈추고,
// 키보드 단축키(Space)에서 재생을 제어할 수 없다 → Provider로 올려 앱 전체에서 공유한다.
// 시각 범위(일출~일몰)도 여기서 한 번 계산해 슬라이더·재생·범위 맞춤이 같은 값을 쓴다.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCATION } from '../config/constants';
import { clampMinute, daylightRange, type MinuteRange } from '../domain/time/seasons';
import type { SunEvents } from '../domain/solar/sunEvents';
import { useSunEvents } from '../hooks/useSunPosition';
import { useTimePlayback, type TimePlayback } from '../hooks/useTimePlayback';
import { useSceneData } from './SceneDataContext';
import { useTime, useTimeActions } from './TimeContext';

interface PlaybackValue extends TimePlayback {
  /** 슬라이더·재생 범위 (일출~일몰, 5분 단위) */
  range: MinuteRange;
  events: SunEvents;
}

const PlaybackContext = createContext<PlaybackValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { scene } = useSceneData();
  const { date, minuteOfDay } = useTime();
  const { setMinuteOfDay } = useTimeActions();
  const place = scene?.place ?? DEFAULT_LOCATION;

  const events = useSunEvents(place.lat, place.lng, date);
  const range = useMemo(() => daylightRange(events.sunriseMin, events.sunsetMin), [events]);
  const playback = useTimePlayback({ minute: minuteOfDay, setMinute: setMinuteOfDay, range });

  // 날짜·지역이 바뀌어 현재 시각이 일출~일몰 범위를 벗어나면 범위 안으로 맞춘다
  useEffect(() => {
    const clamped = clampMinute(minuteOfDay, range);
    if (clamped !== minuteOfDay) setMinuteOfDay(clamped);
  }, [range, minuteOfDay, setMinuteOfDay]);

  const { isPlaying, speed, toggle, pause, setSpeed } = playback;
  const value = useMemo(
    () => ({ isPlaying, speed, toggle, pause, setSpeed, range, events }),
    [isPlaying, speed, toggle, pause, setSpeed, range, events],
  );
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback은 PlaybackProvider 안에서 사용해야 합니다.');
  return ctx;
}
