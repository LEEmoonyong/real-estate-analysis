// [요구사항: 컴포넌트] 단지 상세의 일조 외 탭 공통 틀 — 머리글(← 지도, 단지 이름, 탭) + 스크롤 본문
import type { ReactNode } from 'react';
import type { ComplexTab, ComplexTarget } from '../../routes/complexKey';
import { BackToMap, ComplexTabs } from './ComplexTabs';
import styles from './Complex.module.css';

interface ComplexShellProps {
  target: ComplexTarget;
  tab: ComplexTab;
  title: string;
  /** 본문 상태 표시용 data 속성 (점검·테스트용) */
  status?: string;
  children: ReactNode;
}

export function ComplexShell({ target, tab, title, status, children }: ComplexShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        <BackToMap />
        <h1 className={styles.shellTitle}>{title}</h1>
        <ComplexTabs target={target} active={tab} />
      </header>
      <main className={styles.shellBody}>
        <div className={styles.content} data-market-status={status}>
          {children}
        </div>
      </main>
    </div>
  );
}
