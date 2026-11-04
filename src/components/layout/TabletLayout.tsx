// [요구사항: 상태관리] useState — 상세 패널 접힘, 드로어 열림
// [요구사항: 이벤트 처리] onClick(패널 토글), keydown(Esc로 드로어 닫기)
import { useEffect, useState } from 'react';
import type { LayoutSlots } from './AppLayout';
import styles from './Layouts.module.css';

/** 태블릿: 상단 바(검색·날짜·시각) + 접이식 우측 상세 패널 + 좌측 드로어(보조·분석) */
export function TabletLayout({ header, primary, secondary, analysis, detail }: LayoutSlots) {
  // 세로 태블릿(768px)에서는 패널을 펼치면 캔버스가 400px 남짓만 남으므로 가로가 넓을 때만 펼친 채 시작
  // (세대를 선택하면 자동으로 펼치는 동작은 7일차에 추가)
  const [isDetailOpen, setIsDetailOpen] = useState(() => window.innerWidth >= 1000);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  return (
    <>
      <header className={`${styles.header} ${styles.tabletHeader}`}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="메뉴 열기"
          aria-expanded={isDrawerOpen}
          aria-controls="tablet-drawer"
          onClick={() => setIsDrawerOpen(true)}
        >
          ☰
        </button>
        {header}
        <div className={styles.tabletPrimary}>{primary}</div>
      </header>

      <aside
        className={`${styles.panel} ${styles.right} ${styles.tabletRight} ${isDetailOpen ? '' : styles.collapsed}`}
        aria-label="상세 정보"
      >
        <button
          type="button"
          className={styles.collapseToggle}
          aria-expanded={isDetailOpen}
          aria-label={isDetailOpen ? '상세 패널 접기' : '상세 패널 펼치기'}
          onClick={() => setIsDetailOpen((open) => !open)}
        >
          {isDetailOpen ? '▶' : '◀'}
        </button>
        {isDetailOpen && <div className={styles.panelBody}>{detail}</div>}
      </aside>

      {isDrawerOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setIsDrawerOpen(false)} aria-hidden="true" />
          <nav id="tablet-drawer" className={styles.drawer} aria-label="보조 메뉴">
            <button
              type="button"
              className={`${styles.iconButton} ${styles.drawerClose}`}
              aria-label="메뉴 닫기"
              onClick={() => setIsDrawerOpen(false)}
            >
              ✕
            </button>
            {analysis}
            {secondary}
          </nav>
        </>
      )}
    </>
  );
}
