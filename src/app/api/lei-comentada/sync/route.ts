import { NextRequest, NextResponse } from 'next/server';
import { lawsSeed } from '@/services/legal-commentary';
import { runPlanaltoSyncPreview } from '@/services/legal-commentary/planaltoSyncService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const selectMonitoredLaws = (limit?: number) => {
  const safeLimit = Number.isFinite(limit) && Number(limit) > 0 ? Number(limit) : 6;
  return lawsSeed.slice(0, safeLimit);
};

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') || 6);
  const result = await runPlanaltoSyncPreview(selectMonitoredLaws(limit));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const result = await runPlanaltoSyncPreview(selectMonitoredLaws(Number(payload.limit || 6)));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
