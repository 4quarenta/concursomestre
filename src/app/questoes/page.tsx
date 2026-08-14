import type { Metadata } from 'next';
import PracticePage from '../practice/PracticePage';
import { buildPublicPageMetadata } from '../seoMetadata';
import { classifyPublicRouteParameter } from '@services/routes/publicRoutes';

type QuestionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

const TITLE = 'Questões de concursos para praticar';
const DESCRIPTION = 'Resolva questões de concursos por matéria, banca, órgão, cargo, ano e dificuldade, com estatísticas e comentários no ConcursoMestre.';

export async function generateMetadata({ searchParams }: QuestionsPageProps): Promise<Metadata> {
  const query = searchParams ? await searchParams : {};
  const hasNonCanonicalState = Object.keys(query).some((parameter) => {
    const classification = classifyPublicRouteParameter(parameter);
    return classification !== 'tracking' && classification !== 'internal';
  });
  const metadata = buildPublicPageMetadata({ title: TITLE, description: DESCRIPTION, path: '/questoes' });

  return hasNonCanonicalState
    ? {
        ...metadata,
        robots: {
          index: false,
          follow: true,
          googleBot: { index: false, follow: true },
        },
      }
    : metadata;
}

export default function QuestionsPage(props: QuestionsPageProps) {
  return <PracticePage {...props} />;
}
