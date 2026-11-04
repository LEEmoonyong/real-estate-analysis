// [요구사항: 이벤트 처리] onPointerDown/Move/Up(드래그), onKeyDown(키보드로 높이 조절)
// [요구사항: 상태관리] useState(스냅 위치·드래그 중 높이), useRef(드래그 시작 정보)
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { SNAP_ORDER as ORDER, SNAP_RATIOS, nearestSnap, type SheetSnap } from './bottomSheetSnap';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  label: string;
  tabs?: ReactNode;
  children: ReactNode;
  initialSnap?: SheetSnap;
}

export function BottomSheet({ label, tabs, children, initialSnap = 'half' }: BottomSheetProps) {
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; ratio: number; moved: boolean } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { y: event.clientY, ratio: SNAP_RATIOS[snap], moved: false };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const dy = start.y - event.clientY;
    if (Math.abs(dy) > 4) start.moved = true;
    const ratio = Math.min(0.95, Math.max(0.08, start.ratio + dy / window.innerHeight));
    setDragRatio(ratio);
  };

  const handlePointerUp = () => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    if (start.moved && dragRatio !== null) {
      setSnap(nearestSnap(dragRatio));
    } else {
      // 탭(클릭)이면 다음 단계로 순환
      setSnap((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]!);
    }
    setDragRatio(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = ORDER.indexOf(snap);
    if (event.key === 'ArrowUp') setSnap(ORDER[Math.min(ORDER.length - 1, index + 1)]!);
    else if (event.key === 'ArrowDown') setSnap(ORDER[Math.max(0, index - 1)]!);
    else if (event.key === 'Enter' || event.key === ' ') setSnap(ORDER[(index + 1) % ORDER.length]!);
    else return;
    event.preventDefault();
  };

  const heightRatio = dragRatio ?? SNAP_RATIOS[snap];

  return (
    <section
      className={styles.sheet}
      data-dragging={dragRatio !== null}
      style={{ height: `${heightRatio * 100}dvh` }}
      aria-label={label}
    >
      <div
        className={styles.handleArea}
        role="slider"
        tabIndex={0}
        aria-label="시트 높이 조절 (위·아래 화살표)"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={ORDER.indexOf(snap)}
        aria-valuetext={{ peek: '접힘', half: '중간', full: '전체' }[snap]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.handle} />
      </div>
      {tabs}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
