// [요구사항: 컴포넌트] 날짜·시각 컨트롤 묶음 — 날짜/절기, 시각 슬라이더, 재생, 현재 태양 고도·방위
// [요구사항: Hooks] useSunEvents·useSunPosition·useTimePlayback(커스텀 훅), useMemo, useEffect
import { useEffect, useMemo } from 'react';
import { DEFAULT_LOCATION } from '../../config/constants';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useTime, useTimeActions } from '../../contexts/TimeContext';
import { compass8 } from '../../domain/geo/compass';
import { clampMinute, daylightRange } from '../../domain/time/seasons';
import { useSunEvents, useSunPosition } from '../../hooks/useSunPosition';
import { useTimePlayback } from '../../hooks/useTimePlayback';
import { DateControls } from './DateControls';
import { PlaybackButton } from './PlaybackButton';
import { TimeSlider } from './TimeSlider';
import styles from './Controls.module.css';

export function TimeControls() {
  const { scene } = useSceneData();
  const { date, minuteOfDay } = useTime();
  const { setMinuteOfDay } = useTimeActions();
  const place = scene?.place ?? DEFAULT_LOCATION;

  const events = useSunEvents(place.lat, place.lng, date);
  const range = useMemo(() => daylightRange(events.sunriseMin, events.sunsetMin), [events]);
  const sun = useSunPosition(place.lat, place.lng, date, minuteOfDay);
  const playback = useTimePlayback({ minute: minuteOfDay, setMinute: setMinuteOfDay, range });

  // 날짜·지역이 바뀌어 현재 시각이 일출~일몰 범위를 벗어나면 범위 안으로 맞춘다
  useEffect(() => {
    const clamped = clampMinute(minuteOfDay, range);
    if (clamped !== minuteOfDay) setMinuteOfDay(clamped);
  }, [range, minuteOfDay, setMinuteOfDay]);

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
