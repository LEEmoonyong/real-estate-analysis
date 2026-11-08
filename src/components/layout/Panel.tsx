import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title: string;
  /** 온보딩 가이드가 찾는 앵커 (data-tour) */
  tourId?: string;
  actions?: ReactNode;
  /** 있으면 머리 오른쪽에 닫기(×) 버튼 — 누르면 호출 */
  onClose?: (() => void) | undefined;
  /** 닫기 버튼의 스크린리더 이름 */
  closeLabel?: string;
  children: ReactNode;
}

/** 컨트롤·상세 패널 안의 제목 있는 구역 */
export function Panel({ title, tourId, actions, onClose, closeLabel = '닫기', children }: PanelProps) {
  return (
    <section className={styles.panel} data-tour={tourId} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions}
        {onClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            ×
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
