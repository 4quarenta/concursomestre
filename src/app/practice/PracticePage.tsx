import PracticeClient from './PracticeClient';
import { fetchPracticeInitialQuestions } from './practiceServerData';

type PracticePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialQuestionPage = await fetchPracticeInitialQuestions({
    searchParams: resolvedSearchParams,
  });

  return <PracticeClient initialQuestionPage={initialQuestionPage} />;
}
