// 궤도 카메라 — 마우스 드래그 회전·휠 확대, 터치 한 손가락 회전·두 손가락 확대
// 장면이 바뀌면 전체가 보이도록 카메라를 맞추고, 나침반 방향을 DOM에 직접 반영한다(리렌더 없음).
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ElementRef, type RefObject } from 'react';
import { defaultCameraPosition } from './buildingGeometry';

type OrbitControlsImpl = ElementRef<typeof OrbitControls>;

interface CameraRigProps {
  /** 장면 반경 [m] */
  radiusM: number;
  /** 장면이 바뀔 때마다 달라지는 키 (카메라 재배치 트리거) */
  sceneKey: string;
  /** 나침반 요소 — 카메라 방위에 맞춰 회전 */
  compassRef: RefObject<HTMLElement | null>;
}

export function CameraRig({ radiusM, sceneKey, compassRef }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  // [요구사항: Hooks] useEffect — 새 장면이면 카메라를 장면 전체가 보이게 배치
  useEffect(() => {
    const [x, y, z] = defaultCameraPosition(radiusM);
    camera.position.set(x, y, z);
    camera.near = 1;
    camera.far = Math.max(radiusM, 100) * 20;
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
    invalidate();
    // radiusM은 sceneKey와 함께 바뀌므로 sceneKey만 의존해도 되지만 명시적으로 둔다
  }, [sceneKey, radiusM, camera, invalidate]);

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
      maxDistance={r * 4}
      maxPolarAngle={Math.PI / 2 - 0.03} // 지면 아래로 내려가지 않게
      screenSpacePanning={false}
    />
  );
}
