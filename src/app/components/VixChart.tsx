'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type HistoryEntry = {
  date: string;
  close: number;
};

type Props = {
  history: HistoryEntry[];
  spikeThreshold: number;
};

// spikeThreshold を超えた連続区間を抽出
function getHighZones(
  history: HistoryEntry[],
  spikeThreshold: number,
): { x1: string; x2: string }[] {
  const zones: { x1: string; x2: string }[] = [];
  let start: string | null = null;

  for (let i = 0; i < history.length; i++) {
    const { date, close } = history[i];
    if (close > spikeThreshold && start === null) {
      start = date;
    } else if (close <= spikeThreshold && start !== null) {
      zones.push({ x1: start, x2: history[i - 1].date });
      start = null;
    }
  }
  if (start !== null) {
    zones.push({ x1: start, x2: history[history.length - 1].date });
  }
  return zones;
}

// X軸ティックを年単位で間引く
function getYearTicks(history: HistoryEntry[]): string[] {
  const seen = new Set<string>();
  return history
    .filter(({ date }) => {
      const year = date.slice(0, 4);
      if (seen.has(year)) return false;
      seen.add(year);
      return true;
    })
    .map(({ date }) => date);
}

export default function VixChart({ history, spikeThreshold }: Props) {
  const zones = getHighZones(history, spikeThreshold);
  const ticks = getYearTicks(history);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={history} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={(v: string) => v.slice(0, 4)}
          tick={{ fontSize: 12 }}
        />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} width={36} />
        <Tooltip
          formatter={(value) => [Number(value).toFixed(2), 'VIX']}
        />
        {/* VIX > 30 の区間を赤背景でハイライト */}
        {zones.map(({ x1, x2 }) => (
          <ReferenceArea
            key={`${x1}-${x2}`}
            x1={x1}
            x2={x2}
            fill="#ef4444"
            fillOpacity={0.15}
          />
        ))}
        {/* 急騰開始閾値の基準線 */}
        <ReferenceLine
          y={spikeThreshold}
          stroke="#ef4444"
          strokeDasharray="4 2"
          label={{ value: String(spikeThreshold), fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
        />
        <Line
          type="monotone"
          dataKey="close"
          dot={false}
          strokeWidth={1.5}
          stroke="#3b82f6"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
