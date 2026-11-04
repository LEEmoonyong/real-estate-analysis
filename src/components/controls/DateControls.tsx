// [요구사항: 컴포넌트] 날짜 선택 + 절기 프리셋(춘분·하지·추분·동지)
// [요구사항: 이벤트 처리] onChange(date input), onClick(프리셋 버튼)
import { useMemo, type ChangeEvent } from 'react';
import { useTime, useTimeActions } from '../../contexts/TimeContext';
import { isValidDate } from '../../domain/time/kst';
import { matchSeason, SEASON_PRESETS, seasonDate, type SeasonPreset } from '../../domain/time/seasons';
import styles from './Controls.module.css';

export function DateControls() {
  const { date } = useTime();
  const { setDate } = useTimeActions();
  const year = Number(date.slice(0, 4));
  const activeSeason = useMemo(() => matchSeason(date), [date]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // 입력 도중의 빈 값·잘못된 값은 무시 (브라우저 date input은 완성된 날짜만 넘긴다)
    if (isValidDate(event.target.value)) setDate(event.target.value);
  };

  const handlePreset = (preset: SeasonPreset) => setDate(seasonDate(year, preset));

  return (
    <div className={styles.dateRow}>
      <label className={styles.dateLabel}>
        <span className={styles.srOnly}>날짜</span>
        <input type="date" className={styles.dateInput} value={date} onChange={handleChange} required />
      </label>
      <div className={styles.presets} role="group" aria-label="절기 프리셋">
        {SEASON_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.presetButton}
            aria-pressed={activeSeason === preset.id}
            title={preset.description}
            onClick={() => handlePreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
