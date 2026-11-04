// [요구사항: 컴포넌트] 월별 요약 차트 (C11) — 선택 세대의 월별 일조·일사량과 단지(주향 세대) 평균·하위 10%
// [요구사항: 이벤트 처리] 점 onClick → 그 달 대표일로 이동
import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useSeason, useSeasonActions } from '../../contexts/SeasonContext';
import { findUnitIndex } from '../../domain/units/generateUnits';
import styles from './Season.module.css';

export function MonthlySummaryChart() {
  const { units, buildings, selectedUnitId } = useSceneData();
  const { active, months, currentMonth } = useSeason();
  const { goToMonth } = useSeasonActions();
  const index = useMemo(
    () => (selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [units, buildings, selectedUnitId],
  );

  const data = useMemo(
    () =>
      months.map((m, i) =>
        m
          ? {
              month: i + 1,
              unit: index >= 0 ? +(m.windowTotal[index]! / 60).toFixed(2) : null,
              mean: +(m.mean / 60).toFixed(2),
              p10: +(m.p10 / 60).toFixed(2),
              irr: index >= 0 ? +m.irradiance[index]!.toFixed(2) : null,
            }
          : { month: i + 1, unit: null, mean: null, p10: null, irr: null },
      ),
    [months, index],
  );

  if (!active || index < 0 || !months.some(Boolean)) return null;
  const handleClick = (state: { activeLabel?: string | number } | null) => {
    const m = Number(state?.activeLabel);
    if (m >= 1 && m <= 12) goToMonth(m - 1);
  };

  return (
    <section className={styles.chart} aria-label="월별 요약">
      <p className={styles.title}>월별 요약 (매월 21일, 08~16시)</p>
      <div role="img" aria-label="월별 일조 시간 선 그래프: 이 세대, 단지 남향 세대 평균, 하위 10%">
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={(m: number) => `${m}월`} tick={{ fontSize: 11 }} interval={1} />
            <YAxis tick={{ fontSize: 11 }} unit="h" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} />
            <Tooltip formatter={(v) => `${String(v)}시간`} labelFormatter={(m) => `${String(m)}월 21일`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              name="이 세대"
              dataKey="unit"
              stroke="#ff4d00"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line name="단지 평균" dataKey="mean" stroke="#5b6573" dot={false} isAnimationActive={false} />
            <Line
              name="하위 10%"
              dataKey="p10"
              stroke="#5b6573"
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div role="img" aria-label="이 세대의 월별 하루 일사량 선 그래프">
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={(m: number) => `${m}월`} tick={{ fontSize: 11 }} interval={1} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `${String(v)} kWh/m²`} labelFormatter={(m) => `${String(m)}월 21일`} />
            <Line
              name="일사량"
              dataKey="irr"
              stroke="#f5a524"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className={styles.muted}>
        아래: 하루 일사량(kWh/m², 맑은 날 추정). 점을 누르면 그 달로 이동합니다
        {currentMonth >= 0 ? ` · 지금 ${currentMonth + 1}월` : ''}.
      </p>
    </section>
  );
}
