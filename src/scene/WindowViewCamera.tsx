// [요구사항: 컴포넌트] 창문 시점 (C7) — 선택한 세대 창문 바로 앞(법선 방향 0.3m)에서 바깥을 본다
// [요구사항: 이벤트 처리] 캔버스 pointerdown/move/up(드래그로 둘러보기), 시야각은 SettingsContext
// 들어갈 때 궤도 카메라 상태를 저장하고, 나오면(Esc·버튼·선택 해제) 그대로 되돌린다.
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { useSettings } from '../contexts/SettingsContext';
import { findUnitIndex } from '../domain/units/generateUnits';
import { clampLook, windowLookDirection } from './windowView';

const WINDOW_OFFSET_M = 0.3;
const RAD = Math.PI / 180;

interface Saved {
  position: Vector3;
  target: Vector3;
  fov: number;
  near: number;
}

export function WindowViewCamera() {
  const { cameraMode, selectedUnitId, units, buildings } = useSceneData();
  const { setCameraMode } = useSceneDataActions();
  const { windowFov } = useSettings();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const active = cameraMode === 'window';
  const index = useMemo(
    () => (active && selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [active, selectedUnitId, units, buildings],
  );
  const savedRef = useRef<Saved | null>(null);
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const lookIndexRef = useRef(-1);

  // 세대가 없으면(선택 해제·주향 면이 사라짐) 궤도 보기로 돌아간다
  useEffect(() => {
    if (active && index < 0) setCameraMode('orbit');
  }, [active, index, setCameraMode]);

  // 들어갈 때 저장, 나올 때 복원
  useEffect(() => {
    if (!active || !(camera instanceof PerspectiveCamera)) return;
    savedRef.current = {
      position: camera.position.clone(),
      target: controls?.target.clone() ?? new Vector3(),
      fov: camera.fov,
      near: camera.near,
    };
    return () => {
      const saved = savedRef.current;
      if (!saved) return;
      camera.position.copy(saved.position);
      camera.fov = saved.fov;
      camera.near = saved.near;
      camera.updateProjectionMatrix();
      if (controls) {
        controls.target.copy(saved.target);
        controls.update();
      }
      savedRef.current = null;
      lookIndexRef.current = -1;
      invalidate();
    };
    // controls는 makeDefault로 한 번 등록되므로 활성 상태가 바뀔 때만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, camera, invalidate]);

  // 세대 위치·시야각 반영 + 드래그로 둘러보기
  useEffect(() => {
    if (!active || index < 0 || !(camera instanceof PerspectiveCamera)) return;
    const px = units.positions[index * 3]!;
    const py = units.positions[index * 3 + 1]!;
    const pz = units.positions[index * 3 + 2]!;
    const nx = units.normals[index * 2]!;
    const nz = units.normals[index * 2 + 1]!;
    // 다른 세대로 옮기면 정면부터 (시야각만 바꾸면 보던 방향 유지)
    if (lookIndexRef.current !== index) {
      lookIndexRef.current = index;
      lookRef.current = { yaw: 0, pitch: 0 };
    }

    const apply = () => {
      const { yaw, pitch } = lookRef.current;
      const [dx, dy, dz] = windowLookDirection(nx, nz, yaw, pitch);
      camera.position.set(px + nx * WINDOW_OFFSET_M, py, pz + nz * WINDOW_OFFSET_M);
      camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
      invalidate();
    };
    camera.fov = windowFov;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    apply();

    const el = gl.domElement;
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, ...lookRef.current };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      // 화면 높이만큼 끌면 시야각만큼 돈다 (끄는 방향으로 시선이 따라가는 느낌)
      const perPx = (windowFov * RAD) / Math.max(1, el.clientHeight);
      lookRef.current = clampLook(drag.yaw + (e.clientX - drag.x) * perPx, drag.pitch + (e.clientY - drag.y) * perPx);
      apply();
    };
    const up = () => {
      drag = null;
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [active, index, units, camera, gl, windowFov, invalidate]);

  return null;
}
