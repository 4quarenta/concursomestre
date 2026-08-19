import {
  fetchPublicKnowledgeTaxonomyForServer,
  fetchPublicKnowledgeTaxonomyForServerTest,
  parsePublicKnowledgeTaxonomy,
  type PublicKnowledgeRelation,
  type PublicKnowledgeTaxonomy,
} from '../taxonomias/knowledgeTaxonomyServerData';

export type PublicDiscipline = PublicKnowledgeTaxonomy;
export type PublicDisciplineTopic = PublicKnowledgeRelation;
export type PublicDisciplineExam = PublicKnowledgeTaxonomy['exams'][number];
export type PublicDisciplineBoard = PublicKnowledgeTaxonomy['boards'][number];
export type PublicDisciplineQuestion = PublicKnowledgeTaxonomy['questions'][number];

export const parsePublicDiscipline = (value: unknown): PublicDiscipline | null => parsePublicKnowledgeTaxonomy(value, 'materia');

export const fetchPublicDisciplineForServerTest = (
  slug: string,
  options: Parameters<typeof fetchPublicKnowledgeTaxonomyForServerTest>[2] = {},
) => fetchPublicKnowledgeTaxonomyForServerTest('materia', slug, options);

export const fetchPublicDisciplineForServer = (slug: string) => fetchPublicKnowledgeTaxonomyForServer('materia', slug);
