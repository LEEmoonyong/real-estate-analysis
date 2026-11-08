// [요구사항: UI] 로딩·오류·데이터 없음·샘플 전환 안내
// [요구사항: 이벤트 처리] onClick(재시도, 샘플 보기, 닫기)
import { SOURCE_LABELS } from '../../data/providers/BuildingProvider';
import { useSimulation } from '../../contexts/SimulationContext';
import type { BuildingsNotice } from '../../hooks/useBuildings';
import styles from './StatusBanner.module.css';

interface StatusBannerProps {
  notice: BuildingsNotice | null;
  onDismissNotice: () => void;
  onRetry: () => void;
  onShowSample: () => void;
}

export function StatusBanner({ notice, onDismissNotice, onRetry, onShowSample }: StatusBannerProps) {
  const { phase, loadingSource, error } = useSimulation();

  if (phase === 'loading') {
    return (
      <div className={styles.banner} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <span>
          {loadingSource ? `${SOURCE_LABELS[loadingSource]}에서 건물 데이터를 불러오는 중…` : '불러오는 중…'}
          {loadingSource === 'osm' && (
            <small className={styles.sub}>OpenStreetMap은 응답에 최대 25초가 걸릴 수 있습니다.</small>
          )}
        </span>
      </div>
    );
  }

  if (phase === 'error' && error) {
    return (
      <div className={`${styles.banner} ${styles.error}`} role="alert">
        <span>{error.message}</span>
        <span className={styles.actions}>
          {error.kind !== 'no-buildings' && (
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          )}
          <button type="button" onClick={onShowSample}>
            샘플 지역 보기
          </button>
        </span>
      </div>
    );
  }

  if (notice) {
    return (
      <div className={`${styles.banner} ${notice.tone === 'warning' ? styles.warning : ''}`} role="status">
        <span>{notice.message}</span>
        <button type="button" className={styles.close} aria-label="안내 닫기" onClick={onDismissNotice}>
          ✕
        </button>
      </div>
    );
  }

  return null;
}
