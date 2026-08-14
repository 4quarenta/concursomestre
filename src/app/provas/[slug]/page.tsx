import type { Metadata } from 'next';
import LegacyExamPage, { generateMetadata as generateExamMetadata } from '../../blog/provas/[slug]/page';

export const revalidate = 300;

type ExamPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: ExamPageProps): Promise<Metadata> {
  return generateExamMetadata(props);
}

export default function ExamPage(props: ExamPageProps) {
  return <LegacyExamPage {...props} />;
}
