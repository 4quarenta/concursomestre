import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { ENDPOINTS } from '@services/api/endpoints';
import { publicRoutes } from '@services/routes/publicRoutes';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const integer = (value: unknown) => Number.isInteger(Number(value)) ? Number(value) : 0;
const nullableText = (value: unknown) => text(value) || null;
const slug = (value: unknown, max = 190) => {
  const candidate = text(value);
  return candidate.length <= max && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : '';
};

export type PublicLawArticleDetail = {
  law: { id: number; slug: string; title: string; shortTitle: string | null; number: string | null; year: string | null; status: string; officialUrl: string | null; sourceName: string | null; updatedAt: string | null };
  article: { id: number; lawId: number; sectionId: number | null; slug: string; number: string; title: string | null; officialText: string; officialStatus: string; officialAnchor: string | null; updatedAt: string | null; blocks: Array<{ id: number; uid: string; kind: string; label: string | null; text: string; parentUid: string | null; anchor: string | null; sortOrder: number }> };
  section: { id: number; title: string | null; titleLabel: string | null; titleName: string | null; chapterLabel: string | null; chapterName: string | null } | null;
  navigation: { previous: LawArticleNavigation | null; next: LawArticleNavigation | null };
  canonicalPath: string;
  breadcrumbs: Array<{ label: string; path: string }>;
  readiness: { status: 'READY' | 'NOT_READY'; reasonCodes: string[] };
  editorial: { commentaryAvailable: false; protectedContentIncluded: false };
};
type LawArticleNavigation = { slug: string; number: string; title: string | null; path: string };

const parseNavigation = (value: unknown, lawSlug: string): LawArticleNavigation | null => {
  if (!record(value)) return null;
  const articleSlug = slug(value.slug, 180);
  const path = text(value.path);
  if (!articleSlug || path !== publicRoutes.laws.article(lawSlug, articleSlug)) return null;
  return { slug: articleSlug, number: text(value.number), title: nullableText(value.title), path };
};

export const parsePublicLawArticleDetail = (value: unknown): PublicLawArticleDetail | { redirectPath: string } | null => {
  if (!record(value)) return null;
  const redirectPath = text(value.redirectPath);
  if (redirectPath) return /^\/lei-comentada\/[a-z0-9-]+\/[a-z0-9-]+$/.test(redirectPath) ? { redirectPath } : null;
  if (!record(value.law) || !record(value.article) || !record(value.navigation)) return null;
  const lawSlug = slug(value.law.slug, 160); const articleSlug = slug(value.article.slug, 180);
  const canonicalPath = text(value.canonicalPath);
  if (!lawSlug || !articleSlug || canonicalPath !== publicRoutes.laws.article(lawSlug, articleSlug)) return null;
  const lawId = integer(value.law.id); const articleId = integer(value.article.id);
  if (!lawId || !articleId || integer(value.article.lawId) !== lawId || !text(value.law.title) || !text(value.article.number)) return null;
  const readinessValue = record(value.readiness) ? value.readiness : {};
  const readiness = readinessValue.status === 'READY'
    ? { status: 'READY' as const, reasonCodes: [] }
    : { status: 'NOT_READY' as const, reasonCodes: Array.isArray(readinessValue.reasonCodes) ? readinessValue.reasonCodes.map(text).filter(Boolean) : ['instance_readiness.not_evaluated'] };
  const blocks = Array.isArray(value.article.blocks) ? value.article.blocks.filter(record).map((block) => ({
    id: integer(block.id), uid: text(block.uid), kind: text(block.kind), label: nullableText(block.label),
    text: text(block.text), parentUid: nullableText(block.parentUid), anchor: nullableText(block.anchor), sortOrder: integer(block.sortOrder),
  })).filter((block) => block.text) : [];
  const sectionValue = record(value.section) ? value.section : null;
  return {
    law: { id: lawId, slug: lawSlug, title: text(value.law.title), shortTitle: nullableText(value.law.shortTitle), number: nullableText(value.law.number), year: nullableText(value.law.year), status: text(value.law.status), officialUrl: nullableText(value.law.officialUrl), sourceName: nullableText(value.law.sourceName), updatedAt: nullableText(value.law.updatedAt) },
    article: { id: articleId, lawId, sectionId: value.article.sectionId == null ? null : integer(value.article.sectionId), slug: articleSlug, number: text(value.article.number), title: nullableText(value.article.title), officialText: text(value.article.officialText), officialStatus: text(value.article.officialStatus), officialAnchor: nullableText(value.article.officialAnchor), updatedAt: nullableText(value.article.updatedAt), blocks },
    section: sectionValue ? { id: integer(sectionValue.id), title: nullableText(sectionValue.title), titleLabel: nullableText(sectionValue.titleLabel), titleName: nullableText(sectionValue.titleName), chapterLabel: nullableText(sectionValue.chapterLabel), chapterName: nullableText(sectionValue.chapterName) } : null,
    navigation: { previous: parseNavigation(value.navigation.previous, lawSlug), next: parseNavigation(value.navigation.next, lawSlug) },
    canonicalPath,
    breadcrumbs: Array.isArray(value.breadcrumbs) ? value.breadcrumbs.filter(record).map((crumb) => ({ label: text(crumb.label), path: text(crumb.path) })).filter((crumb) => crumb.label && crumb.path.startsWith('/')) : [],
    readiness,
    editorial: { commentaryAvailable: false, protectedContentIncluded: false },
  };
};

const fetchUncached = async (lawSlug: string, articleSlug: string, fetchImpl: typeof fetch = fetch, baseUrl?: string) => {
  if (!slug(lawSlug, 160) || !slug(articleSlug, 180)) return null;
  const url = new URL(ENDPOINTS.legalCommentary.articleDetail, resolveAbsoluteApiBaseUrl(baseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined));
  url.searchParams.set('lawSlug', lawSlug); url.searchParams.set('articleSlug', articleSlug);
  const response = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_law_article_fetch_failed:${response.status}`);
  const payload = await response.json();
  return parsePublicLawArticleDetail(record(payload) && 'data' in payload ? payload.data : payload);
};

export const fetchPublicLawArticle = cache(fetchUncached);
export const fetchPublicLawArticleForTest = fetchUncached;
