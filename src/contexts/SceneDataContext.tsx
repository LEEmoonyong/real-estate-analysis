// [요구사항: 상태관리] 공유 상태 — 검색 위치·건물·사용자 보정값·동 번호·선택 대상
// 위치·건물·선택은 useState, 보정값·동 번호는 useLocalStorage(새로 고침 후에도 유지).
// 3D·계산에 쓰는 buildings(좌표 변환 + 보정 병합)는 상태로 저장하지 않고 useMemo로 파생한다.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, isRecord, isRecordOf } from '../data/storage/schema';
import { buildBuildings, maxBuildingHeight, sceneRadius } from '../domain/scene/buildBuildings';
import { sceneHash } from '../domain/scene/sceneHash';
import { VIRTUAL_ID_PREFIX, virtualToBuilding, type VirtualBuilding } from '../domain/scene/virtualBuilding';
import { DEFAULT_UNIT_OPTIONS, generateUnits, type UnitSet } from '../domain/units/generateUnits';
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

/** 카메라 이동 요청 — 동·호수 검색 등으로 선택한 대상을 화면 가운데로 (seq가 바뀔 때마다 한 번 이동) */
export interface FocusRequest {
  seq: number;
  buildingId: string;
  unitId: string | null;
}

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
const EMPTY_UNITS = generateUnits([]);

interface SceneDataState {
  scene: LoadedScene | null;
  /** 좌표 변환·외곽선 정리·보정값 병합을 마친 건물 (useMemo 파생) */
  buildings: Building[];
  /** 외곽선 오류로 제외한 건물 수 */
  droppedCount: number;
  /** 원점에서 가장 먼 건물 정점까지 거리 [m] */
  radiusM: number;
  maxHeightM: number;
  /** 세대 샘플 지점 (건물에서 useMemo 파생, 필드별 typed array) */
  units: UnitSet;
  /** 건물·세대 설정이 같으면 같은 값 — 계산 캐시·Worker 장면 식별 */
  sceneHash: string;
  /** 가상 건물을 뺀 장면의 해시 — 가상 건물 영향 분석의 "전" 결과 식별 (확장 X6) */
  baseSceneHash: string;
  /** 사용자가 놓은 가상 건물 (새로 고침하면 사라짐) */
  virtualBuildings: VirtualBuilding[];
  /** 가상 건물을 계산에 넣을지 (끄면 "전" 장면으로 돌아감) */
  virtualEnabled: boolean;
  corrections: Record<string, FloorCorrection>;
  dongAssignments: Record<string, DongAssignment>;
  selectedBuildingId: string | null;
  selectedUnitId: string | null;
  cameraMode: CameraMode;
  focusRequest: FocusRequest | null;
}

interface SceneDataActions {
  loadScene: (scene: LoadedScene) => void;
  selectBuilding: (id: string | null) => void;
  selectUnit: (unitId: string | null, buildingId?: string) => void;
  clearSelection: () => void;
  setCameraMode: (mode: CameraMode) => void;
  /** 세대(또는 건물)를 선택하고 카메라를 그쪽으로 옮긴다 */
  focusOn: (buildingId: string, unitId: string | null) => void;
  correctFloors: (buildingId: string, floors: number) => void;
  resetFloors: (buildingId: string) => void;
  assignDong: (buildingId: string, dong: string) => void;
  unassignDong: (buildingId: string) => void;
  addVirtual: (x: number, z: number) => void;
  updateVirtual: (id: string, patch: Partial<Omit<VirtualBuilding, 'id'>>) => void;
  removeVirtual: (id: string) => void;
  clearVirtual: () => void;
  setVirtualEnabled: (enabled: boolean) => void;
}

const SceneDataStateContext = createContext<SceneDataState | null>(null);
const SceneDataActionsContext = createContext<SceneDataActions | null>(null);

