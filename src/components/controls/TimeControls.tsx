// [요구사항: 컴포넌트] 날짜·시각 컨트롤 묶음 — 날짜/절기, 시각 슬라이더, 재생, 현재 태양 고도·방위
// [요구사항: Hooks] useSunPosition(커스텀 훅), usePlayback(재생 Context — 모바일 탭을 바꿔도 재생 유지)
import { DEFAULT_LOCATION } from '../../config/constants';
import { usePlayback } from '../../contexts/PlaybackContext';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useTime, useTimeActions } from '../../contexts/TimeContext';
import { compass8 } from '../../domain/geo/compass';
import { useSunPosition } from '../../hooks/useSunPosition';
import { DateControls } from './DateControls';
import { PlaybackButton } from './PlaybackButton';
import { TimeSlider } from './TimeSlider';
import styles from './Controls.module.css';

export function TimeControls() {
  const { scene } = useSceneData();
  const { date, minuteOfDay } = useTime();
  const { setMinuteOfDay } = useTimeActions();
  const place = scene?.place ?? DEFAULT_LOCATION;

  const playback = usePlayback();
  const { events, range } = playback;
  const sun = useSunPosition(place.lat, place.lng, date, minuteOfDay);

  // 슬라이더를 직접 움직이면 재생을 멈춘다 (PLAN.md A2)
  const handleSlide = (minute: number) => {
    playback.pause();
    setMinuteOfDay(minute);
  };

  return (
    <div className={styles.timeControls}>
      <DateControls />
      <div className={styles.timeRow}>
        <PlaybackButton
          isPlaying={playback.isPlaying}
          speed={playback.speed}
          onToggle={playback.toggle}
          onSpeedChange={playback.setSpeed}
        />
        <TimeSlider
          value={minuteOfDay}
          range={range}
          sunriseMin={events.sunriseMin}
          sunsetMin={events.sunsetMin}
          onChange={handleSlide}
        />
      </div>
      <p className={styles.sunInfo}>
        {sun.isUp ? (
          <>
            태양 고도 <strong>{sun.altitudeDeg.toFixed(1)}°</strong> · 방위{' '}
            <strong>
              {compass8(sun.azimuthDeg)} {sun.azimuthDeg.toFixed(0)}°
            </strong>
          </>
        ) : (
          '해가 진 시각입니다'
        )}
        <span className={styles.muted}> · 남중 고도 {events.noonAltitudeDeg.toFixed(1)}°</span>
      </p>
    </div>
  );
}
