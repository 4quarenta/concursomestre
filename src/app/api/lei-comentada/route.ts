import { NextRequest, NextResponse } from 'next/server';
import { legalCommentaryService } from '@/services/legal-commentary';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const updatedOnly = searchParams.get('updated') === '1';
  const userId = searchParams.get('userId') || undefined;

  if (query.trim()) {
    return NextResponse.json({
      query,
      results: legalCommentaryService.search(query, userId),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const snapshot = legalCommentaryService.getHomeSnapshot(userId);

  return NextResponse.json({
    ...snapshot,
    lawsByArea: updatedOnly
      ? snapshot.lawsByArea.map((group) => ({
        ...group,
        laws: group.laws.filter((law) => law.isRecentlyUpdated),
      })).filter((group) => group.laws.length > 0)
      : snapshot.lawsByArea,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
