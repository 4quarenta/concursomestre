import type { Metadata } from 'next';
import ExamDirectoryContent, { generateExamDirectoryMetadata } from '../blog/provas/ExamDirectoryContent';

export const revalidate = 300;

type ExamsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: ExamsPageProps): Promise<Metadata> {
  return generateExamDirectoryMetadata(props);
}

export default function ExamsPage(props: ExamsPageProps) {
  return <ExamDirectoryContent {...props} platformShell />;
}
