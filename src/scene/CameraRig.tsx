// 궤도 카메라 — 마우스 드래그 회전·휠 확대, 터치 한 손가락 회전·두 손가락 확대
// 장면이 바뀌면 전체가 보이도록 카메라를 맞추고, 나침반 방향을 DOM에 직접 반영한다(리렌더 없음).
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ElementRef, type RefObject } from 'react';
import { useSceneData } from '../contexts/SceneDataContext';
import { findUnitIndex } from '../domain/units/generateUnits';
import { useCameraFlyTo } from '../hooks/useCameraFlyTo';
import { defaultCameraPosition } from './buildingGeometry';
import { buildingFocusPose, unitFocusPose } from './focusPose';

type OrbitControlsImpl = ElementRef<typeof OrbitControls>;

interface CameraRigProps {
  /** 장면 반경 [m] */
  radiusM: number;
  /** 장면이 바뀔 때마다 달라지는 키 (카메라 재배치 트리거) */
  sceneKey: string;
  /** 나침반 요소 — 카메라 방위에 맞춰 회전 */
  compassRef: RefObject<HTMLElement | null>;
  /** 투영 중심을 화면 높이의 이 비율만큼 위로 올린다 (모바일: 아래 바텀시트에 가리지 않게) */
  viewShiftRatio?: number;
}

export function CameraRig({ radiusM, sceneKey, compassRef, viewShiftRatio = 0 }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const getState = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const { focusRequest, buildings, units } = useSceneData();
  const { flyTo, cancel } = useCameraFlyTo(controlsRef);

  // 화면 크기·기기가 바뀔 때마다 투영 중심 이동을 다시 맞춘다 (R3F 리사이즈 이후 실행)
  useEffect(() => {
    if (!('setViewOffset' in camera)) return;
    if (viewShiftRatio > 0 && size.height > 0) {
      camera.setViewOffset(size.width, size.height, 0, size.height * viewShiftRatio, size.width, size.height);
    } else {
      camera.clearViewOffset();
    }
    invalidate();
  }, [camera, size.width, size.height, viewShiftRatio, invalidate]);

  // [요구사항: Hooks] useEffect — 새 장면이면 카메라를 장면 전체가 보이게 배치
  useEffect(() => {
    // 화면 비율은 리렌더 없이 현재 값을 읽는다 (창 크기가 바뀔 때마다 사용자가 돌려 놓은 시점을 되돌리지 않도록)
    const { width, height } = getState().size;
    const fov = 'fov' in camera ? camera.fov : 45;
    const [x, y, z] = defaultCameraPosition(radiusM, fov, height > 0 ? width / height : 1.5);
    cancel();
    camera.position.set(x, y, z);
    camera.near = 1;
    camera.far = Math.max(radiusM, 100) * 20;
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
    invalidate();
    // radiusM은 sceneKey와 함께 바뀌므로 sceneKey만 의존해도 되지만 명시적으로 둔다
  }, [sceneKey, radiusM, camera, invalidate, getState, cancel]);

  // 동·호수 검색 등으로 대상을 고르면 그쪽으로 카메라 이동 (요청 번호가 바뀔 때만 — 건물·세대가 다시 만들어져도 다시 날지 않게)
  const focusDataRef = useRef({ buildings, units });
  focusDataRef.current = { buildings, units };
  useEffect(() => {
    if (!focusRequest) return;
    const { buildings: list, units: set } = focusDataRef.current;
    const building = list.find((b) => b.id === focusRequest.buildingId);
    if (!building) return;
    const index = focusRequest.unitId ? findUnitIndex(set, list, focusRequest.unitId) : -1;
    if (index >= 0) {
      flyTo(
        unitFocusPose(
          [set.positions[index * 3]!, set.positions[index * 3 + 1]!, set.positions[index * 3 + 2]!],
          [set.normals[index * 2]!, set.normals[index * 2 + 1]!],
          building.heightM,
        ),
      );
    } else {
      const target = controlsRef.current?.target ?? new Vector3();
      const dir = camera.position.clone().sub(target).normalize();
      flyTo(buildingFocusPose(building.ring, building.heightM, [dir.x, dir.y, dir.z]));
    }
  }, [focusRequest, flyTo, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    const compass = compassRef.current;
    if (!controls || !compass) return;
    // 방위각 θ=0이면 카메라가 남쪽(+z)에서 북쪽을 바라봄 → 북쪽이 화면 위
    compass.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
  });

  const r = Math.max(radiusM, 80);
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={15}
      maxDistance={r * 6}
      maxPolarAngle={Math.PI / 2 - 0.03} // 지면 아래로 내려가지 않게
      screenSpacePanning={false}
    />
  );
}
