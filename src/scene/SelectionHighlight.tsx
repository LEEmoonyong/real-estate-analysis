// [요구사항: 컴포넌트] 선택한 세대 강조 — 창문 패치 둘레에 테두리
import { useMemo } from 'react';
import { useSceneData } from '../contexts/SceneDataContext';
import { PATCH_EXTRA_OFFSET_M, PATCH_HEIGHT_RATIO, PATCH_WIDTH_RATIO } from '../domain/heatmap/patches';
import { findUnitIndex } from '../domain/units/generateUnits';

const BORDER_M = 0.45;

export function SelectionHighlight() {
  const { units, buildings, selectedUnitId } = useSceneData();
  const index = useMemo(
    () => (selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [units, buildings, selectedUnitId],
  );
  if (index < 0) return null;

  const nx = units.normals[index * 2]!;
  const nz = units.normals[index * 2 + 1]!;
  const w = units.lineWidth[index]! * PATCH_WIDTH_RATIO + BORDER_M * 2;
  const h = units.floorHeight[index]! * PATCH_HEIGHT_RATIO + BORDER_M * 2;
  // 패치보다 살짝 뒤(벽 쪽)에 더 큰 판을 두면 패치 둘레가 테두리처럼 보인다
  const offset = PATCH_EXTRA_OFFSET_M * 0.6;
  const position: [number, number, number] = [
    units.positions[index * 3]! + nx * offset,
    units.positions[index * 3 + 1]!,
    units.positions[index * 3 + 2]! + nz * offset,
  ];

  return (
    <mesh position={position} rotation-y={Math.atan2(nx, nz)} scale={[w, h, 1]} raycast={() => undefined}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ff4d00" toneMapped={false} />
    </mesh>
  );
}
