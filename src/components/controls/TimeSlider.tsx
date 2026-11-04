// [요구사항: 컴포넌트] 일출~일몰 시각 슬라이더 (5분 단위)
// [요구사항: 이벤트 처리] onChange(range input) — 조작하면 재생을 멈춘다
import type { ChangeEvent } from 'react';
import { formatMinute } from '../../domain/time/kst';
import { spokenTime, TIME_STEP_MIN, type MinuteRange } from '../../domain/time/seasons';
import styles from './Controls.module.css';

interface TimeSliderProps {
  value: number;
  range: MinuteRange;
  sunriseMin: number | null;
  sunsetMin: number | null;
  onChange: (minute: number) => void;
}

export function TimeSlider({ value, range, sunriseMin, sunsetMin, onChange }: TimeSliderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value));
  // 재생 중에는 값이 소수(분)라 슬라이더 표시용으로만 5분 단위로 맞춘다
  const shown = Math.round(value / TIME_STEP_MIN) * TIME_STEP_MIN;

  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <output className={styles.time} aria-live="off">
          {formatMinute(value)}
        </output>
      </div>
      <input
        type="range"
        className={styles.range}
        min={range.min}
        max={range.max}
        step={TIME_STEP_MIN}
        value={shown}
        onChange={handleChange}
        aria-label="시각"
        aria-valuetext={spokenTime(shown)}
      />
      <div className={styles.sliderEnds} aria-hidden="true">
        <span>일출 {sunriseMin === null ? '—' : formatMinute(sunriseMin)}</span>
        <span>일몰 {sunsetMin === null ? '—' : formatMinute(sunsetMin)}</span>
      </div>
    </div>
  );
}
