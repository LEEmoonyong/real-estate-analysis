// [요구사항: 컴포넌트] 히트맵 범례 — 색상 스케일·단위·참고 기준선
import { useSettings } from '../../contexts/SettingsContext';
import { legendGradient, SUNLIGHT_MAX_MINUTES } from '../../domain/heatmap/colorScale';
import { formatMinute } from '../../domain/time/kst';
import styles from './Legend.module.css';

const TICKS = [0, 2, 4, 6, 8];

export function Legend() {
  const { settings } = useSettings();
  const { totalStartMin, totalEndMin, totalRequiredMin } = settings.criteria;
  const criterionRatio = Math.min(1, totalRequiredMin / SUNLIGHT_MAX_MINUTES);

  return (
    <figure className={styles.root} aria-label="일조 히트맵 범례">
      <figcaption className={styles.caption}>
        {formatMinute(totalStartMin)}~{formatMinute(totalEndMin)} 일조 시간
      </figcaption>
      <div className={styles.scale}>
        <div className={styles.bar} style={{ background: legendGradient() }} />
        <div
          className={styles.criterion}
          style={{ left: `${criterionRatio * 100}%` }}
          title={`참고 기준: 총 ${totalRequiredMin / 60}시간`}
        />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {TICKS.map((h) => (
          <span key={h} style={{ left: `${(h / 8) * 100}%` }}>
            {h === 8 ? '8h+' : `${h}h`}
          </span>
        ))}
      </div>
      <p className={styles.note}>
        <span className={styles.criterionMark} aria-hidden="true" /> 참고 기준 {totalRequiredMin / 60}시간
      </p>
    </figure>
  );
}
