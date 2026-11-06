// [요구사항: 컴포넌트] 앱 제목·데이터 모드 배지·도움말 버튼(가이드 다시 보기, 단축키, 시뮬레이션 한계)
// [요구사항: 이벤트 처리] onClick(도움말 버튼)
import type { ReactNode } from 'react';
import type { ApiHealth } from '../../hooks/useApiHealth';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  health: ApiHealth;
  /** 제목 앞 이동 요소 (예: 지도로 돌아가기) */
  nav?: ReactNode;
  onShowTour?: () => void;
  onShowShortcuts?: () => void;
  onShowLimitations?: () => void;
}

export function AppHeader({ health, nav, onShowTour, onShowShortcuts, onShowLimitations }: AppHeaderProps) {
  return (
    <div className={styles.header}>
      {nav}
      <h1 className={styles.title}>
        <span aria-hidden="true">☀</span>
        <span className={styles.titleText}> 일조 시뮬레이터</span>
      </h1>
      {health.mode === 'sample' && (
        <span className={styles.badge} title={health.reason ?? undefined} role="status">
          샘플 모드
        </span>
      )}
      {health.mode === 'live' && health.route === 'remote' && (
        <span
          className={styles.badge}
          title="이 컴퓨터에 API 키가 없어, 검색·건물 데이터를 배포 서버(키 보관)를 거쳐 받고 있습니다."
          role="status"
          data-api-route="remote"
        >
          배포 서버 경유
        </span>
      )}
      {health.mode === 'checking' && (
        <span className={styles.muted} role="status">
          연결 확인 중…
        </span>
      )}
      <div className={styles.actions}>
        {onShowTour && (
          <button type="button" className={styles.iconButton} onClick={onShowTour} title="사용 가이드 다시 보기">
            <span aria-hidden="true">?</span>
            <span className={styles.srOnly}>사용 가이드 다시 보기</span>
          </button>
        )}
        {onShowShortcuts && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.desktopOnly}`}
            onClick={onShowShortcuts}
            title="키보드 단축키 (?)"
          >
            <span aria-hidden="true">⌨</span>
            <span className={styles.srOnly}>키보드 단축키</span>
          </button>
        )}
        {onShowLimitations && (
          <button type="button" className={styles.iconButton} onClick={onShowLimitations} title="시뮬레이션 한계">
            <span aria-hidden="true">ⓘ</span>
            <span className={styles.srOnly}>시뮬레이션 한계</span>
          </button>
        )}
      </div>
    </div>
  );
}
