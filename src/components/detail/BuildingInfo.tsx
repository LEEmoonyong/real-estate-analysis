// [요구사항: 컴포넌트] 선택한 건물 정보 + 동 번호 지정(B1) + 지상층수 보정(B4)
import { useMemo } from 'react';
import { FEATURES } from '../../config/features';
import { DongAssignDialog } from '../dongHo/DongAssignDialog';
import { HeightCorrectionForm } from '../heightCorrection/HeightCorrectionForm';
import { SOURCE_LABELS } from '../../data/providers/BuildingProvider';
import { useSceneData } from '../../contexts/SceneDataContext';
import styles from './BuildingInfo.module.css';

const HEIGHT_SOURCE_TEXT = {
  measured: '실측 높이',
  floors: '층수 × 층고',
  default: '추정값 (층수 정보 없음)',
  user: '사용자 보정',
} as const;

export function BuildingInfo() {
  const { buildings, selectedBuildingId } = useSceneData();
  const building = useMemo(() => buildings.find((b) => b.id === selectedBuildingId), [buildings, selectedBuildingId]);

  if (!building) {
    return (
      <p className={styles.empty}>
        3D 장면에서 건물 벽을 클릭하면 그 위치의 세대 일조 정보가, 지붕을 클릭하면 건물 정보만 표시됩니다.
      </p>
    );
  }

  const title = building.dongNumber ? `${building.dongNumber}동` : (building.name ?? '이름 없는 건물');
  return (
    <div className={styles.root}>
      <p className={styles.title}>
        {title}
        {building.isEstimated && <span className={styles.tag}>추정값</span>}
        {building.isUserCorrected && <span className={styles.tag}>보정됨</span>}
        {building.dongSource === 'user' && <span className={styles.tag}>동 번호 직접 지정</span>}
      </p>
      <dl className={styles.grid}>
        {building.name && building.dongNumber && (
          <>
            <dt>이름</dt>
            <dd>{building.name}</dd>
          </>
        )}
        <dt>지상층수</dt>
        <dd>{building.floors}층</dd>
        <dt>높이</dt>
        <dd>
          {building.heightM.toFixed(1)}m <small>({HEIGHT_SOURCE_TEXT[building.heightSource]})</small>
        </dd>
        <dt>바닥 면적</dt>
        <dd>{Math.round(building.areaM2).toLocaleString()}m²</dd>
        <dt>데이터</dt>
        <dd>{SOURCE_LABELS[building.source]}</dd>
      </dl>
      {FEATURES.dongHoSearch && <DongAssignDialog building={building} />}
      {FEATURES.heightCorrection && <HeightCorrectionForm building={building} />}
    </div>
  );
}
