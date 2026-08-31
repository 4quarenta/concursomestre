import { NextRequest, NextResponse } from 'next/server';
import type { LegalUserComment } from '@types';

export const dynamic = 'force-dynamic';

const volatileComments: LegalUserComment[] = [];

export async function GET(
  _request: Request,
  context: { params: Promise<{ articleId: string }> | { articleId: string } },
) {
  const params = await context.params;
  return NextResponse.json({
    comments: volatileComments
      .filter((comment) => comment.articleId === params.articleId && comment.status !== 'deleted')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ articleId: string }> | { articleId: string } },
) {
  const params = await context.params;
  const payload = await request.json().catch(() => ({}));
  const body = String(payload.body || '').trim();

  if (!payload.userId || !body) {
    return NextResponse.json({ message: 'Usuário e comentário são obrigatórios.' }, { status: 400 });
  }

  const comment: LegalUserComment = {
    id: `comment-${Date.now()}`,
    articleId: params.articleId,
    userId: String(payload.userId),
    userName: String(payload.userName || 'Aluno'),
    body,
    status: 'visible',
    createdAt: new Date().toISOString(),
  };

  volatileComments.unshift(comment);

  return NextResponse.json({ comment }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
