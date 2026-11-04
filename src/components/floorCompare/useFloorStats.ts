// [요구사항: Hooks] 커스텀 훅 — 선택한 세대의 세로 줄(건물·면·라인) 층별 일조 (PLAN.md 7장 useFloorStats)
// useContext(SceneData·Simulation·Settings) + useMemo(결과·선택·기준이 바뀔 때만 다시 계산)
import { useMemo } from 'react';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSimulation } from '../../contexts/SimulationContext';
import {
  firstMeetingFloor,
  floorColumn,
  floorStats,
  type FloorMetric,
  type FloorStat,
} from '../../domain/sunlight/floorStats';
import { findUnitIndex, unitAt } from '../../domain/units/generateUnits';
import type { SunlightOutcome } from '../../workers/sceneTransfer';

export interface FloorStatsView {
  /** 층 오름차순 */
  floors: (FloorStat & { unitId: string })[];
  firstMeetingFloor: number | null;
  requiredMin: number;
  selectedFloor: number;
  buildingId: string;
}

export function useFloorStats(metric: FloorMetric): FloorStatsView | null {
  const { units, buildings, selectedUnitId, sceneHash } = useSceneData();
  const { results } = useSimulation();
  const { settings } = useSettings();
  const outcome = results.sunlight as SunlightOutcome | undefined;

  const index = useMemo(
    () => (selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [units, buildings, selectedUnitId],
  );
  // 세로 줄은 선택이 바뀔 때만 (날짜가 바뀌어도 같은 줄)
  const column = useMemo(() => (index >= 0 ? floorColumn(units, index) : []), [units, index]);

  return useMemo(() => {
    if (index < 0 || !outcome || outcome.sceneHash !== sceneHash || outcome.unitCount !== units.count) return null;
    const { criteria } = settings;
    const values = metric === 'continuous' ? outcome.windowMaxContinuous : outcome.windowTotalMinutes;
    const requiredMin = metric === 'continuous' ? criteria.continuousRequiredMin : criteria.totalRequiredMin;
    const stats = floorStats(units, column, values, requiredMin);
    return {
      floors: stats.map((s) => ({ ...s, unitId: unitAt(units, s.unitIndex, buildings).id })),
      firstMeetingFloor: firstMeetingFloor(stats),
      requiredMin,
      selectedFloor: units.floor[index]!,
      buildingId: buildings[units.buildingIndex[index]!]!.id,
    };
  }, [index, outcome, sceneHash, units, buildings, column, metric, settings]);
}
