// [요구사항: 컴포넌트] 선택한 세대 강조 — 창문 패치 둘레에 테두리
// 동·호수 검색으로 찾았으면 카메라 이동이 끝날 즈음 테두리를 몇 번 크게 깜빡여(펄스) 위치를 알려 준다.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { useSceneData } from '../contexts/SceneDataContext';
import { PATCH_EXTRA_OFFSET_M, PATCH_HEIGHT_RATIO, PATCH_WIDTH_RATIO } from '../domain/heatmap/patches';
import { findUnitIndex } from '../domain/units/generateUnits';

const BORDER_M = 0.45;
/** 펄스: 카메라 이동(0.9초) 뒤 1.5초 동안 3번 */
const PULSE_DELAY_MS = 700;
const PULSE_MS = 1500;
const PULSE_COUNT = 3;

export function SelectionHighlight() {
  const { units, buildings, selectedUnitId, focusRequest } = useSceneData();
  const meshRef = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const pulseStartRef = useRef<number | null>(null);

  const pulseSeq = focusRequest?.unitId && focusRequest.unitId === selectedUnitId ? focusRequest.seq : null;
  useEffect(() => {
    if (pulseSeq === null) return;
    pulseStartRef.current = performance.now() + PULSE_DELAY_MS;
    invalidate();
  }, [pulseSeq, invalidate]);

  useFrame(() => {
    const start = pulseStartRef.current;
    const mesh = meshRef.current;
    if (start === null || !mesh) return;
    const t = (performance.now() - start) / PULSE_MS;
    // 테두리 판 크기에 곱하는 배율 (1 → 2.2 → 1을 반복)
    const k = t < 0 || t >= 1 ? 1 : 1 + 1.2 * Math.sin(Math.PI * ((t * PULSE_COUNT) % 1));
    mesh.scale.set(mesh.userData.w * k, mesh.userData.h * k, 1);
    if (t >= 1) pulseStartRef.current = null;
    invalidate();
  });
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
    <mesh
      ref={meshRef}
      userData={{ w, h }}
      position={position}
      rotation-y={Math.atan2(nx, nz)}
      scale={[w, h, 1]}
      raycast={() => undefined}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ff4d00" toneMapped={false} />
    </mesh>
  );
}
