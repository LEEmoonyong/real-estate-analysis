// 하단 시트 스냅 위치 계산 (순수 함수 — 단위 테스트 대상)

export type SheetSnap = 'peek' | 'half' | 'full';

/** 화면 높이 대비 비율 (가로 모드에서는 CSS max-height로 60% 제한) */
export const SNAP_RATIOS: Record<SheetSnap, number> = { peek: 0.15, half: 0.5, full: 0.9 };
export const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];

/** 드래그가 끝난 높이 비율에서 가장 가까운 스냅 위치 */
export function nearestSnap(ratio: number): SheetSnap {
  return SNAP_ORDER.reduce((best, snap) =>
    Math.abs(SNAP_RATIOS[snap] - ratio) < Math.abs(SNAP_RATIOS[best] - ratio) ? snap : best,
  );
}
