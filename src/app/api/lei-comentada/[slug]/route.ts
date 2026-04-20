import { NextResponse } from 'next/server';
import { legalCommentaryService } from '@/services/legal-commentary';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> | { slug: string } },
) {
  const params = await context.params;
  const detail = legalCommentaryService.getLawDetail(params.slug);

  if (!detail) {
    return NextResponse.json({ message: 'Lei não encontrada.' }, { status: 404 });
  }

  return NextResponse.json(detail, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
