// [요구사항: 컴포넌트] 세대 히트맵 범례 — 선택한 레이어(일조·천공률·일사량)의 색상 스케일·단위·참고 기준선
import { useHeatmap } from '../../contexts/HeatmapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSimulation } from '../../contexts/SimulationContext';
import { legendGradient } from '../../domain/heatmap/colorScale';
import styles from './Legend.module.css';

const LAYER_NAME = { skyView: '천공률', irradiance: '일사량' } as const;

export function Legend() {
  const { heatmap } = useHeatmap();
  const { layer } = useSettings();
  const { progress, jobErrors } = useSimulation();

  // 천공률·일사량은 레이어를 고른 뒤 계산한다 — 그동안 진행률을 보여 준다 (3D는 직전 색 유지)
  if (layer === 'skyView' || layer === 'irradiance') {
    if (jobErrors.skyView) return <p className={styles.note}>천공률 계산 실패: {jobErrors.skyView}</p>;
    const running = progress.skyView;
    if (running && (layer === 'skyView' || !heatmap || heatmap.layer !== layer)) {
      const pct = running.total > 0 ? Math.round((running.done / running.total) * 100) : 0;
      return (
        <p className={styles.note} data-layer-state="running">
          {LAYER_NAME[layer]} 계산 중 {pct}% (천공률 광선 계산)
        </p>
      );
    }
  }
  if (!heatmap) return null;
  const { title, ticks, criterion } = heatmap.legend;

  return (
    <figure className={styles.root} aria-label={`${title} 범례`} data-legend-layer={heatmap.layer}>
      <figcaption className={styles.caption}>{title}</figcaption>
      <div className={styles.scale}>
        <div className={styles.bar} style={{ background: legendGradient() }} />
        {criterion && (
          <div className={styles.criterion} style={{ left: `${criterion.at * 100}%` }} title={criterion.label} />
        )}
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.label} style={{ left: `${t.at * 100}%` }}>
            {t.label}
          </span>
        ))}
      </div>
      {criterion && (
        <p className={styles.note}>
          <span className={styles.criterionMark} aria-hidden="true" /> {criterion.label}
        </p>
      )}
    </figure>
  );
}
