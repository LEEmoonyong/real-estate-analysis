// [요구사항: 컴포넌트] 가상 건물 (확장 X6) — 반투명 주황 상자 + 배치 모드의 지면 클릭 받기
// [요구사항: 이벤트 처리] R3F onClick(지면 = 배치, 가상 건물 = 선택), onPointerMove(배치 미리보기)
// [요구사항: 상태관리] useState(미리보기 위치)
import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { useVirtualUi, useVirtualUiActions } from '../contexts/VirtualUiContext';
import type { Building } from '../domain/types';
import { createBuildingGeometry } from './buildingGeometry';

const VIRTUAL_COLOR = '#ff7a1a';

function VirtualMesh({ building, active, onPick }: { building: Building; active: boolean; onPick: () => void }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const geometry = useMemo(
    () => createBuildingGeometry(building.ring, building.heightM),
    [building.ring, building.heightM],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta <= 6) onPick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      userData={{ virtualId: building.id }}
    >
      <meshStandardMaterial
        color={VIRTUAL_COLOR}
        transparent
        opacity={active || hovered ? 0.85 : 0.6}
        emissive={VIRTUAL_COLOR}
        emissiveIntensity={active ? 0.35 : 0.1}
        roughness={0.7}
      />
    </mesh>
  );
}

export function VirtualBuildings() {
  const { buildings, radiusM } = useSceneData();
  const { addVirtual } = useSceneDataActions();
  const { placing, activeId } = useVirtualUi();
  const { setPlacing, setActiveId } = useVirtualUiActions();
  const [preview, setPreview] = useState<[number, number] | null>(null);
  useCursor(placing);
  const virtual = buildings.filter((b) => b.isVirtual);
  const size = Math.max(radiusM, 100) * 3;

  const handlePlace = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // 드래그 끝 클릭은 무시
    addVirtual(Math.round(e.point.x), Math.round(e.point.z));
    setPlacing(false);
    setPreview(null);
  };

  return (
    <group name="virtual-buildings">
      {virtual.map((b) => (
        <VirtualMesh key={b.id} building={b} active={b.id === activeId} onPick={() => setActiveId(b.id)} />
      ))}
      {placing && (
        <>
          {/* 배치 모드: 건물보다 위에서 지면 클릭을 받는 투명 판 (건물 클릭이 선택으로 가지 않게) */}
          <mesh
            rotation-x={-Math.PI / 2}
            position-y={0.2}
            onClick={handlePlace}
            onPointerMove={(e) => setPreview([e.point.x, e.point.z])}
            onPointerOut={() => setPreview(null)}
            renderOrder={10}
          >
            <planeGeometry args={[size, size]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {preview && (
            <mesh position={[preview[0], 0.3, preview[1]]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[40, 18]} />
              <meshBasicMaterial color={VIRTUAL_COLOR} transparent opacity={0.45} depthWrite={false} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
