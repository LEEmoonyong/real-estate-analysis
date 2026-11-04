// [요구사항: 상태관리] 공유 상태 — 사용자 설정·표시 레이어 (Provider 내부는 useState + useLocalStorage)
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_CRITERIA, DEFAULT_FLOOR_HEIGHT_M, DEFAULT_STEP_MINUTES } from '../config/constants';
import { STORAGE_KEYS, isRecord } from '../data/storage/schema';
import type { AnalysisLayer, SunlightCriteria } from '../domain/types';
import { useLocalStorage } from '../hooks/useLocalStorage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type QualityOverride = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  theme: ThemePreference;
  floorHeightM: number;
  stepMinutes: number;
  criteria: SunlightCriteria;
  quality: QualityOverride;
  /** 옥상 태양광 패널 효율 (C10) */
  panelEfficiency: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  floorHeightM: DEFAULT_FLOOR_HEIGHT_M,
  stepMinutes: DEFAULT_STEP_MINUTES,
  criteria: { ...DEFAULT_CRITERIA },
  quality: 'auto',
  panelEfficiency: 0.2,
};

const SETTINGS_VERSION = 1;

function isSettings(x: unknown): x is Settings {
  return (
    isRecord(x) &&
    ['system', 'light', 'dark'].includes(x.theme as string) &&
    typeof x.floorHeightM === 'number' &&
    typeof x.stepMinutes === 'number' &&
    isRecord(x.criteria) &&
    typeof x.quality === 'string' &&
    typeof x.panelEfficiency === 'number'
  );
}

interface SettingsState {
  settings: Settings;
  layer: AnalysisLayer;
  /** 3D 장면의 세대 히트맵 표시 여부 */
  heatmapVisible: boolean;
}

interface SettingsActions {
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  setLayer: (layer: AnalysisLayer) => void;
  setHeatmapVisible: (visible: boolean) => void;
}

const SettingsStateContext = createContext<SettingsState | null>(null);
const SettingsActionsContext = createContext<SettingsActions | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings, removeSettings] = useLocalStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS, {
    version: SETTINGS_VERSION,
    validate: isSettings,
  });
  const [layer, setLayer] = useState<AnalysisLayer>('sunlight');
  const [heatmapVisible, setHeatmapVisible] = useState(true);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  const state = useMemo(() => ({ settings, layer, heatmapVisible }), [settings, layer, heatmapVisible]);
  // 동작만 쓰는 컴포넌트가 상태 변화로 다시 렌더링되지 않도록 actions를 분리한다
  const actions = useMemo(
    () => ({ updateSettings, resetSettings: removeSettings, setLayer, setHeatmapVisible }),
    [updateSettings, removeSettings],
  );

  return (
    <SettingsActionsContext.Provider value={actions}>
      <SettingsStateContext.Provider value={state}>{children}</SettingsStateContext.Provider>
    </SettingsActionsContext.Provider>
  );
}

// [요구사항: Hooks] useContext
export function useSettings(): SettingsState {
  const ctx = useContext(SettingsStateContext);
  if (!ctx) throw new Error('useSettings는 SettingsProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useSettingsActions(): SettingsActions {
  const ctx = useContext(SettingsActionsContext);
  if (!ctx) throw new Error('useSettingsActions는 SettingsProvider 안에서 사용해야 합니다.');
  return ctx;
}
