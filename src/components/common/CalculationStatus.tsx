// [요구사항: 컴포넌트] 일조 계산 진행률·결과 요약·히트맵 범례 (3D 장면 위 오버레이)
// [요구사항: Hooks] useSunlightWorker(커스텀 훅)를 여기서 실행한다.
//   이 훅은 TimeContext를 구독하므로, 앱 최상위가 아닌 작은 컴포넌트에 두어 시각 재생 중 리렌더 범위를 좁힌다.
import { useEffect, useMemo } from 'react';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSimulation } from '../../contexts/SimulationContext';
import { saveSunSummary, summarize } from '../../data/storage/sunSummary';
import { useSunlightWorker } from '../../hooks/useSunlightWorker';
import type { SunlightOutcome } from '../../workers/sceneTransfer';
import { GroundLegend } from '../analysis/GroundLegend';
import { Legend } from '../analysis/Legend';
import styles from './CalculationStatus.module.css';

export function CalculationStatus() {
  const { workers } = useSunlightWorker();
  const { phase, progress, results } = useSimulation();
  const { units, scene, sceneHash } = useSceneData();
  const { heatmapVisible } = useSettings();
  const running = progress.sunlight;
  const outcome = results.sunlight as SunlightOutcome | undefined;

  // 기준 충족 비율은 호수가 붙는 주향(거실) 면 세대로 센다 — 북향·측면 창까지 넣으면 의미가 흐려진다
  const summary = useMemo(() => {
    if (!outcome || outcome.unitCount !== units.count) return null;
    let main = 0;
    let meets = 0;
    for (let i = 0; i < units.count; i++) {
      if (!units.isMainFace[i]) continue;
      main++;
      meets += outcome.meets[i]!;
    }
    return { main, meets };
  }, [outcome, units]);

  // 단지 일조 요약을 저장해 둔다 → 지도에서 "일조 기준 충족 X% 이상" 필터 (확장 X5)
  useEffect(() => {
    if (!scene || !outcome || outcome.sceneHash !== sceneHash || outcome.unitCount !== units.count) return;
    const main: { windowTotal: number; meets: boolean }[] = [];
    for (let i = 0; i < units.count; i++)
      if (units.isMainFace[i])
        main.push({ windowTotal: outcome.windowTotalMinutes[i]!, meets: outcome.meets[i] === 1 });
    const s = summarize(main);
    if (!s) return;
    saveSunSummary({
      name: scene.place.name,
      lat: scene.place.lat,
      lng: scene.place.lng,
      date: outcome.date,
      ...s,
      at: Date.now(),
    });
  }, [scene, outcome, sceneHash, units]);

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
        <GroundLegend />
      </div>
    );
  }

  if (phase === 'done' && outcome && summary) {
    const ratio = summary.main > 0 ? summary.meets / summary.main : 0;
    return (
      <div
        className={styles.root}
        data-sunlight-state="done"
        data-date={outcome.date}
        data-elapsed-ms={Math.round(outcome.elapsedMs)}
        data-unit-count={outcome.unitCount}
        data-rays={outcome.rays}
        data-main-units={summary.main}
        data-main-meets={summary.meets}
        data-workers={outcome.workers || workers}
        role="status"
      >
        <GroundLegend />
        {heatmapVisible && <Legend />}
        <span>
          남향 세대 {summary.main.toLocaleString()}곳 중 기준 충족 <strong>{Math.round(ratio * 100)}%</strong>
        </span>
        <span className={styles.muted}>
          전체 {outcome.unitCount.toLocaleString()}곳 계산 ·{' '}
          {outcome.fromCache
            ? '저장된 결과'
            : `${(outcome.elapsedMs / 1000).toFixed(1)}초 · Worker ${outcome.workers}개`}
        </span>
      </div>
    );
  }

  return null;
}
