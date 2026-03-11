import { NextRequest, NextResponse } from 'next/server';

import { fetchVixData } from '@/lib/fetchVix';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const spikeThreshold = Number(searchParams.get('spike_threshold') ?? 30);
  const recoveryThreshold = Number(searchParams.get('recovery_threshold') ?? 20);

  try {
    const data = await fetchVixData(spikeThreshold, recoveryThreshold);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー';
    return NextResponse.json(
      { error: `データ取得に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
