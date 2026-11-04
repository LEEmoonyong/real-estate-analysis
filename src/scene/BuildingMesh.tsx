// [요구사항: 컴포넌트] 건물 1동 — 외곽선을 높이만큼 돌출한 3D 메시
// [요구사항: 이벤트 처리] R3F onClick / onPointerOver / onPointerOut
// [요구사항: 상태관리] useState(hovered)
import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo, useState } from 'react';
import type { Building } from '../domain/types';
import { BUILDING_COLORS, createBuildingGeometry } from './buildingGeometry';

interface BuildingMeshProps {
  building: Building;
  selected: boolean;
  /** 클릭한 건물 id와 클릭 지점(월드 좌표) — 지점으로 가장 가까운 세대를 찾는다 */
  onSelect: (id: string, point: [number, number, number]) => void;
}

function BuildingMeshImpl({ building, selected, onSelect }: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // [요구사항: Hooks] useMemo — 외곽선·높이가 바뀔 때만 지오메트리를 다시 만든다
  const geometry = useMemo(
    () => createBuildingGeometry(building.ring, building.heightM),
    [building.ring, building.heightM],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const color = selected
    ? BUILDING_COLORS.selected
    : hovered
      ? BUILDING_COLORS.hovered
      : building.isUserCorrected
        ? BUILDING_COLORS.corrected
        : building.isEstimated
          ? BUILDING_COLORS.estimated
          : building.usage === 'apartments'
            ? BUILDING_COLORS.apartment
            : BUILDING_COLORS.other;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation(); // 뒤에 있는 건물이 함께 선택되지 않도록
    // 드래그(회전·둘러보기) 끝에 생기는 클릭은 선택으로 보지 않는다
    if (event.delta > 6) return;
    onSelect(building.id, [event.point.x, event.point.y, event.point.z]);
  };

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      userData={{ buildingId: building.id }}
    >
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
    </mesh>
  );
}

/** 다른 건물의 호버·선택 변화로 다시 렌더링되지 않도록 memo */
export const BuildingMesh = memo(BuildingMeshImpl);
