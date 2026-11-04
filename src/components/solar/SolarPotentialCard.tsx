// [요구사항: 컴포넌트] 옥상 태양광 잠재량 (PLAN.md 9.10, C10)
// 선택한 건물 지붕 중심에서 시각마다 태양 쪽 광선이 더 높은 이웃 건물에 막히는지 보고 청천 일사를 적분한다.
// 연간 값은 매월 21일 12개 대표일의 하루 발전량 × 그달 일수로 합산한다(지붕 하나라 광선 수천 개 — 메인 스레드로 충분).
// [요구사항: 상태관리] useState — 패널 효율·지붕 활용률 슬라이더
// [요구사항: 이벤트 처리] onChange(range)
import { useId, useMemo, useState } from 'react';
import { DEFAULT_LOCATION } from '../../config/constants';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useTime } from '../../contexts/TimeContext';
import { prismsFromBuildings } from '../../domain/geometry/prism';
import {
  DEFAULT_SOLAR_OPTIONS,
  dayOfYear,
  roofDailyIrradiance,
  solarPotentialKwh,
} from '../../domain/solar/irradiance';
import { createRayCaster } from '../../domain/spatial/rayCast';
import { buildUniformGrid } from '../../domain/spatial/uniformGrid';
import { computeSunSteps } from '../../domain/sunlight/sunSteps';
import styles from './SolarPotentialCard.module.css';

const STEP_MIN = 10;

export function SolarPotentialCard() {
  const { buildings, selectedBuildingId, scene } = useSceneData();
  const { date } = useTime();
  const [efficiency, setEfficiency] = useState(DEFAULT_SOLAR_OPTIONS.efficiency);
  const [usableRatio, setUsableRatio] = useState(DEFAULT_SOLAR_OPTIONS.usableRatio);
  const effId = useId();
  const useId2 = useId();
  const place = scene?.place ?? DEFAULT_LOCATION;

  // [요구사항: Hooks] useMemo — 광선 캐스터는 건물이 바뀔 때만
  const caster = useMemo(() => createRayCaster(buildUniformGrid(prismsFromBuildings(buildings))), [buildings]);
  const building = useMemo(() => buildings.find((b) => b.id === selectedBuildingId), [buildings, selectedBuildingId]);

  // 지붕 하루 일사량 [kWh/m²]: 선택 날짜 + 매월 21일
  const roof = useMemo(() => {
    if (!building) return null;
    const n = building.ring.length / 2;
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < n; i++) {
      cx += building.ring[i * 2]!;
      cz += building.ring[i * 2 + 1]!;
    }
    cx /= n;
    cz /= n;
    const y = building.heightM + 0.05;
    const daily = (d: string) => {
      const s = computeSunSteps(place.lat, place.lng, d, STEP_MIN);
      return roofDailyIrradiance(
        s.directions,
        s.count,
        STEP_MIN,
        dayOfYear(d),
        (k) => !caster.isBlocked(cx, y, cz, s.directions[k * 3]!, s.directions[k * 3 + 1]!, s.directions[k * 3 + 2]!),
      );
    };
    const year = Number(date.slice(0, 4));
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const d = `${year}-${String(m + 1).padStart(2, '0')}-21`;
      const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
      return { kwhPerM2: daily(d), days };
    });
    return { today: daily(date), monthly };
  }, [building, caster, date, place.lat, place.lng]);

  if (!building || !roof) return null;
  const options = { ...DEFAULT_SOLAR_OPTIONS, efficiency, usableRatio };
  const todayKwh = solarPotentialKwh(roof.today, building.areaM2, options);
  const annualKwh = roof.monthly.reduce(
    (sum, m) => sum + solarPotentialKwh(m.kwhPerM2, building.areaM2, options) * m.days,
    0,
  );

  return (
    <section className={styles.root} aria-label="옥상 태양광 잠재량" data-roof-today={roof.today.toFixed(2)}>
      <p className={styles.title}>옥상 태양광 (맑은 날 추정)</p>
      <dl className={styles.stats}>
        <div>
          <dt>지붕 일사량 ({date.slice(5).replace('-', '/')})</dt>
          <dd>{roof.today.toFixed(2)} kWh/m²</dd>
        </div>
        <div>
          <dt>하루 발전량</dt>
          <dd>{Math.round(todayKwh).toLocaleString()} kWh</dd>
        </div>
        <div>
          <dt>연간 발전량</dt>
          <dd>{Math.round(annualKwh / 1000).toLocaleString()} MWh</dd>
        </div>
      </dl>
      <div className={styles.sliders}>
        <label htmlFor={effId}>패널 효율 {Math.round(efficiency * 100)}%</label>
        <input
          id={effId}
          type="range"
          min={0.15}
          max={0.25}
          step={0.01}
          value={efficiency}
          onChange={(e) => setEfficiency(Number(e.target.value))}
        />
        <label htmlFor={useId2}>지붕 활용률 {Math.round(usableRatio * 100)}%</label>
        <input
          id={useId2}
          type="range"
          min={0.3}
          max={0.9}
          step={0.05}
          value={usableRatio}
          onChange={(e) => setUsableRatio(Number(e.target.value))}
        />
      </div>
      <p className={styles.warning}>
        구름·미세먼지가 없는 맑은 날 기준 상한값입니다. 실제 연간 발전량은 보통 이보다 크게 낮습니다. 지붕 면적{' '}
        {Math.round(building.areaM2).toLocaleString()}m², 성능비 {DEFAULT_SOLAR_OPTIONS.performanceRatio * 100}%.
      </p>
    </section>
  );
}
