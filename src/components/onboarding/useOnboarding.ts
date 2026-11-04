// [요구사항: Hooks] 커스텀 훅 — 온보딩 진행 상태 (PLAN.md 7장 useOnboarding)
// useState(현재 단계·진행 중 여부), useLocalStorage(완료 여부 — 다시 방문하면 표시 안 함), useEffect(첫 방문 자동 시작)
import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../data/storage/schema';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { TOUR_STEPS, type TourStep } from './steps';

const isCompleted = (x: unknown): x is boolean => typeof x === 'boolean';

export interface Onboarding {
  active: boolean;
  stepIndex: number;
  step: TourStep;
  total: number;
  next: () => void;
  prev: () => void;
  skip: () => void;
  restart: () => void;
}

/** @param ready 첫 화면(장면)이 준비되면 true — 그 전에 자동 시작하면 가리킬 요소가 없다 */
export function useOnboarding(ready: boolean): Onboarding {
  const [completed, setCompleted] = useLocalStorage(STORAGE_KEYS.onboarding, false, {
    version: 1,
    validate: isCompleted,
  });
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // 첫 방문이면 장면이 준비된 뒤 자동 시작
  useEffect(() => {
    if (!ready || completed) return;
    const timer = window.setTimeout(() => setActive(true), 600);
    return () => window.clearTimeout(timer);
  }, [ready, completed]);

  const finish = useCallback(() => {
    setActive(false);
    setCompleted(true);
  }, [setCompleted]);

  const next = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) finish();
    else setStepIndex((i) => i + 1);
  }, [stepIndex, finish]);

  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const restart = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  return {
    active,
    stepIndex,
    step: TOUR_STEPS[stepIndex]!,
    total: TOUR_STEPS.length,
    next,
    prev,
    skip: finish,
    restart,
  };
}
