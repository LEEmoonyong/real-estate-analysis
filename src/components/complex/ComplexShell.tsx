// [요구사항: 컴포넌트] 단지 상세의 일조 외 탭 공통 틀 — 머리글(← 지도, 단지 이름, 탭, 도움말) + 스크롤 본문
// [요구사항: 상태관리] useState — 도움말 대화상자 열림
// 도움말 버튼(?, ⌨, ⓘ)은 일조·조망 탭과 같은 자리·같은 모양. "?"는 일조·조망 탭으로 가서 사용 가이드를 시작한다.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpButtons } from '../common/AppHeader';
import { LimitationsDialog, ShortcutsDialog } from '../common/HelpDialogs';
import { snapshotCapturedAt } from '../../data/marketSnapshot';
import { complexPath, type ComplexTab, type ComplexTarget } from '../../routes/complexKey';
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
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'shortcuts' | 'limitations' | null>(null);
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
        <HelpButtons
          onShowTour={() => navigate(complexPath(target, 'sun'), { state: { tour: true } })}
          onShowShortcuts={() => setDialog('shortcuts')}
          onShowLimitations={() => setDialog('limitations')}
        />
      </header>
      <main className={styles.shellBody}>
        <div className={styles.content} data-market-status={status}>
          {children}
        </div>
      </main>
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={() => setDialog(null)} />
      <LimitationsDialog open={dialog === 'limitations'} onClose={() => setDialog(null)} />
    </div>
  );
}
