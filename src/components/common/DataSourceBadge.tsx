// 데이터 출처·추정값 비율·라이선스 표기 (3D 캔버스 왼쪽 아래)
import { useMemo, useState } from 'react';
import { SOURCE_LABELS } from '../../data/providers/BuildingProvider';
import { useSceneData } from '../../contexts/SceneDataContext';
import styles from './DataSourceBadge.module.css';

export function DataSourceBadge() {
  const { scene, buildings, droppedCount } = useSceneData();
  const [isOpen, setIsOpen] = useState(false);

  // [요구사항: Hooks] useMemo — 파생 통계
  const stats = useMemo(() => {
    const estimated = buildings.filter((b) => b.isEstimated).length;
    const corrected = buildings.filter((b) => b.isUserCorrected).length;
    return { estimated, corrected };
  }, [buildings]);

  if (!scene) return null;
  const isOsm = scene.source === 'osm' || scene.source === 'sample';

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.badge}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((o) => !o)}
        title="데이터 출처 자세히 보기"
      >
        {SOURCE_LABELS[scene.source]} · 건물 {buildings.length}개
        {stats.estimated > 0 && ` · 추정 ${stats.estimated}`}
      </button>
      {isOpen && (
        <div className={styles.details}>
          <p>
            <strong>{scene.place.name}</strong>
          </p>
          <ul>
            <li>표시 중인 건물 {buildings.length}개{droppedCount > 0 && ` (외곽선이 너무 작거나 잘못된 ${droppedCount}개 제외)`}</li>
            {stats.estimated > 0 && <li>층수 정보가 없어 높이를 추정한 건물 {stats.estimated}개</li>}
            {stats.corrected > 0 && <li>사용자가 층수를 보정한 건물 {stats.corrected}개</li>}
            {scene.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.attribution}>
        {isOsm ? '© OpenStreetMap contributors (ODbL)' : '건물: 국토교통부 V-World'}
      </p>
    </div>
  );
}
