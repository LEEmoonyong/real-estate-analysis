// [요구사항: 컴포넌트] 선택한 세대의 상세 — 동·층·추정 호수·방위, 일조 시간, 기준 판정, 타임라인 (PLAN.md A6)
// [요구사항: Hooks] useMemo(세대 찾기·판정), Context(SceneData·Simulation·Time·Settings)
import { lazy, Suspense, useMemo } from 'react';
import { FEATURES } from '../../config/features';
import { useSceneData, useSceneDataActions } from '../../contexts/SceneDataContext';
import { useHeatmap } from '../../contexts/HeatmapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSimulation } from '../../contexts/SimulationContext';
import { useTime, useTimeActions } from '../../contexts/TimeContext';
import { compass8 } from '../../domain/geo/compass';
import { skyOpenness } from '../../domain/sunlight/skyView';
import { evaluateCriteria } from '../../domain/sunlight/criteria';
import { formatMinute } from '../../domain/time/kst';
import { matchSeason } from '../../domain/time/seasons';
import { findUnitIndex, unitAt } from '../../domain/units/generateUnits';
import type { SunlightOutcome } from '../../workers/sceneTransfer';
import { CriteriaBadge } from './CriteriaBadge';

import styles from './UnitDetail.module.css';

// 그래프 라이브러리(recharts)는 세대를 처음 고를 때 받는다
const SunTimelineChart = lazy(() => import('./SunTimelineChart').then((m) => ({ default: m.SunTimelineChart })));

const duration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
};

export function UnitDetailPanel() {
  const { units, buildings, selectedUnitId, sceneHash } = useSceneData();
  const { results, progress } = useSimulation();
  const { svf, irradiance } = useHeatmap();
  const { settings } = useSettings();
  const { date, minuteOfDay } = useTime();
  const { setMinuteOfDay } = useTimeActions();
  const { cameraMode } = useSceneData();
  const { setCameraMode } = useSceneDataActions();

  const index = useMemo(
    () => (selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [units, buildings, selectedUnitId],
  );
  const unit = useMemo(() => (index >= 0 ? unitAt(units, index, buildings) : null), [units, index, buildings]);

  const outcome = results.sunlight as SunlightOutcome | undefined;
  const valid = outcome && outcome.sceneHash === sceneHash && outcome.unitCount === units.count;

  // 이 세대의 마스크 한 줄과 칸별 해 뜸 여부
  const row = useMemo(
    () => (valid && index >= 0 ? outcome.mask.subarray(index * outcome.steps, (index + 1) * outcome.steps) : null),
    [valid, outcome, index],
  );
  const sunUp = useMemo(() => (valid ? Array.from(outcome.sunUp, (v) => v === 1) : []), [valid, outcome]);

  if (!unit) return null;
  const building = buildings.find((b) => b.id === unit.buildingId);
  const dong = building?.dongNumber ? `${building.dongNumber}동` : (building?.name ?? '건물');
  const criteria = settings.criteria;

  return (
    <section className={styles.root} aria-label="세대 일조 정보" data-unit-id={unit.id}>
      <p className={styles.title}>
        {dong} {unit.floor}층 {unit.hoNumber ? `${unit.hoNumber}호` : '측면 창'}
        {unit.hoNumber && <span className={styles.tag}>추정 호수</span>}
      </p>
      <dl className={styles.grid}>
        <dt>창 방향</dt>
        <dd>
          {compass8(unit.azimuthDeg)} {Math.round(unit.azimuthDeg)}°
        </dd>
        <dt>층</dt>
        <dd>
          {unit.floor}층 / {building?.floors ?? '?'}층
        </dd>
        {svf && index >= 0 && (
          <>
            <dt>천공률</dt>
            <dd>
              {svf[index]!.toFixed(2)} <small>(하늘 개방도 {Math.round(skyOpenness(svf[index]!) * 100)}%)</small>
            </dd>
          </>
        )}
        {irradiance && index >= 0 && (
          <>
            <dt>하루 일사량</dt>
            <dd>
              {irradiance[index]!.toFixed(2)} kWh/m² <small>(맑은 날 추정)</small>
            </dd>
          </>
        )}
      </dl>
      {FEATURES.windowView && (
        <button
          type="button"
          className={styles.windowButton}
          aria-pressed={cameraMode === 'window'}
          onClick={() => setCameraMode(cameraMode === 'window' ? 'orbit' : 'window')}
        >
          {cameraMode === 'window' ? '궤도 보기로 돌아가기' : '🪟 창문에서 보기'}
        </button>
      )}

      {!valid || !row ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="일조 계산 중">
          <div />
          <div />
          <div />
          <p>{progress.sunlight ? '일조를 계산하는 중입니다…' : '일조 계산 결과를 기다리는 중입니다…'}</p>
        </div>
      ) : (
        <>
          <dl className={styles.stats}>
            <div>
              <dt>하루 총 일조</dt>
              <dd>{duration(outcome.totalMinutes[index]!)}</dd>
            </div>
            <div>
              <dt>
                {formatMinute(criteria.totalStartMin)}~{formatMinute(criteria.totalEndMin)} 총
              </dt>
              <dd>{duration(outcome.windowTotalMinutes[index]!)}</dd>
            </div>
            <div>
              <dt>
                {formatMinute(criteria.continuousStartMin)}~{formatMinute(criteria.continuousEndMin)} 최대 연속
              </dt>
              <dd>{duration(outcome.windowMaxContinuous[index]!)}</dd>
            </div>
          </dl>
          <CriteriaBadge
            evaluation={evaluateCriteria(
              outcome.windowMaxContinuous[index]!,
              outcome.windowTotalMinutes[index]!,
              criteria,
            )}
            criteria={criteria}
          />
          {matchSeason(date) !== 'winter' && (
            <p className={styles.notice}>참고 기준은 동지일 기준입니다. 현재 날짜({date}) 값은 참고용입니다.</p>
          )}
          <Suspense fallback={<div className={styles.chartPlaceholder} aria-hidden="true" />}>
            <SunTimelineChart
              row={row}
              sunUp={sunUp}
              startMinute={outcome.startMinute}
              stepMinutes={outcome.stepMinutes}
              windowStart={criteria.continuousStartMin}
              windowEnd={criteria.continuousEndMin}
              currentMinute={minuteOfDay}
              onPickMinute={setMinuteOfDay}
            />
          </Suspense>
          <p className={styles.disclaimer}>
            판례 등에서 자주 언급되는 기준을 참고로 표시하며, 법적 판단이 아닙니다. 주변 지형·나무·발코니 구조는
            반영하지 않았습니다.
          </p>
        </>
      )}
    </section>
  );
}
