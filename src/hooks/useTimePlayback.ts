// [요구사항: Hooks] 커스텀 훅 — 시각 자동 재생
// useReducer(재생 상태) + useEffect(requestAnimationFrame 루프 시작·정리) + useRef(최신 시각·마지막 프레임 시각)
// - 일몰(범위 끝)에 도달하면 자동 정지, 끝에서 다시 누르면 일출부터 재생
// - 탭이 숨겨지면(visibilitychange) 일시정지 — 배터리 절약
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { MinuteRange } from '../domain/time/seasons';
import { advanceMinute, initialPlaybackState, playbackReducer, type PlaybackSpeed } from '../reducers/playbackReducer';

interface TimePlaybackOptions {
  minute: number;
  setMinute: (minute: number) => void;
  range: MinuteRange;
}

export interface TimePlayback {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  toggle: () => void;
  pause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
}

export function useTimePlayback({ minute, setMinute, range }: TimePlaybackOptions): TimePlayback {
  const [state, dispatch] = useReducer(playbackReducer, initialPlaybackState);

  // rAF 콜백이 매 프레임 최신 값을 읽도록 ref에 둔다 (effect를 프레임마다 다시 만들지 않기 위해)
  const minuteRef = useRef(minute);
  minuteRef.current = minute;
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const setMinuteRef = useRef(setMinute);
  setMinuteRef.current = setMinute;

  useEffect(() => {
    if (!state.isPlaying) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { minute: next, reachedEnd } = advanceMinute(
        minuteRef.current,
        now - last,
        state.speed,
        rangeRef.current.max,
      );
      last = now;
      minuteRef.current = next;
      setMinuteRef.current(next);
      if (reachedEnd) {
        dispatch({ type: 'PAUSE' });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.isPlaying, state.speed]);

  // 탭이 숨겨지면 정지
  useEffect(() => {
    if (!state.isPlaying) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [state.isPlaying]);

  const toggle = useCallback(() => {
    // 끝에서 재생을 누르면 일출부터 다시
    if (!state.isPlaying && minuteRef.current >= rangeRef.current.max) {
      minuteRef.current = rangeRef.current.min;
      setMinuteRef.current(rangeRef.current.min);
    }
    dispatch({ type: 'TOGGLE' });
  }, [state.isPlaying]);

  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const setSpeed = useCallback((speed: PlaybackSpeed) => dispatch({ type: 'SET_SPEED', speed }), []);

  return { isPlaying: state.isPlaying, speed: state.speed, toggle, pause, setSpeed };
}
