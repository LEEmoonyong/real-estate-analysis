// [요구사항: 컴포넌트] 장면의 모든 건물
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { BuildingMesh } from './BuildingMesh';

export function Buildings() {
  const { buildings, selectedBuildingId } = useSceneData();
  const { selectBuilding } = useSceneDataActions(); // 참조가 고정된 콜백 → BuildingMesh memo 유지

  return (
    <group name="buildings">
      {buildings.map((b) => (
        <BuildingMesh key={b.id} building={b} selected={b.id === selectedBuildingId} onSelect={selectBuilding} />
      ))}
    </group>
  );
}
