import type { ApiHealth } from '../../hooks/useApiHealth';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  health: ApiHealth;
}

/** 앱 제목과 데이터 모드 배지 (도움말·설정·한계 안내 버튼은 10일차에 추가) */
export function AppHeader({ health }: AppHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>
        <span aria-hidden="true">☀</span> 일조 시뮬레이터
      </h1>
      {health.mode === 'sample' && (
        <span className={styles.badge} title={health.reason ?? undefined} role="status">
          샘플 모드
        </span>
      )}
      {health.mode === 'checking' && (
        <span className={styles.muted} role="status">
          연결 확인 중…
        </span>
      )}
    </div>
  );
}
