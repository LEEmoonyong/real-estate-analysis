// [요구사항: 컴포넌트] 계절 타임랩스 조작 (C11) — 켜기, 재생/일시정지, 속도(한 달에 0.5·1·2초), 월 슬라이더
// [요구사항: 이벤트 처리] onChange(체크박스·슬라이더), onClick(재생·속도)
import { useId } from 'react';
import { useSeason, useSeasonActions, type SeasonSpeed } from '../../contexts/SeasonContext';
import styles from './Season.module.css';

const SPEEDS: SeasonSpeed[] = [0.5, 1, 2];

export function SeasonTimelapseControls() {
  const { active, playing, speed, months, currentMonth } = useSeason();
  const { setActive, togglePlay, setSpeed, goToMonth } = useSeasonActions();
  const sliderId = useId();
  const done = months.filter(Boolean).length;

  return (
    <div className={styles.root}>
      <label className={styles.option}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        계절 타임랩스 (매월 21일)
      </label>
      {active && (
        <>
          <p className={styles.muted} role="status" data-season-done={done}>
            {done < 12 ? `12개월 중 ${done}개월 계산됨 — 나머지는 뒤에서 계속 계산합니다` : '12개월 계산 완료'}
          </p>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.play}
              onClick={togglePlay}
              aria-pressed={playing}
              aria-label={playing ? '계절 재생 정지' : '계절 재생'}
              disabled={done < 2}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className={styles.speeds} role="group" aria-label="한 달에 머무는 시간">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.speed}
                  aria-pressed={speed === s}
                  onClick={() => setSpeed(s)}
                >
                  {s}초
                </button>
              ))}
            </div>
          </div>
          <label htmlFor={sliderId} className={styles.muted}>
            {currentMonth >= 0 ? `${currentMonth + 1}월 21일` : '대표일이 아닌 날짜'}
            {currentMonth >= 0 && !months[currentMonth] && ' (계산 중)'}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={11}
            step={1}
            value={currentMonth >= 0 ? currentMonth : 0}
            onChange={(e) => goToMonth(Number(e.target.value))}
            aria-valuetext={`${(currentMonth >= 0 ? currentMonth : 0) + 1}월`}
            className={styles.slider}
          />
          <div className={styles.monthTicks} aria-hidden="true">
            {months.map((m, i) => (
              <span key={i} data-ready={m !== null}>
                {i + 1}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
