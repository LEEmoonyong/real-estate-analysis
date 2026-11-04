// [요구사항: UI] 반응형 레이아웃 — 브레이크포인트별로 같은 컴포넌트를 배치만 바꾼다 (PLAN.md 13장)
// [요구사항: 컴포넌트] 레이아웃 컴포넌트
//
// 3D 캔버스(scene)는 항상 첫 번째 자식으로 같은 위치에 렌더링한다.
// 그래서 창 크기가 바뀌어 레이아웃이 전환돼도 캔버스(WebGL 컨텍스트)가 다시 만들어지지 않는다.
import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';
import { TabletLayout } from './TabletLayout';
import styles from './AppLayout.module.css';

export interface LayoutSlots {
  /** 앱 제목·도구 버튼 */
  header: ReactNode;
  /** 3D 캔버스 */
  scene: ReactNode;
  /** 검색창 (모바일에서는 화면 위에 떠 있음) */
  search: ReactNode;
  /** 자주 쓰는 컨트롤: 날짜, 시각 */
  primary: ReactNode;
  /** 보조 컨트롤: 동·호수, 즐겨찾기, 최근 검색 */
  secondary: ReactNode;
  /** 분석 레이어, 계절 타임랩스 */
  analysis: ReactNode;
  /** 선택한 건물·세대 상세 */
  detail: ReactNode;
}

export function AppLayout(slots: LayoutSlots) {
  const breakpoint = useBreakpoint();
  return (
    <div className={styles.root} data-breakpoint={breakpoint}>
      <main className={styles.scene} aria-label="3D 장면">
        {slots.scene}
      </main>
      {breakpoint === 'desktop' && <DesktopLayout {...slots} />}
      {breakpoint === 'tablet' && <TabletLayout {...slots} />}
      {breakpoint === 'mobile' && <MobileLayout {...slots} />}
    </div>
  );
}
