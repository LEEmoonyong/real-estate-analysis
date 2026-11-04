// [요구사항: 컴포넌트] 창문 시점 조작 막대 (C7) — 3D 장면 위에 뜬다
// [요구사항: 이벤트 처리] onClick(궤도 보기로 돌아가기), onChange(시야각 슬라이더)
import { useId } from 'react';
import { useSceneData, useSceneDataActions } from '../../contexts/SceneDataContext';
import { useSettings, useSettingsActions } from '../../contexts/SettingsContext';
import styles from './WindowViewControls.module.css';

export function WindowViewControls() {
  const { cameraMode } = useSceneData();
  const { setCameraMode } = useSceneDataActions();
  const { windowFov } = useSettings();
  const { setWindowFov } = useSettingsActions();
  const fovId = useId();
  if (cameraMode !== 'window') return null;

  return (
    <div className={styles.root} role="group" aria-label="창문 시점" data-camera-mode="window">
      <button type="button" className={styles.back} onClick={() => setCameraMode('orbit')}>
        ← 궤도 보기로 (Esc)
      </button>
      <label htmlFor={fovId} className={styles.label}>
        시야각 {windowFov}°
      </label>
      <input
        id={fovId}
        type="range"
        min={40}
        max={100}
        step={5}
        value={windowFov}
        onChange={(e) => setWindowFov(Number(e.target.value))}
        className={styles.range}
      />
      <span className={styles.hint}>드래그해서 둘러보기 · 시각 슬라이더로 해가 가려지는 순간 확인</span>
    </div>
  );
}
