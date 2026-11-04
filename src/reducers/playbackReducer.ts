// [요구사항: 상태관리] useReducer — 시각 재생 상태 (재생/정지, 속도)
// 시각 값 자체는 TimeContext가 갖고, 이 리듀서는 "재생 중인지·몇 배속인지"만 다룬다.

export type PlaybackSpeed = 1 | 2 | 4;

export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [1, 2, 4];

/** ×1 속도: 2초에 1시간 (PLAN.md A2) → 초당 30분 */
export const MINUTES_PER_SECOND_AT_1X = 30;

export interface PlaybackState {
  isPlaying: boolean;
  speed: PlaybackSpeed;
}

export type PlaybackAction =
  { type: 'PLAY' } | { type: 'PAUSE' } | { type: 'TOGGLE' } | { type: 'SET_SPEED'; speed: PlaybackSpeed };

export const initialPlaybackState: PlaybackState = { isPlaying: false, speed: 1 };

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'PLAY':
      return state.isPlaying ? state : { ...state, isPlaying: true };
    case 'PAUSE':
      return state.isPlaying ? { ...state, isPlaying: false } : state;
    case 'TOGGLE':
      return { ...state, isPlaying: !state.isPlaying };
    case 'SET_SPEED':
      return state.speed === action.speed ? state : { ...state, speed: action.speed };
  }
}

/**
 * 한 프레임만큼 시각을 진행한다.
 * @returns 다음 시각과 끝에 도달했는지 (도달하면 끝 시각으로 고정)
 */
export function advanceMinute(
  minute: number,
  elapsedMs: number,
  speed: PlaybackSpeed,
  endMin: number,
): { minute: number; reachedEnd: boolean } {
  // 탭 전환 등으로 프레임 간격이 길어져도 한 번에 크게 건너뛰지 않도록 0.1초로 제한
  const dt = Math.min(Math.max(elapsedMs, 0), 100) / 1000;
  const next = minute + dt * MINUTES_PER_SECOND_AT_1X * speed;
  return next >= endMin ? { minute: endMin, reachedEnd: true } : { minute: next, reachedEnd: false };
}
