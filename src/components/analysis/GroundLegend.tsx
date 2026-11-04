// [요구사항: 컴포넌트] 지면 그림자 레이어 범례·진행률 (C8)
import { useSettings } from '../../contexts/SettingsContext';
import { useSimulation } from '../../contexts/SimulationContext';
import { groundLegendGradient } from '../../domain/heatmap/groundColor';
import { formatMinute } from '../../domain/time/kst';
import type { GroundOutcome } from '../../workers/sceneTransfer';
import styles from './Legend.module.css';

export function GroundLegend() {
  const { layer } = useSettings();
  const { progress, results, jobErrors } = useSimulation();
  if (layer !== 'groundShadow') return null;
  const running = progress.ground;
  const outcome = results.ground as GroundOutcome | undefined;

  if (jobErrors.ground) {
    return <p className={styles.note}>지면 그림자 계산 실패: {jobErrors.ground}</p>;
  }
  if (running) {
    const pct = running.total > 0 ? Math.round((running.done / running.total) * 100) : 0;
    return (
      <p className={styles.note} data-ground-state="running">
        지면 그림자 계산 중 {pct}%
      </p>
    );
  }
  if (!outcome) return null;
  const hours = outcome.windowMinutes / 60;
  return (
    <figure
      className={styles.root}
      aria-label="지면 그림자 범례"
      data-ground-state="done"
      data-ground-elapsed-ms={Math.round(outcome.elapsedMs)}
      data-ground-cells={outcome.spec.cols * outcome.spec.rows}
      data-ground-cell-size={outcome.spec.cellSize}
    >
      <figcaption className={styles.caption}>
        {formatMinute(outcome.startMin)}~{formatMinute(outcome.endMin)} 지면 그림자 시간 (셀 {outcome.spec.cellSize}m)
      </figcaption>
      <div className={styles.scale}>
        <div className={styles.bar} style={{ background: groundLegendGradient() }} />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        <span style={{ left: '0%' }}>0h</span>
        <span style={{ left: '50%' }}>{hours / 2}h</span>
        <span style={{ left: '100%' }}>{hours}h</span>
      </div>
      <p className={styles.note}>
        {outcome.fromCache ? '저장된 결과' : `${(outcome.elapsedMs / 1000).toFixed(1)}초`} · 땅 위에 마우스를 올리면
        시간 표시
      </p>
    </figure>
  );
}
