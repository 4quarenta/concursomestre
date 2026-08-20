import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import type { ProfessionalDetail, ProfessionalKind } from './professionalServerData';

export const professionalDescription = (item: ProfessionalDetail): string => item.description || (item.kind === 'career'
  ? `Consulte informações públicas sobre ${item.name} e, quando disponíveis, cargos, concursos, provas e questões relacionados por vínculos canônicos.`
  : `Consulte informações públicas sobre ${item.name} e, quando disponíveis, concursos, provas e questões relacionados explicitamente a este cargo.`);

export const buildProfessionalMetadata = (kind: ProfessionalKind, item: ProfessionalDetail | null): Metadata => {
  if (!item) return buildNoIndexMetadata({ title: kind === 'career' ? 'Carreira não encontrada' : 'Cargo não encontrado' });
  const title = kind === 'career' ? `Concursos da ${item.name}` : `Questões e concursos para ${item.name}`;
  return buildPublicPageMetadata({ title, description: professionalDescription(item), path: item.canonicalPath });
};
