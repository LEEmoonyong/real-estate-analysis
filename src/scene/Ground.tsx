// 지면 (평지 가정, y = 0) — 데이터 조회 반경을 옅은 원으로 표시
import { DoubleSide } from 'three';

interface GroundProps {
  radiusM: number;
}

export function Ground({ radiusM }: GroundProps) {
  const size = Math.max(radiusM, 100) * 1.6;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow name="ground">
        <circleGeometry args={[size, 96]} />
        <meshStandardMaterial color="#d6dcc8" roughness={1} />
      </mesh>
      {/* 데이터 조회 범위 경계 */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
        <ringGeometry args={[radiusM, radiusM + 1.5, 128]} />
        <meshBasicMaterial color="#9aa58a" side={DoubleSide} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
