// [요구사항: 컴포넌트] 단지 상세 머리글 — ← 지도 · 단지 이름 · 데이터 모드 배지 · 탭 · 도움말 버튼
//   일조·조망 탭(SunlightWorkspace)과 다른 탭(ComplexShell)이 같은 모양을 쓰도록 도움말 버튼을 따로 내보낸다.
// [요구사항: 이벤트 처리] onClick(도움말 버튼 — 가이드 다시 보기, 단축키, 시뮬레이션 한계)
import type { ReactNode } from 'react';
import type { ApiHealth } from '../../hooks/useApiHealth';
import styles from './AppHeader.module.css';

export interface HelpActions {
  onShowTour?: (() => void) | undefined;
  onShowShortcuts?: (() => void) | undefined;
  onShowLimitations?: (() => void) | undefined;
}

/** 오른쪽 끝 도움말 버튼 묶음 (?, ⌨, ⓘ) — 모든 단지 탭에서 같은 자리·같은 모양 */
export function HelpButtons({ onShowTour, onShowShortcuts, onShowLimitations }: HelpActions) {
  return (
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
  );
}

interface AppHeaderProps extends HelpActions {
  health: ApiHealth;
  /** 제목 앞 이동 요소 (예: 지도로 돌아가기) */
  nav?: ReactNode;
  /** 단지(장소) 이름 */
  title: string;
  /** 제목 뒤 탭 */
  tabs?: ReactNode;
}

export function AppHeader({ health, nav, title, tabs, ...help }: AppHeaderProps) {
  return (
    <div className={styles.header}>
      {nav}
      <h1 className={styles.title}>{title}</h1>
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
      {tabs}
      <HelpButtons {...help} />
    </div>
  );
}
