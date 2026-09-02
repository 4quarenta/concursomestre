import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { isQuestionsIndexPath, matchesPublicRouteFamily, publicRoutes } from '@services/routes/publicRoutes';
import { validateInstanceReadiness, type SeoInstanceReadiness } from '@services/seo/launchControl';

export type PublicKnowledgeTaxonomyLevel = 'materia' | 'topico' | 'assunto';

export type PublicKnowledgeIdentity = {
  id: number;
  slug: string;
  name: string;
  taxonomyLevel: PublicKnowledgeTaxonomyLevel | 'subtopico';
  path?: string;
};

export type PublicKnowledgeRelation = PublicKnowledgeIdentity & {
  questionCount: number;
  questionsPath?: string;
  subtopicId?: number;
  subtopicName?: string | null;
};

export type PublicKnowledgeTaxonomy = {
  id: number;
  slug: string;
  requestedSlug: string;
  name: string;
  description: string | null;
  taxonomyLevel: PublicKnowledgeTaxonomyLevel;
  canonicalPath: string;
  questionsPath: string;
  readiness: SeoInstanceReadiness;
  parent: PublicKnowledgeIdentity | null;
  root: PublicKnowledgeIdentity | null;
  topic: PublicKnowledgeIdentity | null;
  subtopic: PublicKnowledgeIdentity | null;
  questionCount: number;
  topics: PublicKnowledgeRelation[];
  subtopics: PublicKnowledgeIdentity[];
  subjects: PublicKnowledgeRelation[];
  exams: Array<{ id: number; slug: string; name: string; year: number; questionCount: number; path: string }>;
  boards: Array<{ id: number; slug: string; name: string; acronym: string | null; questionCount: number; path: string }>;
  organizations: Array<{ id: number; slug: string; name: string; acronym: string | null; questionCount: number; path: string }>;
  questions: Array<{ id: number; excerpt: string; updatedAt: string | null; path: string }>;
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  updatedAt: string | null;
};

