// [요구사항: 상태관리] 공유 상태 — 검색 위치·건물·사용자 보정값·동 번호·선택 대상
// 위치·건물·선택은 useState, 보정값·동 번호는 useLocalStorage(새로 고침 후에도 유지).
// 로컬 좌표 변환·보정 병합 건물(buildings)은 3~4일차에 useMemo 파생값으로 추가한다.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, isRecord, isRecordOf } from '../data/storage/schema';
import type { BuildingSource, Place, RawBuilding } from '../domain/types';
import { useLocalStorage } from '../hooks/useLocalStorage';

export interface FloorCorrection {
  floors: number;
  updatedAt: number;
}
export interface DongAssignment {
  dong: string;
  updatedAt: number;
}
export type CameraMode = 'orbit' | 'window';

const isFloorCorrection = (x: unknown): x is FloorCorrection =>
  isRecord(x) && Number.isInteger(x.floors) && (x.floors as number) > 0 && typeof x.updatedAt === 'number';
const isDongAssignment = (x: unknown): x is DongAssignment =>
  isRecord(x) && typeof x.dong === 'string' && typeof x.updatedAt === 'number';

const EMPTY_CORRECTIONS: Record<string, FloorCorrection> = {};
const EMPTY_DONGS: Record<string, DongAssignment> = {};

interface SceneDataState {
  place: Place | null;
  rawBuildings: RawBuilding[];
  source: BuildingSource | null;
  corrections: Record<string, FloorCorrection>;
  dongAssignments: Record<string, DongAssignment>;
  selectedBuildingId: string | null;
  selectedUnitId: string | null;
  cameraMode: CameraMode;
}

interface SceneDataActions {
  setPlace: (place: Place | null) => void;
  setBuildings: (buildings: RawBuilding[], source: BuildingSource) => void;
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
  const [place, setPlace] = useState<Place | null>(null);
  const [rawBuildings, setRawBuildings] = useState<RawBuilding[]>([]);
  const [source, setSource] = useState<BuildingSource | null>(null);
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

  const setBuildings = useCallback((buildings: RawBuilding[], src: BuildingSource) => {
    setRawBuildings(buildings);
    setSource(src);
    setSelectedBuildingId(null);
    setSelectedUnitId(null);
    setCameraMode('orbit');
  }, []);

  const selectUnit = useCallback((unitId: string | null, buildingId?: string) => {
    setSelectedUnitId(unitId);
    if (buildingId !== undefined) setSelectedBuildingId(buildingId);
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
      place,
      rawBuildings,
      source,
      corrections,
      dongAssignments,
      selectedBuildingId,
      selectedUnitId,
      cameraMode,
    }),
    [place, rawBuildings, source, corrections, dongAssignments, selectedBuildingId, selectedUnitId, cameraMode],
  );

  const actions = useMemo<SceneDataActions>(
    () => ({
      setPlace,
      setBuildings,
      selectBuilding: setSelectedBuildingId,
      selectUnit,
      clearSelection,
      setCameraMode,
      correctFloors,
      resetFloors,
      assignDong,
      unassignDong,
    }),
    [setBuildings, selectUnit, clearSelection, correctFloors, resetFloors, assignDong, unassignDong],
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
