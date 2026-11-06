// [요구사항: 컴포넌트] 장면의 모든 건물
// [요구사항: 이벤트 처리] 건물 벽을 클릭하면 클릭 지점에서 가장 가까운 세대를, 지붕을 클릭하면 건물만 선택
import { useCallback } from 'react';
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { nearestUnitOnBuilding, unitAt } from '../domain/units/generateUnits';
import { BuildingMesh } from './BuildingMesh';

export function Buildings() {
  const { buildings, units, selectedBuildingId, selectedUnitId } = useSceneData();
  const { selectBuilding, selectUnit } = useSceneDataActions();

  // [요구사항: Hooks] useCallback — 장면이 바뀔 때만 새로 만들어 BuildingMesh memo를 유지
  const handleSelect = useCallback(
    (buildingId: string, point: [number, number, number]) => {
      const index = buildings.findIndex((b) => b.id === buildingId);
      const unitIndex = index >= 0 ? nearestUnitOnBuilding(units, index, point, buildings[index]!.heightM) : -1;
      if (unitIndex >= 0) selectUnit(unitAt(units, unitIndex, buildings).id, buildingId);
      else selectBuilding(buildingId);
    },
    [buildings, units, selectBuilding, selectUnit],
  );

  return (
    <group name="buildings">
      {/* 가상 건물은 VirtualBuildings가 따로 그린다 */}
      {buildings.map(
        (b) =>
          !b.isVirtual && (
            <BuildingMesh
              key={b.id}
              building={b} // 세대를 골랐으면 건물 전체 대신 세대 테두리(SelectionHighlight)만 강조
              selected={b.id === selectedBuildingId && !selectedUnitId}
              onSelect={handleSelect}
            />
          ),
      )}
    </group>
  );
}
