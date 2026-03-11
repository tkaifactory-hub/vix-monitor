import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const TICKER = '^VIX';

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

export async function fetchVixData(
  spikeThreshold = 30,
  recoveryThreshold = 20
): Promise<VixData> {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 5);

  // 現在値の取得
  const quote = await yahooFinance.quote(TICKER);
  const currentPrice = quote.regularMarketPrice ?? 0;

  // 過去5年分の日次終値の取得
  const historical = await yahooFinance.historical(TICKER, {
    period1: start.toISOString().slice(0, 10),
    period2: end.toISOString().slice(0, 10),
    interval: '1d',
  });

  // null/undefinedを除外してクリーンな配列を作成
  const history = historical
    .filter((row) => row.close != null)
    .map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      close: Math.round(row.close * 100) / 100,
    }));

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
