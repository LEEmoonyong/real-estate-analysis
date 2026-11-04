// [요구사항: 컴포넌트] 재생/정지 버튼 + 재생 속도(×1·×2·×4)
// [요구사항: 이벤트 처리] onClick(재생 토글, 속도 선택)
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../../reducers/playbackReducer';
import styles from './Controls.module.css';

interface PlaybackButtonProps {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  onToggle: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

export function PlaybackButton({ isPlaying, speed, onToggle, onSpeedChange }: PlaybackButtonProps) {
  return (
    <div className={styles.playback}>
      <button
        type="button"
        className={styles.playButton}
        onClick={onToggle}
        aria-label={isPlaying ? '시각 재생 정지' : '시각 재생'}
        aria-pressed={isPlaying}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div className={styles.speeds} role="group" aria-label="재생 속도">
        {PLAYBACK_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.speedButton}
            aria-pressed={speed === s}
            onClick={() => onSpeedChange(s)}
            title={`${s}배속 (${2 / s}초에 1시간)`}
          >
            ×{s}
          </button>
        ))}
      </div>
    </div>
  );
}
