// [요구사항: 컴포넌트] 단지 상세의 일조 외 탭 공통 틀 — 머리글(← 지도, 단지 이름, 탭) + 스크롤 본문
import type { ReactNode } from 'react';
import { snapshotCapturedAt } from '../../data/marketSnapshot';
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
  // 샘플 모드: 실데이터 대신 저장해 둔 샘플 자료를 보여 주는 중 (status가 바뀔 때 다시 읽는다)
  const snapshot = snapshotCapturedAt();
  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        <BackToMap />
        <h1 className={styles.shellTitle}>{title}</h1>
        {snapshot && (
          <span className={styles.snapshotBadge} title="API 키도 배포 서버도 없어 저장해 둔 샘플 자료를 보여 줍니다.">
            샘플 자료 · {snapshot} 기준
          </span>
        )}
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
