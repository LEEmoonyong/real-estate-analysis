// [요구사항: 컴포넌트] 일조 계산 진행률·결과 요약 (3D 장면 위 오버레이)
// [요구사항: Hooks] useSunlightWorker(커스텀 훅)를 여기서 실행한다.
//   이 훅은 TimeContext를 구독하므로, 앱 최상위가 아닌 작은 컴포넌트에 두어 시각 재생 중 리렌더 범위를 좁힌다.
import { useSimulation } from '../../contexts/SimulationContext';
import { useSunlightWorker } from '../../hooks/useSunlightWorker';
import type { SunlightOutcome } from '../../workers/sceneTransfer';
import styles from './CalculationStatus.module.css';

function countMeets(meets: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < meets.length; i++) n += meets[i]!;
  return n;
}

export function CalculationStatus() {
  const { workers } = useSunlightWorker();
  const { phase, progress, results } = useSimulation();
  const running = progress.sunlight;
  const outcome = results.sunlight as SunlightOutcome | undefined;

  if (running) {
    const ratio = running.total > 0 ? running.done / running.total : 0;
    return (
      <div className={styles.root} data-sunlight-state="running" role="status">
        <span>일조 계산 중 {Math.round(ratio * 100)}%</span>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="일조 계산 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
        >
          <div className={styles.fill} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
    );
  }

  if (phase === 'done' && outcome) {
    const meets = countMeets(outcome.meets);
    const ratio = outcome.unitCount > 0 ? meets / outcome.unitCount : 0;
    return (
      <div
        className={styles.root}
        data-sunlight-state="done"
        data-date={outcome.date}
        data-elapsed-ms={Math.round(outcome.elapsedMs)}
        data-unit-count={outcome.unitCount}
        data-rays={outcome.rays}
        data-meets={meets}
        data-workers={outcome.workers || workers}
        role="status"
      >
        <span>
          일조 계산 완료 · 세대 {outcome.unitCount.toLocaleString()}곳 · 기준 충족 {Math.round(ratio * 100)}%
        </span>
        <span className={styles.muted}>
          {outcome.fromCache
            ? '저장된 결과'
            : `${(outcome.elapsedMs / 1000).toFixed(1)}초 · Worker ${outcome.workers}개`}
        </span>
      </div>
    );
  }

  return null;
}
