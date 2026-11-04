// [요구사항: 컴포넌트] 세대의 하루 일조 타임라인 (recharts 막대 그래프)
// - 칸마다 직사광이 들면 노란 막대, 그늘이면 회색, 해가 없으면 옅은 회색
// - 기준 연속 구간을 음영으로, 현재 시각을 세로선으로 표시
// [요구사항: 이벤트 처리] 막대 onClick → 그 시각으로 이동 (3D 그림자와 바로 비교)
import { useMemo } from 'react';
import { Bar, BarChart, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatMinute } from '../../domain/time/kst';

interface SunTimelineChartProps {
  /** 이 세대의 마스크 한 줄 (칸 K개) */
  row: Uint8Array;
  /** 칸별 해가 떠 있는지 */
  sunUp: readonly boolean[];
  startMinute: number;
  stepMinutes: number;
  windowStart: number;
  windowEnd: number;
  currentMinute: number;
  onPickMinute: (minute: number) => void;
}

const COLORS = { sun: '#f5a524', shade: '#7d8794', night: '#d4d9df' } as const;
type BinState = keyof typeof COLORS;

export function SunTimelineChart({
  row,
  sunUp,
  startMinute,
  stepMinutes,
  windowStart,
  windowEnd,
  currentMinute,
  onPickMinute,
}: SunTimelineChartProps) {
  // [요구사항: Hooks] useMemo — 세대·결과가 바뀔 때만 차트 데이터를 다시 만든다
  // 칸 하나 = 범주 하나(칸 시작 시각). 범주 축이라 막대가 폭을 고르게 나눠 채운다.
  const data = useMemo(
    () =>
      Array.from(row, (v, k) => ({
        start: startMinute + k * stepMinutes,
        value: 1,
        state: (v ? 'sun' : sunUp[k] ? 'shade' : 'night') as BinState,
      })),
    [row, sunUp, startMinute, stepMinutes],
  );

  // 2시간 간격 눈금, 기준 구간·현재 시각은 가장 가까운 칸으로
  const ticks = data.filter((d) => d.start % 120 === 0).map((d) => d.start);
  const inWindow = data.filter((d) => d.start >= windowStart && d.start + stepMinutes <= windowEnd);
  const current = data.find((d) => currentMinute >= d.start && currentMinute < d.start + stepMinutes);

  return (
    <div
      role="img"
      aria-label={`하루 일조 타임라인 (${formatMinute(startMinute)}~${formatMinute(startMinute + row.length * stepMinutes)}, ${stepMinutes}분 간격): 노란 막대는 직사광, 회색은 그늘, 파란 음영은 기준 연속 구간`}
    >
      <ResponsiveContainer width="100%" height={96}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap={1}>
          <XAxis
            dataKey="start"
            ticks={ticks}
            interval={0}
            tickFormatter={(m: number) => `${Math.floor(m / 60)}시`}
            tick={{ fontSize: 11 }}
            height={18}
            tickLine={false}
          />
          <YAxis hide domain={[0, 1]} />
          {inWindow.length > 0 && (
            <ReferenceArea
              x1={inWindow[0]!.start}
              x2={inWindow.at(-1)!.start}
              fill="#3b82f6"
              fillOpacity={0.15}
              ifOverflow="extendDomain"
            />
          )}
          <Bar
            dataKey="value"
            isAnimationActive={false}
            cursor="pointer"
            onClick={(entry: { payload?: { start: number } }) => {
              if (entry.payload) onPickMinute(entry.payload.start);
            }}
          >
            {data.map((d) => (
              <Cell key={d.start} fill={COLORS[d.state]} />
            ))}
          </Bar>
          {current && <ReferenceLine x={current.start} stroke="#d1343a" strokeWidth={2} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
