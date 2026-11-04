// [요구사항: 상태관리] useState — 모바일 탭
// [요구사항: UI] 모바일: 전체 화면 캔버스 + 하단 시트 탭 전환 (컨트롤 / 세대 정보 / 분석)
import { useId, useState, type KeyboardEvent } from 'react';
import type { LayoutSlots } from './AppLayout';
import { BottomSheet } from './BottomSheet';
import styles from './Layouts.module.css';

export type MobileTab = 'controls' | 'detail' | 'analysis';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'controls', label: '컨트롤' },
  { id: 'detail', label: '세대 정보' },
  { id: 'analysis', label: '분석' },
];

export function MobileLayout({ header, primary, secondary, analysis, detail }: LayoutSlots) {
  const [activeTab, setActiveTab] = useState<MobileTab>('controls');
  const baseId = useId();

  // 좌우 화살표로 탭 이동 (WAI-ARIA 탭 패턴)
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = TABS.findIndex((t) => t.id === activeTab);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length]!;
    setActiveTab(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <header className={`${styles.header} ${styles.mobileHeader}`}>{header}</header>
      <BottomSheet
        label="컨트롤 시트"
        tabs={
          <div role="tablist" aria-label="시트 탭" className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${baseId}-panel`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={styles.tab}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={handleTabKeyDown}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${activeTab}`}>
          {activeTab === 'controls' && (
            <>
              {primary}
              {secondary}
            </>
          )}
          {activeTab === 'detail' && detail}
          {activeTab === 'analysis' && analysis}
        </div>
      </BottomSheet>
    </>
  );
}
