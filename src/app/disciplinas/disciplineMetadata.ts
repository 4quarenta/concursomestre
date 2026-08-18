import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import type { PublicDiscipline } from './disciplineServerData';

export const buildDisciplineMetadata = (discipline: PublicDiscipline | null): Metadata => {
  if (!discipline) return buildNoIndexMetadata({ title: 'Disciplina não encontrada' });

  const title = `Questões de ${discipline.name}`;
  const description = discipline.description
    || `${discipline.questionCount.toLocaleString('pt-BR')} questões públicas relacionadas a ${discipline.name}.`;
  return {
    ...buildPublicPageMetadata({ title, description, path: discipline.canonicalPath }),
    robots: {
      index: false,
      follow: true,
      noarchive: true,
      googleBot: {
        index: false,
        follow: true,
        noarchive: true,
      },
    },
  };
};
