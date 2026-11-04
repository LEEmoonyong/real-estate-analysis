// [요구사항: 상태관리] 공유 상태 — 검색 위치·건물·사용자 보정값·동 번호·선택 대상
// 위치·건물·선택은 useState, 보정값·동 번호는 useLocalStorage(새로 고침 후에도 유지).
// 3D·계산에 쓰는 buildings(좌표 변환 + 보정 병합)는 상태로 저장하지 않고 useMemo로 파생한다.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, isRecord, isRecordOf } from '../data/storage/schema';
import { buildBuildings, maxBuildingHeight, sceneRadius } from '../domain/scene/buildBuildings';
import type { Building, BuildingSource, Place, RawBuilding } from '../domain/types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useSettings } from './SettingsContext';

export interface FloorCorrection {
  floors: number;
  updatedAt: number;
}
export interface DongAssignment {
  dong: string;
  updatedAt: number;
}
export type CameraMode = 'orbit' | 'window';

/** 한 번에 교체되는 장면 데이터 (위치와 건물이 항상 짝이 맞도록) */
export interface LoadedScene {
  place: Place;
  rawBuildings: RawBuilding[];
  source: BuildingSource;
  /** 샘플 보정 안내 등 데이터 출처에 대한 설명 */
  notes: string[];
}

const isFloorCorrection = (x: unknown): x is FloorCorrection =>
  isRecord(x) && Number.isInteger(x.floors) && (x.floors as number) > 0 && typeof x.updatedAt === 'number';
const isDongAssignment = (x: unknown): x is DongAssignment =>
  isRecord(x) && typeof x.dong === 'string' && typeof x.updatedAt === 'number';

const EMPTY_CORRECTIONS: Record<string, FloorCorrection> = {};
const EMPTY_DONGS: Record<string, DongAssignment> = {};

interface SceneDataState {
  scene: LoadedScene | null;
  /** 좌표 변환·외곽선 정리·보정값 병합을 마친 건물 (useMemo 파생) */
  buildings: Building[];
  /** 외곽선 오류로 제외한 건물 수 */
  droppedCount: number;
  /** 원점에서 가장 먼 건물 정점까지 거리 [m] */
  radiusM: number;
  maxHeightM: number;
  corrections: Record<string, FloorCorrection>;
  dongAssignments: Record<string, DongAssignment>;
  selectedBuildingId: string | null;
  selectedUnitId: string | null;
  cameraMode: CameraMode;
}

interface SceneDataActions {
  loadScene: (scene: LoadedScene) => void;
  selectBuilding: (id: string | null) => void;
  selectUnit: (unitId: string | null, buildingId?: string) => void;
  clearSelection: () => void;
  setCameraMode: (mode: CameraMode) => void;
  correctFloors: (buildingId: string, floors: number) => void;
  resetFloors: (buildingId: string) => void;
  assignDong: (buildingId: string, dong: string) => void;
  unassignDong: (buildingId: string) => void;
}

const SceneDataStateContext = createContext<SceneDataState | null>(null);
const SceneDataActionsContext = createContext<SceneDataActions | null>(null);

export function SceneDataProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [scene, setScene] = useState<LoadedScene | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');

  const [corrections, setCorrections] = useLocalStorage(STORAGE_KEYS.corrections, EMPTY_CORRECTIONS, {
    version: 1,
    validate: isRecordOf(isFloorCorrection),
  });
  const [dongAssignments, setDongAssignments] = useLocalStorage(STORAGE_KEYS.dongAssignments, EMPTY_DONGS, {
    version: 1,
    validate: isRecordOf(isDongAssignment),
  });

  // [요구사항: Hooks] useMemo — 파생 데이터는 상태로 저장하지 않는다
  const derived = useMemo(() => {
    if (!scene) return { buildings: [], droppedCount: 0, radiusM: 0, maxHeightM: 0 };
    const overrides = {
      floors: Object.fromEntries(Object.entries(corrections).map(([id, c]) => [id, c.floors])),
      dongs: Object.fromEntries(Object.entries(dongAssignments).map(([id, d]) => [id, d.dong])),
    };
    const { buildings, dropped } = buildBuildings(scene.rawBuildings, scene.place, settings.floorHeightM, overrides);
    return { buildings, droppedCount: dropped, radiusM: sceneRadius(buildings), maxHeightM: maxBuildingHeight(buildings) };
  }, [scene, corrections, dongAssignments, settings.floorHeightM]);

  const loadScene = useCallback((next: LoadedScene) => {
    setScene(next);
    setSelectedBuildingId(null);
    setSelectedUnitId(null);
    setCameraMode('orbit');
  }, []);

  const selectUnit = useCallback((unitId: string | null, buildingId?: string) => {
    setSelectedUnitId(unitId);
    if (buildingId !== undefined) setSelectedBuildingId(buildingId);
  }, []);

  const selectBuilding = useCallback((id: string | null) => {
    setSelectedBuildingId(id);
    setSelectedUnitId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBuildingId(null);
    setSelectedUnitId(null);
  }, []);

  const correctFloors = useCallback(
    (buildingId: string, floors: number) =>
      setCorrections((prev) => ({ ...prev, [buildingId]: { floors, updatedAt: Date.now() } })),
    [setCorrections],
  );
  const resetFloors = useCallback(
    (buildingId: string) =>
      setCorrections((prev) => {
        const { [buildingId]: _removed, ...rest } = prev;
        return rest;
      }),
    [setCorrections],
  );
  const assignDong = useCallback(
    (buildingId: string, dong: string) =>
      setDongAssignments((prev) => ({ ...prev, [buildingId]: { dong, updatedAt: Date.now() } })),
    [setDongAssignments],
  );
  const unassignDong = useCallback(
    (buildingId: string) =>
      setDongAssignments((prev) => {
        const { [buildingId]: _removed, ...rest } = prev;
        return rest;
      }),
    [setDongAssignments],
  );

  const state = useMemo<SceneDataState>(
    () => ({
      scene,
      ...derived,
      corrections,
      dongAssignments,
      selectedBuildingId,
      selectedUnitId,
      cameraMode,
    }),
    [scene, derived, corrections, dongAssignments, selectedBuildingId, selectedUnitId, cameraMode],
  );

  const actions = useMemo<SceneDataActions>(
    () => ({
      loadScene,
      selectBuilding,
      selectUnit,
      clearSelection,
      setCameraMode,
      correctFloors,
      resetFloors,
      assignDong,
      unassignDong,
    }),
    [loadScene, selectBuilding, selectUnit, clearSelection, correctFloors, resetFloors, assignDong, unassignDong],
  );

  return (
    <SceneDataActionsContext.Provider value={actions}>
      <SceneDataStateContext.Provider value={state}>{children}</SceneDataStateContext.Provider>
    </SceneDataActionsContext.Provider>
  );
}

export function useSceneData(): SceneDataState {
  const ctx = useContext(SceneDataStateContext);
  if (!ctx) throw new Error('useSceneData는 SceneDataProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useSceneDataActions(): SceneDataActions {
  const ctx = useContext(SceneDataActionsContext);
  if (!ctx) throw new Error('useSceneDataActions는 SceneDataProvider 안에서 사용해야 합니다.');
  return ctx;
}
