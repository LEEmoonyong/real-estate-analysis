// [요구사항: 이벤트 처리] 전역 키보드 단축키 (PLAN.md 8장) — 화면에 그리는 것은 없다
// Space 재생, ←/→ 10분(Shift 1시간), 1 일조 레이어, H 히트맵, F 선택 대상으로 카메라, Esc 선택 해제, / 검색, ? 도움말
import { useMemo } from 'react';
import { usePlayback } from '../../contexts/PlaybackContext';
import { useSceneData, useSceneDataActions } from '../../contexts/SceneDataContext';
import { useSettings, useSettingsActions } from '../../contexts/SettingsContext';
import { useTimeActions } from '../../contexts/TimeContext';
import { useKeyboardShortcuts, type ShortcutMap } from '../../hooks/useKeyboardShortcuts';

export function GlobalShortcuts({ onOpenHelp, enabled }: { onOpenHelp: () => void; enabled: boolean }) {
  const { toggle, pause, range } = usePlayback();
  const { setMinuteOfDay } = useTimeActions();
  const { selectedBuildingId, selectedUnitId, cameraMode } = useSceneData();
  const { focusOn, clearSelection, setCameraMode } = useSceneDataActions();
  const { heatmapVisible } = useSettings();
  const { setLayer, setHeatmapVisible } = useSettingsActions();

  const map = useMemo<ShortcutMap>(() => {
    const shift = (delta: number) => () => {
      pause();
      setMinuteOfDay((m) => Math.min(range.max, Math.max(range.min, m + delta)));
    };
    return {
      Space: toggle,
      ArrowLeft: shift(-10),
      ArrowRight: shift(10),
      'shift+ArrowLeft': shift(-60),
      'shift+ArrowRight': shift(60),
      '1': () => setLayer('sunlight'),
      '2': () => setLayer('skyView'),
      '3': () => setLayer('irradiance'),
      '4': () => setLayer('groundShadow'),
      h: () => setHeatmapVisible(!heatmapVisible),
      f: () => {
        if (selectedBuildingId && cameraMode === 'orbit') focusOn(selectedBuildingId, selectedUnitId);
      },
      // 창문 시점이면 먼저 궤도 보기로, 아니면 선택 해제
      Escape: () => (cameraMode === 'window' ? setCameraMode('orbit') : clearSelection()),
      '/': () => document.querySelector<HTMLInputElement>('[data-shortcut="search"]')?.focus(),
      '?': onOpenHelp,
    };
  }, [
    toggle,
    pause,
    range,
    setMinuteOfDay,
    setLayer,
    setHeatmapVisible,
    heatmapVisible,
    selectedBuildingId,
    selectedUnitId,
    focusOn,
    clearSelection,
    cameraMode,
    setCameraMode,
    onOpenHelp,
  ]);

  useKeyboardShortcuts(map, enabled);
  return null;
}
