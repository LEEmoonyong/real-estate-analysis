// [요구사항: 컴포넌트] 3D 캔버스 — R3F Canvas, 조명, 지면, 건물, 카메라
// [요구사항: 이벤트 처리] onPointerMissed(빈 곳 클릭 → 선택 해제)
// [요구사항: UI] 캔버스는 부모 크기에 맞춰 자동 리사이즈, 기기별 devicePixelRatio 상한
import { Canvas } from '@react-three/fiber';
import { useRef } from 'react';
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Buildings } from './Buildings';
import { defaultCameraPosition } from './buildingGeometry';
import { CameraRig } from './CameraRig';
import { Ground } from './Ground';
import styles from './SceneCanvas.module.css';

const MAX_DPR = { mobile: 1.5, tablet: 1.75, desktop: 2 } as const;

export function SceneCanvas() {
  const { scene, buildings, radiusM, selectedBuildingId } = useSceneData();
  const { clearSelection } = useSceneDataActions();
  const breakpoint = useBreakpoint();
  const compassRef = useRef<HTMLDivElement>(null);
  const sceneKey = scene ? `${scene.source}:${scene.place.lat},${scene.place.lng}` : 'empty';

  return (
    <div
      className={styles.root}
      data-building-count={buildings.length}
      data-selected-building={selectedBuildingId ?? ''}
    >
      <Canvas
        dpr={[1, MAX_DPR[breakpoint]]}
        frameloop="demand" // 변화가 있을 때만 그려 모바일 배터리·발열을 줄인다
        camera={{ fov: 45, position: defaultCameraPosition(radiusM) }}
        onPointerMissed={clearSelection}
        aria-label="3D 아파트 단지 장면"
      >
        <color attach="background" args={['#cfe3f5']} />
        <hemisphereLight args={['#ffffff', '#b8b29f', 0.9]} />
        {/* 5일차에 태양 방향 DirectionalLight + 그림자로 교체 */}
        <directionalLight position={[200, 400, 300]} intensity={1.2} />
        <Ground radiusM={radiusM} />
        <Buildings />
        <CameraRig radiusM={radiusM} sceneKey={sceneKey} compassRef={compassRef} />
      </Canvas>

      <div className={styles.compass} aria-hidden="true" title="북쪽">
        <div ref={compassRef} className={styles.needle}>
          <span className={styles.north}>N</span>
        </div>
      </div>

      {!scene && <p className={styles.empty}>지역을 검색하거나 샘플 지역을 선택하세요.</p>}
    </div>
  );
}
