import type { LayoutSlots } from './AppLayout';
import styles from './Layouts.module.css';

/** 데스크톱: 좌측 컨트롤 패널 + 우측 상세 패널 (캔버스는 AppLayout이 렌더링) */
export function DesktopLayout({ header, search, primary, secondary, analysis, detail }: LayoutSlots) {
  return (
    <>
      <header className={styles.header}>{header}</header>
      <aside className={`${styles.panel} ${styles.left}`} aria-label="컨트롤">
        {search}
        {primary}
        {analysis}
        {secondary}
      </aside>
      <aside className={`${styles.panel} ${styles.right}`} aria-label="상세 정보">
        {detail}
      </aside>
    </>
  );
}
