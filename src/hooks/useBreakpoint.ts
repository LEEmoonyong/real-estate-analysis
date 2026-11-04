// [요구사항: UI] 반응형 브레이크포인트 — 모바일 < 768px, 태블릿 768~1199px, 데스크톱 ≥ 1200px
// 가로로 돌린 휴대폰(예: 812×375)은 폭만 보면 태블릿이지만 높이가 낮아 상단 바가 캔버스를 가리므로 모바일로 본다.
import { useMediaQuery } from './useMediaQuery';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export const BREAKPOINT_QUERIES = {
  tablet: '(min-width: 768px)',
  desktop: '(min-width: 1200px)',
  shortLandscape: '(max-height: 500px) and (orientation: landscape)',
} as const;

export function resolveBreakpoint(isTabletUp: boolean, isDesktop: boolean, isShortLandscape: boolean): Breakpoint {
  if (isShortLandscape) return 'mobile';
  if (isDesktop) return 'desktop';
  return isTabletUp ? 'tablet' : 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const isTabletUp = useMediaQuery(BREAKPOINT_QUERIES.tablet);
  const isDesktop = useMediaQuery(BREAKPOINT_QUERIES.desktop);
  const isShortLandscape = useMediaQuery(BREAKPOINT_QUERIES.shortLandscape);
  return resolveBreakpoint(isTabletUp, isDesktop, isShortLandscape);
}
