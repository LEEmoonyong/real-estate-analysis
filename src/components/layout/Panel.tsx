import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title: string;
  /** 온보딩 가이드가 찾는 앵커 (data-tour) */
  tourId?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** 컨트롤·상세 패널 안의 제목 있는 구역 */
export function Panel({ title, tourId, actions, children }: PanelProps) {
  return (
    <section className={styles.panel} data-tour={tourId} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
