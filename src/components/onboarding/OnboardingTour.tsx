// [요구사항: 컴포넌트] 온보딩 가이드 (PLAN.md 단계 B6) — 대상 요소만 밝게 남기는 오버레이 + 말풍선
// [요구사항: 이벤트 처리] onClick(이전·다음·건너뛰기), keydown(←/→/Esc), resize·scroll(위치 다시 계산)
// [요구사항: UI] 말풍선은 대상 아래 → 위 → 대상 안쪽 순서로 화면에 들어가는 곳에 둔다 (3개 브레이크포인트 공통)
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Onboarding } from './useOnboarding';
import styles from './OnboardingTour.module.css';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const BUBBLE_SPACE = 210;

function measure(target: string): Rect | null {
  // 같은 data-tour가 여럿이면(레이아웃 전환 중) 화면에 보이는 첫 번째
  const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

export function OnboardingTour({ tour }: { tour: Onboarding }) {
  const { active, step, stepIndex, total, next, prev, skip } = tour;
  const [rect, setRect] = useState<Rect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // [요구사항: Hooks] useLayoutEffect — 그리기 전에 대상 위치를 재서 말풍선이 튀지 않게
  useLayoutEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => setRect(measure(step.target) ?? (step.fallbackTarget ? measure(step.fallbackTarget) : null));
    // 모바일 탭 전환 등으로 대상이 다음 프레임에 나타날 수 있어 한 번 더 잰다
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
    update();
    frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, step.target, step.fallbackTarget]);

  // 단계가 바뀌면 말풍선에 포커스 (스크린 리더가 새 내용을 읽도록)
  useEffect(() => {
    if (active) bubbleRef.current?.focus();
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skip();
      else if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') prev();
      else return;
      event.preventDefault();
      event.stopImmediatePropagation(); // 전역 단축키(←/→ 시각 이동)와 겹치지 않게
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [active, next, prev, skip]);

  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bubbleWidth = Math.min(340, vw - 32);
  let bubbleStyle: CSSProperties;
  if (!rect) {
    bubbleStyle = { top: vh / 2 - 100, left: (vw - bubbleWidth) / 2 };
  } else {
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - bubbleWidth / 2), vw - bubbleWidth - 16);
    const below = rect.top + rect.height + PAD + 12;
    if (below + BUBBLE_SPACE < vh) bubbleStyle = { top: below, left };
    else if (rect.top - PAD - 12 > BUBBLE_SPACE) bubbleStyle = { bottom: vh - rect.top + PAD + 12, left };
    // 대상이 화면 대부분을 차지하면(3D 장면) 대상 안쪽 아래에
    else bubbleStyle = { bottom: Math.max(16, vh - (rect.top + rect.height) + 16), left };
  }

  return createPortal(
    <div className={styles.root}>
      {rect ? (
        <div
          className={styles.hole}
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          aria-hidden="true"
        />
      ) : (
        <div className={styles.dim} aria-hidden="true" />
      )}
      <div
        ref={bubbleRef}
        className={styles.bubble}
        style={{ ...bubbleStyle, width: bubbleWidth }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
      >
        <p id="tour-title" className={styles.title}>
          {step.title}
        </p>
        <p id="tour-body" className={styles.body}>
          {step.body}
        </p>
        <div className={styles.footer}>
          <div className={styles.dots} aria-label={`${total}단계 중 ${stepIndex + 1}단계`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={styles.dot} data-active={i === stepIndex} />
            ))}
          </div>
          <button type="button" className={styles.textButton} onClick={skip}>
            건너뛰기
          </button>
          {stepIndex > 0 && (
            <button type="button" className={styles.button} onClick={prev}>
              이전
            </button>
          )}
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={next}>
            {stepIndex === total - 1 ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
