import { describe, expect, it } from 'vitest';
import { advanceMinute, initialPlaybackState, playbackReducer } from './playbackReducer';

describe('playbackReducer', () => {
  it('재생·정지·토글', () => {
    let s = playbackReducer(initialPlaybackState, { type: 'PLAY' });
    expect(s.isPlaying).toBe(true);
    s = playbackReducer(s, { type: 'TOGGLE' });
    expect(s.isPlaying).toBe(false);
    s = playbackReducer(s, { type: 'TOGGLE' });
    expect(s.isPlaying).toBe(true);
    s = playbackReducer(s, { type: 'PAUSE' });
    expect(s.isPlaying).toBe(false);
  });

  it('상태가 그대로면 같은 객체를 돌려준다 (불필요한 리렌더 방지)', () => {
    expect(playbackReducer(initialPlaybackState, { type: 'PAUSE' })).toBe(initialPlaybackState);
    expect(playbackReducer(initialPlaybackState, { type: 'SET_SPEED', speed: 1 })).toBe(initialPlaybackState);
  });

  it('속도 변경은 재생 여부를 바꾸지 않는다', () => {
    const playing = playbackReducer(initialPlaybackState, { type: 'PLAY' });
    expect(playbackReducer(playing, { type: 'SET_SPEED', speed: 4 })).toEqual({ isPlaying: true, speed: 4 });
  });
});

describe('advanceMinute', () => {
  it('×1은 2초에 60분 (프레임 100ms × 20)', () => {
    let m = 600;
    for (let i = 0; i < 20; i++) m = advanceMinute(m, 100, 1, 1440).minute;
    expect(m).toBeCloseTo(660, 9);
  });

  it('×4는 4배 빠르다', () => {
    expect(advanceMinute(600, 50, 4, 1440).minute).toBeCloseTo(606, 9);
  });

  it('끝 시각을 넘지 않고 도달을 알린다', () => {
    expect(advanceMinute(1015, 100, 4, 1017)).toEqual({ minute: 1017, reachedEnd: true });
  });

  it('긴 프레임 간격(탭 복귀)은 100ms로 제한한다', () => {
    expect(advanceMinute(600, 5000, 1, 1440).minute).toBeCloseTo(603, 9);
  });
});