export function SceneDataProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [scene, setScene] = useState<LoadedScene | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [virtualBuildings, setVirtualBuildings] = useState<VirtualBuilding[]>([]);
  const [virtualEnabled, setVirtualEnabled] = useState(true);

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
    return {
      buildings,
      droppedCount: dropped,
      radiusM: sceneRadius(buildings),
      maxHeightM: maxBuildingHeight(buildings),
    };
  }, [scene, corrections, dongAssignments, settings.floorHeightM]);

  // 세대는 실제 건물(높이·외곽선)이 바뀔 때만 다시 만든다 — 날짜·시각·가상 건물과는 무관
  const baseUnits = useMemo(
    () => ({
      units: derived.buildings.length ? generateUnits(derived.buildings) : EMPTY_UNITS,
      baseSceneHash: derived.buildings.length
        ? sceneHash(derived.buildings, `unitWidth=${DEFAULT_UNIT_OPTIONS.unitWidthM}`)
        : 'empty',
    }),
    [derived.buildings],
  );

  // 가상 건물은 실제 건물 뒤에 붙인다 → 세대의 건물 번호(buildingIndex)가 그대로 유지된다
  const withVirtual = useMemo(() => {
    const extra =
      virtualEnabled && derived.buildings.length
        ? virtualBuildings
            .map((v, i) => virtualToBuilding(v, settings.floorHeightM, i))
            .filter((b): b is Building => b !== null)
        : [];
    if (extra.length === 0) return { buildings: derived.buildings, sceneHash: baseUnits.baseSceneHash };
    const buildings = [...derived.buildings, ...extra];
    return { buildings, sceneHash: sceneHash(buildings, `unitWidth=${DEFAULT_UNIT_OPTIONS.unitWidthM}`) };
  }, [derived.buildings, virtualBuildings, virtualEnabled, settings.floorHeightM, baseUnits.baseSceneHash]);

  const loadScene = useCallback((next: LoadedScene) => {
    setScene(next);
    setSelectedBuildingId(null);
    setSelectedUnitId(null);
    setCameraMode('orbit');
    setFocusRequest(null);
    setVirtualBuildings([]);
    setVirtualEnabled(true);
  }, []);

  const addVirtual = useCallback((x: number, z: number) => {
    setVirtualBuildings((prev) => [
      ...prev,
      {
        id: `${VIRTUAL_ID_PREFIX}${Date.now().toString(36)}${prev.length}`,
        x,
        z,
        widthM: 40,
        depthM: 18,
        floors: 25,
        rotationDeg: 0,
      },
    ]);
    setVirtualEnabled(true);
  }, []);
  const updateVirtual = useCallback(
    (id: string, patch: Partial<Omit<VirtualBuilding, 'id'>>) =>
      setVirtualBuildings((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    [],
  );
  const removeVirtual = useCallback((id: string) => setVirtualBuildings((prev) => prev.filter((v) => v.id !== id)), []);
  const clearVirtual = useCallback(() => setVirtualBuildings([]), []);

  const focusOn = useCallback((buildingId: string, unitId: string | null) => {
    setSelectedBuildingId(buildingId);
    setSelectedUnitId(unitId);
    setFocusRequest((prev) => ({ seq: (prev?.seq ?? 0) + 1, buildingId, unitId }));
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
      buildings: withVirtual.buildings,
      units: baseUnits.units,
      sceneHash: withVirtual.sceneHash,
      baseSceneHash: baseUnits.baseSceneHash,
      virtualBuildings,
      virtualEnabled,
      corrections,
      dongAssignments,
      selectedBuildingId,
      selectedUnitId,
      cameraMode,
      focusRequest,
    }),
    [
      scene,
      derived,
      baseUnits,
      withVirtual,
      virtualBuildings,
      virtualEnabled,
      corrections,
      dongAssignments,
      selectedBuildingId,
      selectedUnitId,
      cameraMode,
      focusRequest,
    ],
  );

  const actions = useMemo<SceneDataActions>(
    () => ({
      loadScene,
      selectBuilding,
      selectUnit,
      clearSelection,
      setCameraMode,
      focusOn,
      correctFloors,
      resetFloors,
      assignDong,
      unassignDong,
      addVirtual,
      updateVirtual,
      removeVirtual,
      clearVirtual,
      setVirtualEnabled,
    }),
    [
      loadScene,
      selectBuilding,
      selectUnit,
      clearSelection,
      focusOn,
      correctFloors,
      resetFloors,
      assignDong,
      unassignDong,
      addVirtual,
      updateVirtual,
      removeVirtual,
      clearVirtual,
    ],
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
