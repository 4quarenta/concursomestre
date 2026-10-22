import type { Metadata } from 'next';
import ExamDirectoryContent, { generateExamDirectoryMetadata } from './ExamDirectoryContent';

export const revalidate = 300;

type ExamsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: ExamsPageProps): Promise<Metadata> {
  return generateExamDirectoryMetadata(props);
}

export default function BlogExamDirectoryPage(props: ExamsPageProps) {
  return <ExamDirectoryContent {...props} />;
}
