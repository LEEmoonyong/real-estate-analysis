// [요구사항: 컴포넌트] 지면 그림자 누적 맵 (PLAN.md 9.11, C8) — 셀 값을 DataTexture로 지면 위에 덮는다
// [요구사항: 이벤트 처리] onPointerMove(셀 툴팁), onPointerOut, onClick(빈 땅 클릭 = 선택 해제)
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSimulation } from '../contexts/SimulationContext';
import { cellIndexAt } from '../domain/ground/groundShadow';
import { groundTextureData } from '../domain/heatmap/groundColor';
import type { GroundOutcome } from '../workers/sceneTransfer';

const duration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
};

export function GroundShadowLayer() {
  const { layer } = useSettings();
  const { sceneHash } = useSceneData();
  const { clearSelection } = useSceneDataActions();
  const { results } = useSimulation();
  const outcome = results.ground as GroundOutcome | undefined;
  const visible = layer === 'groundShadow' && outcome !== undefined && outcome.sceneHash === sceneHash;
  const [hover, setHover] = useState<{ index: number; point: [number, number, number] } | null>(null);

  // [요구사항: Hooks] useMemo — 결과가 바뀔 때만 텍스처를 새로 만든다
  const texture = useMemo(() => {
    if (!outcome) return null;
    const { cols, rows } = outcome.spec;
    const tex = new DataTexture(
      groundTextureData(outcome.shadowMinutes, cols, rows, outcome.windowMinutes),
      cols,
      rows,
      RGBAFormat,
      UnsignedByteType,
    );
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [outcome]);
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!visible || !texture) return null;
  const { originX, originZ, cellSize, cols, rows } = outcome.spec;
  const width = cols * cellSize;
  const depth = rows * cellSize;

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const index = cellIndexAt(outcome.spec, e.point.x, e.point.z);
    if (index !== hover?.index) setHover(index < 0 ? null : { index, point: [e.point.x, 0.2, e.point.z] });
  };
  const hovered = hover ? outcome.shadowMinutes[hover.index] : undefined;

  return (
    <group name="ground-shadow">
      <mesh
        rotation-x={-Math.PI / 2}
        position={[originX + width / 2, 0.08, originZ + depth / 2]}
        onPointerMove={handleMove}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          clearSelection();
        }}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {hover && hovered !== undefined && !Number.isNaN(hovered) && (
        <Html position={hover.point} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              transform: 'translate(10px, -110%)',
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgb(31 37 45 / 0.9)',
              color: '#f2f4f7',
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            그림자 {duration(hovered)}
          </div>
        </Html>
      )}
    </group>
  );
}
