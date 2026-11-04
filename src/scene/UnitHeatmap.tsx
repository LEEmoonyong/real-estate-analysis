// [요구사항: 컴포넌트] 세대 일조 히트맵 — 창문 패치 수만 개를 InstancedMesh 하나로 그린다 (draw call 1회)
// [요구사항: Hooks] useMemo(패치 행렬), useLayoutEffect(행렬·색 갱신), useRef(InstancedMesh)
//
// 색은 기준 총량 구간(08~16시) 일조 시간. 날짜를 바꿔 재계산하는 동안에는 직전 결과를 유지해 깜빡이지 않게 한다.
// 클릭 판정은 패치가 아니라 건물 메시에서 한다(Buildings.tsx) — 수만 개 인스턴스 광선 검사를 피하기 위해.
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedBufferAttribute, type InstancedMesh } from 'three';
import { useSceneData } from '../contexts/SceneDataContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSimulation } from '../contexts/SimulationContext';
import { sunlightColor } from '../domain/heatmap/colorScale';
import { patchMatrices } from '../domain/heatmap/patches';
import type { SunlightOutcome } from '../workers/sceneTransfer';

/** sRGB(0~1) → 선형 (three.js 색 계산은 선형 공간) */
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** 패치를 광선 검사에서 빼기 위한 빈 raycast */
const noRaycast = () => undefined;

export function UnitHeatmap() {
  const { units, sceneHash } = useSceneData();
  const { results } = useSimulation();
  const { heatmapVisible } = useSettings();
  const invalidate = useThree((s) => s.invalidate);
  const meshRef = useRef<InstancedMesh>(null);

  // 재계산 중에도 같은 장면의 직전 결과를 보여 준다
  const lastRef = useRef<SunlightOutcome | null>(null);
  const current = results.sunlight as SunlightOutcome | undefined;
  if (current && current.sceneHash === sceneHash) lastRef.current = current;
  const outcome = lastRef.current?.sceneHash === sceneHash ? lastRef.current : null;

  const matrices = useMemo(() => patchMatrices(units), [units]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !outcome || outcome.unitCount !== units.count) return;
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;

    const colors = new Float32Array(units.count * 3);
    const values = outcome.windowTotalMinutes;
    for (let i = 0; i < units.count; i++) {
      const [r, g, b] = sunlightColor(values[i]!);
      colors[i * 3] = toLinear(r);
      colors[i * 3 + 1] = toLinear(g);
      colors[i * 3 + 2] = toLinear(b);
    }
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.computeBoundingSphere();
    invalidate();
  }, [matrices, outcome, units.count, invalidate]);

  if (!outcome || units.count === 0 || outcome.unitCount !== units.count) return null;

  return (
    <instancedMesh
      // 세대 수가 바뀌면 인스턴스 버퍼 크기가 달라 새로 만든다
      key={`${sceneHash}:${units.count}`}
      ref={meshRef}
      args={[undefined, undefined, units.count]}
      raycast={noRaycast}
      visible={heatmapVisible}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      {/* 조명·그림자와 무관하게 범례와 같은 색으로 보이도록 */}
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