type FetchOptions = { fetchImpl?: typeof fetch; apiBaseUrl?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown): string | null => text(value) || null;
const integer = (value: unknown): number => Math.max(0, Math.trunc(Number(value) || 0));
const path = (value: unknown): string => {
  const candidate = text(value);
  return /^\/[^?#]*?(?:\?[^#]*)?$/.test(candidate) ? candidate : '';
};
const list = <T>(value: unknown, mapper: (item: Record<string, unknown>) => T | null): T[] => (
  Array.isArray(value) ? value.filter(isRecord).map(mapper).filter((item): item is T => item !== null) : []
);

const detailPath = (level: PublicKnowledgeTaxonomyLevel, slug: string): string => ({
  materia: publicRoutes.disciplines.detail,
  topico: publicRoutes.topics.detail,
  assunto: publicRoutes.subjects.detail,
}[level])(slug);

const parseIdentity = (value: unknown, allowSubtopic = false): PublicKnowledgeIdentity | null => {
  if (!isRecord(value)) return null;
  const taxonomyLevel = text(value.taxonomyLevel) as PublicKnowledgeIdentity['taxonomyLevel'];
  if (!['materia', 'topico', 'assunto', ...(allowSubtopic ? ['subtopico'] : [])].includes(taxonomyLevel)) return null;
  const identity = { id: integer(value.id), slug: text(value.slug), name: text(value.name), taxonomyLevel, path: path(value.path) };
  if (identity.id <= 0 || !identity.slug || !identity.name) return null;
  if (taxonomyLevel !== 'subtopico' && identity.path !== detailPath(taxonomyLevel, identity.slug)) return null;
  if (taxonomyLevel === 'subtopico') {
    const { path: _path, ...subtopicIdentity } = identity;
    return subtopicIdentity;
  }
  return identity;
};

const parseRelation = (value: Record<string, unknown>, level: 'materia' | 'topico' | 'assunto'): PublicKnowledgeRelation | null => {
  const identity = parseIdentity({ ...value, taxonomyLevel: level, path: value.path });
  if (!identity) return null;
  const questionsPath = path(value.questionsPath);
  if (questionsPath && (!isQuestionsIndexPath(questionsPath) || !questionsPath.startsWith('/questoes?'))) return null;
  return {
    ...identity,
    questionCount: integer(value.questionCount),
    questionsPath: questionsPath || undefined,
    subtopicId: integer(value.subtopicId),
    subtopicName: nullableText(value.subtopicName),
  };
};

export const parsePublicKnowledgeTaxonomy = (
  value: unknown,
  expectedLevel: PublicKnowledgeTaxonomyLevel,
): PublicKnowledgeTaxonomy | null => {
  if (!isRecord(value) || text(value.taxonomyLevel) !== expectedLevel) return null;
  const id = integer(value.id);
  const slug = text(value.slug);
  const requestedSlug = text(value.requestedSlug) || slug;
  const name = text(value.name);
  const canonicalPath = path(value.canonicalPath);
  const questionsPath = path(value.questionsPath);
  if (id <= 0 || !slug || !requestedSlug || !name || canonicalPath !== detailPath(expectedLevel, slug)) return null;
  if (!isQuestionsIndexPath(questionsPath) || !questionsPath.startsWith('/questoes?')) return null;

  const readiness = isRecord(value.readiness) ? {
    status: text(value.readiness.status) as SeoInstanceReadiness['status'],
    reasonCodes: Array.isArray(value.readiness.reasonCodes) ? value.readiness.reasonCodes.filter((item): item is string => typeof item === 'string') : [],
  } : { status: 'NOT_READY' as const, reasonCodes: ['instance_readiness.not_evaluated'] };
  if (validateInstanceReadiness(readiness).length > 0) return null;

  const breadcrumbs = list(value.breadcrumbs, (item) => {
    const crumb = { label: text(item.label), canonicalPath: path(item.canonicalPath) };
    if (!crumb.label || !crumb.canonicalPath) return null;
    return crumb;
  });
  if (breadcrumbs.length < 3 || breadcrumbs.at(-1)?.canonicalPath !== canonicalPath) return null;

  return {
    id, slug, requestedSlug, name,
    description: nullableText(value.description),
    taxonomyLevel: expectedLevel,
    canonicalPath, questionsPath, readiness,
    parent: parseIdentity(value.parent, true),
    root: parseIdentity(value.root),
    topic: parseIdentity(value.topic),
    subtopic: parseIdentity(value.subtopic, true),
    questionCount: integer(value.questionCount),
    topics: list(value.topics, (item) => parseRelation(item, 'topico')),
    subtopics: list(value.subtopics, (item) => parseIdentity({ ...item, taxonomyLevel: 'subtopico' }, true)),
    subjects: list(value.subjects, (item) => parseRelation(item, 'assunto')),
    exams: list(value.exams, (item) => {
      const exam = { id: integer(item.id), slug: text(item.slug), name: text(item.name), year: integer(item.year), questionCount: integer(item.questionCount), path: path(item.path) };
      return exam.id > 0 && exam.slug && exam.name && exam.path === publicRoutes.exams.detail(exam.slug) ? exam : null;
    }),
    boards: list(value.boards, (item) => {
      const board = { id: integer(item.id), slug: text(item.slug), name: text(item.name), acronym: nullableText(item.acronym), questionCount: integer(item.questionCount), path: path(item.path) };
      return board.id > 0 && board.slug && board.name && board.path === publicRoutes.boards.detail(board.slug) ? board : null;
    }),
    organizations: list(value.organizations, (item) => {
      const organization = { id: integer(item.id), slug: text(item.slug), name: text(item.name), acronym: nullableText(item.acronym), questionCount: integer(item.questionCount), path: path(item.path) };
      return organization.id > 0 && organization.slug && organization.name && organization.path === publicRoutes.organizations.detail(organization.slug) ? organization : null;
    }),
    questions: list(value.questions, (item) => {
      const question = { id: integer(item.id), excerpt: text(item.excerpt), updatedAt: nullableText(item.updatedAt), path: path(item.path) };
      return question.id > 0 && question.path.startsWith(`/questoes/${question.id}/`)
        && matchesPublicRouteFamily('question_detail', question.path, { includeLegacy: false }) ? question : null;
    }),
    breadcrumbs,
    updatedAt: nullableText(value.updatedAt),
  };
};

const unwrap = (value: unknown): unknown => isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value;

export const fetchPublicKnowledgeTaxonomyForServerTest = async (
  level: PublicKnowledgeTaxonomyLevel,
  slug: string,
  { fetchImpl = fetch, apiBaseUrl }: FetchOptions = {},
): Promise<PublicKnowledgeTaxonomy | null> => {
  const baseUrl = resolveAbsoluteApiBaseUrl(apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
  const url = new URL('filters/knowledge-taxonomy.php', baseUrl);
  url.searchParams.set('level', level);
  url.searchParams.set('slug', String(slug || '').trim());
  const response = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_knowledge_taxonomy_fetch_failed:${response.status}`);
  const taxonomy = parsePublicKnowledgeTaxonomy(unwrap(await response.json()), level);
  if (!taxonomy) throw new Error('public_knowledge_taxonomy_contract_invalid');
  return taxonomy;
};

const cached = cache((level: PublicKnowledgeTaxonomyLevel, slug: string) => fetchPublicKnowledgeTaxonomyForServerTest(level, slug));
export const fetchPublicKnowledgeTaxonomyForServer = (level: PublicKnowledgeTaxonomyLevel, slug: string) => cached(level, String(slug || '').trim());
