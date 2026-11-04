// [요구사항: 컴포넌트] 층별 비교 그래프 (PLAN.md 단계 B2)
// 선택한 세대와 같은 세로 줄(건물·면·라인)의 1층~최상층 일조를 가로 막대로 — 위층이 위에 오도록.
// [요구사항: 상태관리] useState — 기준 종류(연속 / 총) 토글
// [요구사항: 이벤트 처리] onClick(기준 토글), 막대 onClick → 그 층 세대 선택(3D 테두리·상세 패널과 동기화)
import { useState } from 'react';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSceneDataActions } from '../../contexts/SceneDataContext';
import type { FloorMetric } from '../../domain/sunlight/floorStats';
import { useFloorStats } from './useFloorStats';
import styles from './FloorCompare.module.css';

const METRICS: { id: FloorMetric; label: string }[] = [
  { id: 'continuous', label: '연속' },
  { id: 'total', label: '총량' },
];

const COLORS = { meets: '#f5a524', fails: '#9aa4b1', selected: '#ff4d00' } as const;

const hours = (min: number) => (min % 60 === 0 ? `${min / 60}시간` : `${(min / 60).toFixed(1)}시간`);

export function FloorCompareChart() {
  const [metric, setMetric] = useState<FloorMetric>('continuous');
  const view = useFloorStats(metric);
  const { selectUnit } = useSceneDataActions();

  if (!view) return null;
  const { floors, firstMeetingFloor, requiredMin, selectedFloor, buildingId } = view;
  // 위층이 위에 오도록 역순, 층이 많으면 막대를 얇게
  const data = [...floors].reverse();
  const height = Math.min(560, Math.max(140, floors.length * 12 + 40));
  const maxValue = Math.max(requiredMin * 1.5, ...floors.map((f) => f.minutes));
  const metricText = metric === 'continuous' ? '09~15시 최대 연속' : '08~16시 총';

  return (
    <section className={styles.root} aria-label="층별 일조 비교">
      <div className={styles.header}>
        <p className={styles.title}>층별 비교</p>
        <div className={styles.toggle} role="group" aria-label="기준 종류">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={metric === m.id}
              className={styles.toggleButton}
              onClick={() => setMetric(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.summary}>
        {firstMeetingFloor === null ? (
          <>
            최상층도 {metricText} {hours(requiredMin)} 기준에 못 미칩니다.
          </>
        ) : firstMeetingFloor === 1 ? (
          <>
            모든 층이 {metricText} {hours(requiredMin)} 기준을 충족합니다.
          </>
        ) : (
          <>
            <strong>{firstMeetingFloor}층부터</strong> {metricText} {hours(requiredMin)} 기준 충족
          </>
        )}
      </p>
      <div
        role="img"
        aria-label={`같은 라인 ${floors.length}개 층의 ${metricText} 일조 시간 막대 그래프. 기준선 ${hours(requiredMin)}. 현재 선택 ${selectedFloor}층.`}
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={1}>
            <XAxis
              type="number"
              domain={[0, Math.ceil(maxValue / 60) * 60]}
              ticks={Array.from({ length: Math.ceil(maxValue / 60) + 1 }, (_, k) => k * 60)}
              tickFormatter={(m: number) => `${m / 60}h`}
              tick={{ fontSize: 11 }}
              height={18}
            />
            <YAxis
              type="category"
              dataKey="floor"
              width={34}
              tick={{ fontSize: 11 }}
              tickFormatter={(f: number) => `${f}층`}
              interval="preserveStartEnd"
            />
            <Tooltip
              cursor={{ fill: 'rgb(127 127 127 / 0.15)' }}
              formatter={(v) => [hours(Number(v)), metricText]}
              labelFormatter={(f) => `${String(f)}층`}
            />
            <ReferenceLine x={requiredMin} stroke="#d1343a" strokeDasharray="4 3" strokeWidth={1.5} />
            <Bar
              dataKey="minutes"
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry: { payload?: { unitId: string } }) => {
                if (entry.payload) selectUnit(entry.payload.unitId, buildingId);
              }}
            >
              {data.map((d) => (
                <Cell
                  key={d.floor}
                  fill={d.floor === selectedFloor ? COLORS.selected : d.meets ? COLORS.meets : COLORS.fails}
                  stroke={d.floor === firstMeetingFloor ? '#1b1f24' : undefined}
                  strokeWidth={d.floor === firstMeetingFloor ? 1.5 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className={styles.legend}>
        <span className={styles.swatch} style={{ background: COLORS.meets }} /> 충족
        <span className={styles.swatch} style={{ background: COLORS.fails }} /> 미충족
        <span className={styles.swatch} style={{ background: COLORS.selected }} /> 선택한 층 · 빨간 점선 = 기준 · 막대를
        누르면 그 층을 선택합니다
      </p>
    </section>
  );
}
