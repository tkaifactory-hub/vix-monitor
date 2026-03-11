const API_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5y';

export interface VixEpisode {
  start: string;
  end: string;
  trading_days: number;
}

export interface VixData {
  spike_threshold: number;
  recovery_threshold: number;
  current_price: number;
  percentile: number;
  top_percentile: number;
  period_start: string;
  period_end: string;
  data_count: number;
  generated_at: string;
  history: { date: string; close: number }[];
  convergence: {
    episodes: VixEpisode[];
    episode_count: number;
    avg_days: number | null;
    is_spiking: boolean;
    current_episode_days: number | null;
    current_episode_start: string | null;
  };
  current_episode:
    | { is_active: false }
    | { is_active: true; start_date: string; days_elapsed: number };
}

function toDateString(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

export async function fetchVixData(
  spikeThreshold = 30,
  recoveryThreshold = 20
): Promise<VixData> {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance API error: ${res.status}`);

  const json = await res.json();
  const result = json.chart.result[0];
  const meta = result.meta;
  const timestamps: number[] = result.timestamp;
  const rawCloses: (number | null)[] = result.indicators.quote[0].close;

  const currentPrice: number = meta.regularMarketPrice;

  // null を除外してクリーンな履歴を作成
  const history: { date: string; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = rawCloses[i];
    if (close != null) {
      history.push({
        date: toDateString(timestamps[i]),
        close: Math.round(close * 100) / 100,
      });
    }
  }

  const closes = history.map((h) => h.close);
  const count = closes.length;

  // パーセンタイル計算（現在値より低い日数の割合）
  const below = closes.filter((v) => v < currentPrice).length;
  const percentile = Math.round((below / count) * 1000) / 10;
  const topPercentile = Math.round((100 - percentile) * 10) / 10;

  const periodStart = history[0].date;
  const periodEnd = history[history.length - 1].date;

  // 急騰・収束エピソードの抽出
  const episodes: VixEpisode[] = [];
  let inSpike = false;
  let spikeStartDate: string | null = null;
  let spikeStartIdx: number | null = null;

  for (let i = 0; i < history.length; i++) {
    const { close, date } = history[i];
    if (!inSpike && close > spikeThreshold) {
      inSpike = true;
      spikeStartDate = date;
      spikeStartIdx = i;
    } else if (inSpike && close < recoveryThreshold) {
      episodes.push({
        start: spikeStartDate!,
        end: date,
        trading_days: i - spikeStartIdx!,
      });
      inSpike = false;
      spikeStartDate = null;
      spikeStartIdx = null;
    }
  }

  const avgDays =
    episodes.length > 0
      ? Math.round((episodes.reduce((s, e) => s + e.trading_days, 0) / episodes.length) * 10) / 10
      : null;

  const currentEpisodeDays = inSpike ? history.length - spikeStartIdx! : null;
  const currentEpisodeStart = inSpike ? spikeStartDate : null;

  const currentEpisode = inSpike
    ? { is_active: true as const, start_date: spikeStartDate!, days_elapsed: currentEpisodeDays! }
    : { is_active: false as const };

  return {
    spike_threshold: spikeThreshold,
    recovery_threshold: recoveryThreshold,
    current_price: Math.round(currentPrice * 100) / 100,
    percentile,
    top_percentile: topPercentile,
    period_start: periodStart,
    period_end: periodEnd,
    data_count: count,
    generated_at: new Date().toISOString(),
    history,
    convergence: {
      episodes,
      episode_count: episodes.length,
      avg_days: avgDays,
      is_spiking: inSpike,
      current_episode_days: currentEpisodeDays,
      current_episode_start: currentEpisodeStart,
    },
    current_episode: currentEpisode,
  };
}
