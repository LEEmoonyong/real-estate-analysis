// [요구사항: 컴포넌트] 태양광 — 선택한 날짜·시각의 태양 방향에서 비추는 DirectionalLight + 실시간 그림자
// [요구사항: Hooks] useSunPosition(커스텀 훅), useLayoutEffect(그림자 카메라 갱신)
//
// 태양이 지평선 아래면 직사광과 그림자를 끄고 하늘을 어둡게 한다(PLAN.md A3).
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { DEFAULT_LOCATION } from '../config/constants';
import { useSceneData } from '../contexts/SceneDataContext';
import { useTime } from '../contexts/TimeContext';
import { useSunPosition } from '../hooks/useSunPosition';
import { lightingForAltitude, shadowFrustum } from './lighting';

interface SunLightProps {
  /** 그림자 맵 한 변 [px] (품질 프리셋) */
  shadowMapSize: number;
}

export function SunLight({ shadowMapSize }: SunLightProps) {
  const { scene, radiusM, maxHeightM } = useSceneData();
  const { date, minuteOfDay } = useTime();
  const place = scene?.place ?? DEFAULT_LOCATION;
  const sun = useSunPosition(place.lat, place.lng, date, minuteOfDay);
  const levels = lightingForAltitude(sun.altitudeDeg);
  const frustum = useMemo(() => shadowFrustum(radiusM, maxHeightM), [radiusM, maxHeightM]);

  const lightRef = useRef<DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);

  // 그림자 카메라 범위·해상도 반영 — 속성만 바꾸면 투영 행렬과 그림자 맵이 갱신되지 않는다
  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -frustum.halfSize;
    cam.right = frustum.halfSize;
    cam.top = frustum.halfSize;
    cam.bottom = -frustum.halfSize;
    cam.near = frustum.near;
    cam.far = frustum.far;
    cam.updateProjectionMatrix();
    if (light.shadow.mapSize.x !== shadowMapSize) {
      light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      light.shadow.map?.dispose();
      light.shadow.map = null; // 다음 렌더에서 새 크기로 다시 만든다
    }
    // 그림자 텍셀 크기[m]에 맞춘 법선 방향 오프셋 — 벽면 줄무늬(shadow acne) 방지
    light.shadow.normalBias = ((frustum.halfSize * 2) / shadowMapSize) * 1.2;
    invalidate();
  }, [frustum, shadowMapSize, invalidate]);

  const [dx, dy, dz] = sun.direction;
  return (
    <>
      <color attach="background" args={[levels.skyColor]} />
      {/* args는 생성자 인자라 바뀌면 객체를 새로 만든다 → 재생 중 매 프레임 바뀌는 세기는 속성으로 넘긴다 */}
      <hemisphereLight color="#ffffff" groundColor="#b8b29f" intensity={levels.ambientIntensity} />
      <directionalLight
        ref={lightRef}
        position={[dx * frustum.distance, dy * frustum.distance, dz * frustum.distance]}
        color={levels.sunColor}
        intensity={levels.sunIntensity}
        visible={sun.isUp}
        castShadow={sun.isUp}
        shadow-bias={-0.0005}
      />
    </>
  );
}
