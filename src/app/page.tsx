'use client';

import { useCallback, useEffect, useState } from 'react';

import VixChart from './components/VixChart';

type HistoryEntry = {
  date: string;
  close: number;
};

type Episode = {
  start: string;
  end: string;
  trading_days: number;
};

type Convergence = {
  episodes: Episode[];
  episode_count: number;
  avg_days: number | null;
  is_spiking: boolean;
  current_episode_days: number | null;
  current_episode_start: string | null;
};

type CurrentEpisode =
  | { is_active: true; start_date: string; days_elapsed: number }
  | { is_active: false };

type VixData = {
  spike_threshold: number;
  recovery_threshold: number;
  current_price: number;
  percentile: number;
  top_percentile: number;
  period_start: string;
  period_end: string;
  data_count: number;
  generated_at: string;
  history: HistoryEntry[];
  convergence: Convergence;
  current_episode: CurrentEpisode;
};

const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 80;

function validateThresholds(spike: number, recovery: number): string | null {
  if (spike < THRESHOLD_MIN || spike > THRESHOLD_MAX)
    return `急騰開始閾値は ${THRESHOLD_MIN}〜${THRESHOLD_MAX} の範囲で入力してください`;
  if (recovery < THRESHOLD_MIN || recovery > THRESHOLD_MAX)
    return `収束完了閾値は ${THRESHOLD_MIN}〜${THRESHOLD_MAX} の範囲で入力してください`;
  if (spike <= recovery) return '急騰開始閾値は収束完了閾値より大きい値にしてください';
  return null;
}

export default function Home() {
  const [data, setData] = useState<VixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spikeInput, setSpikeInput] = useState(30);
  const [recoveryInput, setRecoveryInput] = useState(20);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchData = useCallback(async (spikeThreshold = 30, recoveryThreshold = 20) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        spike_threshold: String(spikeThreshold),
        recovery_threshold: String(recoveryThreshold),
      });
      const res = await fetch(`/api/vix?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json: VixData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(30, 20);
  }, [fetchData]);

  const handleRecalculate = () => {
    const err = validateThresholds(spikeInput, recoveryInput);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    fetchData(spikeInput, recoveryInput);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-gray-500">データ取得中...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="mb-4 text-red-600">{error ?? '不明なエラーが発生しました'}</p>
        <button
          onClick={() => fetchData(spikeInput, recoveryInput)}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
        >
          再試行
        </button>
      </main>
    );
  }

  const { convergence, current_episode } = data;
  const generatedAt = new Date(data.generated_at).toLocaleString('ja-JP', {
    timeZone: 'UTC',
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-lg border p-4 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h1 className="min-w-0 text-lg font-bold sm:text-2xl">VIX 恐怖指数チェッカー</h1>
          <button
            onClick={() => fetchData(spikeInput, recoveryInput)}
            className="flex-shrink-0 whitespace-nowrap rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            更新
          </button>
        </div>

        {/* 現在値 */}
        <div className="mb-4">
          <p className="text-sm text-gray-500">現在値</p>
          <p className="text-5xl font-bold">{data.current_price.toFixed(2)}</p>
        </div>

        {/* パーセンタイル */}
        <div className="mb-6">
          <p className="text-base">
            現在のVIXは過去5年間の
            <span className="font-semibold">上位 {data.top_percentile}%</span> の水準です
          </p>
          <p className="text-sm text-gray-500">
            （過去5年間の {data.data_count} 営業日中、下位 {data.percentile}% に相当）
          </p>
        </div>

        {/* 閾値設定 */}
        <div className="mb-6 rounded-md border p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">閾値設定</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">急騰開始閾値</span>
              <input
                type="number"
                min={THRESHOLD_MIN}
                max={THRESHOLD_MAX}
                value={spikeInput}
                onChange={(e) => setSpikeInput(Number(e.target.value))}
                className="w-24 rounded border px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">収束完了閾値</span>
              <input
                type="number"
                min={THRESHOLD_MIN}
                max={THRESHOLD_MAX}
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(Number(e.target.value))}
                className="w-24 rounded border px-2 py-1 text-sm"
              />
            </label>
            <button
              onClick={handleRecalculate}
              disabled={loading}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              この閾値で再計算
            </button>
          </div>
          {validationError && (
            <p className="mt-2 text-xs text-red-600">{validationError}</p>
          )}
        </div>

        {/* 急騰・収束分析 */}
        <div className="mb-6 rounded-md border p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">急騰後の平均収束期間</p>

          {convergence.avg_days !== null ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold">平均 {convergence.avg_days} 営業日</p>
              <p className="text-sm text-gray-500">
                過去5年間の {convergence.episode_count} エピソードを元に算出
                （VIX &gt; {data.spike_threshold} で急騰開始 → VIX &lt; {data.recovery_threshold} で収束完了）
              </p>
              {/* 現在進行中エピソード */}
              {current_episode.is_active && (
                <div className="mt-2 rounded bg-gray-50 px-3 py-2">
                  <span
                    className={`text-lg font-bold ${
                      current_episode.days_elapsed > convergence.avg_days
                        ? 'text-red-600'
                        : 'text-gray-800'
                    }`}
                  >
                    現在 {current_episode.days_elapsed} 日目
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    / 平均 {convergence.avg_days} 日
                    {current_episode.days_elapsed > convergence.avg_days && (
                      <span className="ml-1 text-red-500">（平均超過）</span>
                    )}
                  </span>
                  <p className="mt-0.5 text-xs text-gray-400">
                    急騰開始: {current_episode.start_date}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              過去5年間に該当エピソードがありませんでした
            </p>
          )}

          {/* エピソード一覧 */}
          {convergence.episodes.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                エピソード詳細を表示
              </summary>
              <div className="overflow-x-auto">
              <table className="mt-2 w-full text-xs text-gray-500">
                <thead>
                  <tr className="border-b">
                    <th className="pb-1 text-left">急騰開始</th>
                    <th className="pb-1 text-left">収束完了</th>
                    <th className="pb-1 text-right">日数</th>
                  </tr>
                </thead>
                <tbody>
                  {convergence.episodes.map((ep) => (
                    <tr key={ep.start} className="border-b border-gray-100">
                      <td className="py-1">{ep.start}</td>
                      <td className="py-1">{ep.end}</td>
                      <td className="py-1 text-right">{ep.trading_days} 日</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </details>
          )}
        </div>

        {/* チャート */}
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-gray-700">
            過去5年間の日次終値
            <span className="ml-2 text-xs font-normal text-gray-400">
              赤背景: VIX &gt; {data.spike_threshold}
            </span>
          </p>
          <VixChart history={data.history} spikeThreshold={data.spike_threshold} />
        </div>

        <hr className="mb-4" />

        <div className="space-y-1 text-sm text-gray-500">
          <p>参照期間: {data.period_start} 〜 {data.period_end}</p>
          <p>データ更新: {generatedAt} (UTC)</p>
        </div>
      </div>
    </main>
  );
}
