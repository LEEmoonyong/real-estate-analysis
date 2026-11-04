// [요구사항: 상태관리] 파생 상태 공유 — 선택한 분석 레이어의 세대별 값·범례 (useMemo로 한 번 계산해 Context로 나눔)
// 3D 히트맵(UnitHeatmap)·범례(Legend)·세대 상세(UnitDetailPanel)가 같은 값을 쓰므로 계산을 한 곳에 둔다.
// - 일조: 08~16시 총 일조 [분] / 8시간
// - 천공률: 하늘 개방도 = SVF / 0.5 (0~100%)
// - 일사량: 청천 모델 하루 일사 [kWh/m²·day] — 일조 가시성 마스크 + 천공률(있으면) 재사용
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCATION } from '../config/constants';
import { SUNLIGHT_MAX_MINUTES } from '../domain/heatmap/colorScale';
import { dayOfYear, irradianceScaleMax, unitDailyIrradiance } from '../domain/solar/irradiance';
import { skyOpenness } from '../domain/sunlight/skyView';
import { computeSunSteps } from '../domain/sunlight/sunSteps';
import { formatMinute } from '../domain/time/kst';
import type { AnalysisLayer } from '../domain/types';
import type { SkyViewOutcome, SunlightOutcome } from '../workers/sceneTransfer';
import { useSceneData } from './SceneDataContext';
import { useSettings } from './SettingsContext';
import { useSimulation } from './SimulationContext';

export interface HeatmapLegendSpec {
  title: string;
  /** 0~1 위치와 글자 */
  ticks: { at: number; label: string }[];
  /** 참고 기준선 (일조만) */
  criterion?: { at: number; label: string };
}

export interface HeatmapData {
  /** 실제로 칠하는 레이어 (지면 그림자 레이어에서는 세대는 일조로 칠한다) */
  layer: Exclude<AnalysisLayer, 'groundShadow'>;
  /** 세대별 0~1 (색 위치) */
  ratios: Float32Array;
  legend: HeatmapLegendSpec;
  sceneHash: string;
}

interface HeatmapState {
  heatmap: HeatmapData | null;
  /** 레이어 값이 아직 계산 중이면 true (그동안 3D는 직전 색을 유지) */
  pending: boolean;
  /** 세대별 하루 일사량 [kWh/m²·day] (일사량 레이어일 때) */
  irradiance: Float32Array | null;
  /** 세대별 천공률 (계산되어 있으면) */
  svf: Float32Array | null;
}

const HeatmapContext = createContext<HeatmapState | null>(null);

export function HeatmapProvider({ children }: { children: ReactNode }) {
  const { units, sceneHash, scene } = useSceneData();
  const { layer, settings } = useSettings();
  const { results } = useSimulation();
  const sunlight = results.sunlight as SunlightOutcome | undefined;
  const sky = results.skyView as SkyViewOutcome | undefined;
  const place = scene?.place ?? DEFAULT_LOCATION;

  const validSun = sunlight && sunlight.sceneHash === sceneHash && sunlight.unitCount === units.count ? sunlight : null;
  const validSky = sky && sky.sceneHash === sceneHash && sky.unitCount === units.count ? sky : null;
  const paint: HeatmapData['layer'] = layer === 'groundShadow' ? 'sunlight' : layer;

  // [요구사항: Hooks] useMemo — 일사량은 마스크 × 칸 산술 (Jamsil 5만 세대 × 60칸 ≈ 300만 회)이라 결과가 바뀔 때만
  const irradiance = useMemo(() => {
    if (paint !== 'irradiance' || !validSun) return null;
    const steps = computeSunSteps(place.lat, place.lng, validSun.date, validSun.stepMinutes);
    if (steps.count !== validSun.steps) return null;
    return unitDailyIrradiance(
      validSun.mask,
      validSun.unitCount,
      steps.directions,
      steps.count,
      steps.stepMinutes,
      units.normals,
      dayOfYear(validSun.date),
      validSky?.svf ?? null,
    );
  }, [paint, validSun, validSky, place.lat, place.lng, units.normals]);

  const { totalStartMin, totalEndMin, totalRequiredMin } = settings.criteria;
  const heatmap = useMemo<HeatmapData | null>(() => {
    if (paint === 'sunlight') {
      if (!validSun) return null;
      const ratios = new Float32Array(units.count);
      for (let i = 0; i < units.count; i++) ratios[i] = validSun.windowTotalMinutes[i]! / SUNLIGHT_MAX_MINUTES;
      return {
        layer: paint,
        ratios,
        sceneHash,
        legend: {
          title: `${formatMinute(totalStartMin)}~${formatMinute(totalEndMin)} 일조 시간`,
          ticks: [0, 2, 4, 6, 8].map((h) => ({ at: h / 8, label: h === 8 ? '8h+' : `${h}h` })),
          criterion: {
            at: Math.min(1, totalRequiredMin / SUNLIGHT_MAX_MINUTES),
            label: `참고 기준 ${totalRequiredMin / 60}시간`,
          },
        },
      };
    }
    if (paint === 'skyView') {
      if (!validSky) return null;
      const ratios = new Float32Array(units.count);
      for (let i = 0; i < units.count; i++) ratios[i] = skyOpenness(validSky.svf[i]!);
      return {
        layer: paint,
        ratios,
        sceneHash,
        legend: {
          title: '하늘 개방도 (천공률 ÷ 0.5)',
          ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => ({ at: t, label: `${t * 100}%` })),
        },
      };
    }
    if (!irradiance) return null;
    const max = irradianceScaleMax(irradiance);
    const ratios = new Float32Array(units.count);
    for (let i = 0; i < units.count; i++) ratios[i] = irradiance[i]! / max;
    return {
      layer: paint,
      ratios,
      sceneHash,
      legend: {
        title: `하루 일사량 (맑은 날 추정, kWh/m²)`,
        ticks: [0, 0.5, 1].map((t) => ({ at: t, label: (max * t).toFixed(1) })),
      },
    };
  }, [paint, validSun, validSky, irradiance, units.count, sceneHash, totalStartMin, totalEndMin, totalRequiredMin]);

  const value = useMemo<HeatmapState>(
    () => ({ heatmap, pending: heatmap === null, irradiance, svf: validSky?.svf ?? null }),
    [heatmap, irradiance, validSky],
  );
  return <HeatmapContext.Provider value={value}>{children}</HeatmapContext.Provider>;
}

export function useHeatmap(): HeatmapState {
  const ctx = useContext(HeatmapContext);
  if (!ctx) throw new Error('useHeatmap은 HeatmapProvider 안에서 사용해야 합니다.');
  return ctx;
}
