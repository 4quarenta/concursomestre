import type { Metadata } from 'next';
import PublicExamContent, { generatePublicExamMetadata } from '../../blog/provas/PublicExamContent';

export const revalidate = 300;

type ExamPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: ExamPageProps): Promise<Metadata> {
  return generatePublicExamMetadata(props);
}

export default function ExamPage(props: ExamPageProps) {
  return <PublicExamContent {...props} platformShell />;
}
