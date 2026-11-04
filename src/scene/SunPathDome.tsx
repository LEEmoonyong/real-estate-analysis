// [요구사항: 컴포넌트] 3D 태양 경로 (PLAN.md 9.8, 단계 B3)
// 장면 위 반구(반지름 R = 0.85 × 장면 반경)에 하루 태양 궤적을 그린다.
// 선택한 날짜 / 동지 / 하지 / 춘분 궤적을 겹쳐 볼 수 있고, 현재 태양 위치는 밝은 구로 표시한다.
// 직사광(SunLight)과 같은 방향 벡터를 쓰므로 마커 → 원점 방향과 그림자 방향이 항상 일치한다.
import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { DEFAULT_LOCATION } from '../config/constants';
import { useSceneData } from '../contexts/SceneDataContext';
import { useSettings, type SunPathDay } from '../contexts/SettingsContext';
import { useTime } from '../contexts/TimeContext';
import { sunPath } from '../domain/solar/sunPath';
import { SEASON_PRESETS, seasonDate } from '../domain/time/seasons';
import type { Vec3 } from '../domain/types';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useSunPosition } from '../hooks/useSunPosition';
import { findUnitIndex } from '../domain/units/generateUnits';
import { SUN_PATH_STYLE } from './sunPathStyle';

const noRaycast = () => undefined;
const scale = (r: number, [x, y, z]: Vec3): Vec3 => [x * r, y * r, z * r];

export function SunPathDome() {
  const { scene, radiusM, cameraMode, selectedUnitId, units, buildings } = useSceneData();
  const { sunPaths } = useSettings();
  const { date, minuteOfDay } = useTime();
  const breakpoint = useBreakpoint();
  const place = scene?.place ?? DEFAULT_LOCATION;
  const sun = useSunPosition(place.lat, place.lng, date, minuteOfDay);
  // 창문 시점: 반구 중심을 창문에 두고 모든 건물보다 멀리(태양은 무한히 멀다) — 시차 없이 방향이 맞고 건물에 가려진다
  const windowIndex = useMemo(
    () => (cameraMode === 'window' && selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [cameraMode, selectedUnitId, units, buildings],
  );
  const inWindow = windowIndex >= 0;
  const center: Vec3 = inWindow
    ? [units.positions[windowIndex * 3]!, units.positions[windowIndex * 3 + 1]!, units.positions[windowIndex * 3 + 2]!]
    : [0, 0, 0];
  const R = Math.max(radiusM, 100) * (inWindow ? 8 : 0.85);

  // [요구사항: Hooks] useMemo — 궤적은 날짜·위치가 바뀔 때만 다시 계산 (시각 슬라이더와 무관)
  const paths = useMemo(() => {
    const year = Number(date.slice(0, 4));
    const dateOf: Record<SunPathDay, string> = {
      today: date,
      winter: seasonDate(
        year,
        SEASON_PRESETS.find((p) => p.id === 'winter')!,
      ),
      summer: seasonDate(
        year,
        SEASON_PRESETS.find((p) => p.id === 'summer')!,
      ),
      spring: seasonDate(
        year,
        SEASON_PRESETS.find((p) => p.id === 'spring')!,
      ),
    };
    return (Object.keys(dateOf) as SunPathDay[])
      .filter((day) => sunPaths[day])
      .map((day) => ({ day, path: sunPath(place.lat, place.lng, dateOf[day]) }));
  }, [date, place.lat, place.lng, sunPaths]);

  const horizon = useMemo(
    () =>
      Array.from({ length: 97 }, (_, k): Vec3 => [
        Math.cos((k / 96) * 2 * Math.PI) * R,
        0.2,
        Math.sin((k / 96) * 2 * Math.PI) * R,
      ]),
    [R],
  );

  if (!scene || paths.length === 0) return null;
  const showLabels = breakpoint === 'desktop';

  return (
    <group name="sun-path" position={center}>
      {!inWindow && (
        <Line points={horizon} color="#9aa4b1" lineWidth={1} transparent opacity={0.5} raycast={noRaycast} />
      )}
      {paths.map(({ day, path }) =>
        path.points.length < 2 ? null : (
          <group key={day}>
            <Line
              points={path.points.map((p) => scale(R, p))}
              color={SUN_PATH_STYLE[day].color}
              lineWidth={day === 'today' ? 3 : 2}
              raycast={noRaycast}
            />
            {/* 정시 점 */}
            {path.hourMarks.map((m) => (
              <mesh key={m.minute} position={scale(R, m.direction)} raycast={noRaycast}>
                <sphereGeometry args={[R * 0.006, 8, 6]} />
                <meshBasicMaterial color={SUN_PATH_STYLE[day].color} toneMapped={false} />
              </mesh>
            ))}
            {/* 일출·일몰 지평선 교차 */}
            {[path.sunrise, path.sunset].map((m, k) =>
              m ? (
                <mesh key={k} position={scale(R, m.direction)} raycast={noRaycast}>
                  <cylinderGeometry args={[R * 0.012, R * 0.012, 0.6, 16]} />
                  <meshBasicMaterial color={SUN_PATH_STYLE[day].color} toneMapped={false} />
                </mesh>
              ) : null,
            )}
            {showLabels &&
              day === 'today' &&
              path.hourMarks.map((m) => (
                <Html key={`l${m.minute}`} position={scale(R * 1.04, m.direction)} center zIndexRange={[5, 0]}>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#5b6573',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {m.minute / 60}시
                  </span>
                </Html>
              ))}
          </group>
        ),
      )}
      {/* 현재 태양 — 해가 떠 있을 때만 */}
      {sun.isUp && (
        <mesh position={scale(R, sun.direction)} raycast={noRaycast} name="sun-marker">
          <sphereGeometry args={[R * 0.03, 24, 16]} />
          <meshBasicMaterial color="#ffd34d" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
