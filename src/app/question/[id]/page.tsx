import { notFound, redirect } from 'next/navigation';
import { loadPublicQuestionById } from '@/lib/publicQuestions';
import { buildQuestionPath } from '@/services/seo/slug';

interface QuestionRedirectPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 3600;

export default async function QuestionRedirectPage({ params }: QuestionRedirectPageProps) {
  const { id } = await params;
  const question = await loadPublicQuestionById(id);

  if (!question) {
    notFound();
  }

  redirect(buildQuestionPath(question));
}
