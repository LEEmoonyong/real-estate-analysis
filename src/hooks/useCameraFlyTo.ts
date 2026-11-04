// [요구사항: Hooks] 커스텀 훅 — 카메라를 목표 시점으로 부드럽게 이동 (PLAN.md 7장 useCameraFlyTo)
// useThree(카메라·다시 그리기), useRef(보간 상태 — 렌더와 무관하므로 상태로 두지 않음), useFrame(매 프레임 보간)
// 사용자가 마우스·터치로 조작을 시작하면 이동을 멈춘다(OrbitControls 'start' 이벤트).
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Vector3 } from 'three';
import type { CameraPose } from '../scene/focusPose';
import { easeInOutCubic } from '../scene/focusPose';

/** OrbitControls 중 이 훅이 쓰는 부분 */
interface ControlsLike {
  target: Vector3;
  update: () => unknown;
  addEventListener: (type: 'start', listener: () => void) => void;
  removeEventListener: (type: 'start', listener: () => void) => void;
}

interface Flight {
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  startedAt: number;
  durationMs: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function useCameraFlyTo(controlsRef: RefObject<ControlsLike | null>) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const flightRef = useRef<Flight | null>(null);

  // 사용자가 조작을 시작하면 보간 중단 (카메라를 빼앗지 않도록)
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const stop = () => {
      flightRef.current = null;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controlsRef]);

  useFrame(() => {
    const flight = flightRef.current;
    const controls = controlsRef.current;
    if (!flight || !controls) return;
    const t = Math.min(1, (performance.now() - flight.startedAt) / flight.durationMs);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, e);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
    controls.update();
    if (t < 1) invalidate();
    else flightRef.current = null;
  });

  const flyTo = useCallback(
    (pose: CameraPose, durationMs = 900) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const toPosition = new Vector3(...pose.position);
      const toTarget = new Vector3(...pose.lookAt);
      if (durationMs <= 0 || prefersReducedMotion()) {
        // 움직임 줄이기 설정이면 바로 이동
        flightRef.current = null;
        camera.position.copy(toPosition);
        controls.target.copy(toTarget);
        controls.update();
        invalidate();
        return;
      }
      flightRef.current = {
        fromPosition: camera.position.clone(),
        toPosition,
        fromTarget: controls.target.clone(),
        toTarget,
        startedAt: performance.now(),
        durationMs,
      };
      invalidate();
    },
    [camera, controlsRef, invalidate],
  );

  const cancel = useCallback(() => {
    flightRef.current = null;
  }, []);

  return { flyTo, cancel };
}
