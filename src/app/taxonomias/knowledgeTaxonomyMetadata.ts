import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import {
  evaluateSeoLaunchControl,
  getSeoLaunchMode,
  launchModeRobots,
  resolveSeoProductionFamily,
} from '@services/seo/launchControl';
import type { PublicKnowledgeTaxonomy, PublicKnowledgeTaxonomyLevel } from './knowledgeTaxonomyServerData';
import { isSeoRuntimeIndexingAllowed } from '@services/seo/runtimeEnvironment';

const levelLabel: Record<PublicKnowledgeTaxonomyLevel, string> = {
  materia: 'Disciplina',
  topico: 'Tópico',
  assunto: 'Assunto',
};

export const knowledgeTaxonomyTitle = (taxonomy: PublicKnowledgeTaxonomy): string => {
  if (taxonomy.taxonomyLevel === 'materia') return `Questões de ${taxonomy.name}`;
  if (taxonomy.taxonomyLevel === 'topico') return `Questões de ${taxonomy.name} — ${taxonomy.root?.name || 'Disciplina'}`;
  const context = [taxonomy.subtopic?.name, taxonomy.topic?.name, taxonomy.root?.name].filter(Boolean).join(' — ');
  return `Questões de ${taxonomy.name}${context ? ` — ${context}` : ''}`;
};

export const knowledgeTaxonomyDescription = (taxonomy: PublicKnowledgeTaxonomy): string => {
  if (taxonomy.description) return taxonomy.description;
  const context = taxonomy.taxonomyLevel === 'assunto'
    ? [taxonomy.subtopic?.name, taxonomy.topic?.name, taxonomy.root?.name].filter(Boolean).join(', em ')
    : taxonomy.root?.name || taxonomy.parent?.name;
  const identity = `${levelLabel[taxonomy.taxonomyLevel]} ${taxonomy.name}${context ? `, conteúdo de ${context}` : ''}`;
  return taxonomy.questionCount > 0
    ? `${identity}, com ${taxonomy.questionCount.toLocaleString('pt-BR')} questões públicas relacionadas para prática.`
    : `${identity} no diretório de estudos do ConcursoMestre.`;
};

export const buildKnowledgeTaxonomyMetadata = (taxonomy: PublicKnowledgeTaxonomy | null): Metadata => {
  if (!taxonomy) return buildNoIndexMetadata({ title: 'Taxonomia não encontrada' });
  const metadata = buildPublicPageMetadata({
    title: knowledgeTaxonomyTitle(taxonomy),
    description: knowledgeTaxonomyDescription(taxonomy),
    path: taxonomy.canonicalPath,
  });
  const launchMode = getSeoLaunchMode();
  const environmentAllowed = isSeoRuntimeIndexingAllowed(launchMode);
  const decision = evaluateSeoLaunchControl({
    launchMode,
    family: resolveSeoProductionFamily(taxonomy.canonicalPath),
    instanceReadiness: taxonomy.readiness,
    publicationAllowed: true,
    resolutionAction: 'render',
    httpStatus: 200,
    canonicalValid: true,
    qualityStatus: 'PASS',
    canonicalEnvironment: environmentAllowed,
    productionActivationAllowed: environmentAllowed,
  });
  return decision.indexability === 'INDEX' ? metadata : { ...metadata, robots: launchModeRobots(true) };
};
