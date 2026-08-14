import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import {
  withValidatedSeoEnvelopeShadow,
  type SeoEnvelopeCarrier,
} from '@services/seo/seoEnvelope';

export type PublicTaxonomyDirectoryKind = 'subjects' | 'boards';

export type PublicTaxonomyDirectoryItem = SeoEnvelopeCarrier & {
  id: number;
  name: string;
  slug: string;
  acronym: string | null;
  description: string | null;
  imageUrl: string | null;
  questionCount: number;
  examCount: number;
};

export type PublicTaxonomyDirectoryPage = {
  items: PublicTaxonomyDirectoryItem[];
  pageInfo: {
    page: number;
    perPage: number;
    pages: number;
    total: number;
    hasPrevious: boolean;
    hasMore: boolean;
  };
};

export type PublicBoardExamStatus = 'open' | 'upcoming' | 'completed' | 'unknown';

export type PublicBoardDetail = SeoEnvelopeCarrier & {
  board: PublicTaxonomyDirectoryItem & { website: string | null };
  examSummary: {
    total: number;
    open: number;
    upcoming: number;
    completed: number;
    unknown: number;
  };
  topSubjects: Array<{ id: number; name: string; slug: string; questionCount: number }>;
  questionProfile: Array<{ modality: string; difficulty: number; questionCount: number }>;
  exams: Array<{
    id: number;
    title: string;
    slug: string;
    year: number;
    registrationStart: string | null;
    registrationEnd: string | null;
    examDate: string | null;
    resultDate: string | null;
    questionCount: number;
    organizations: string[];
    status: PublicBoardExamStatus;
  }>;
  pageInfo: PublicTaxonomyDirectoryPage['pageInfo'];
};

const EMPTY_PAGE: PublicTaxonomyDirectoryPage = {
  items: [],
  pageInfo: {
    page: 1,
    perPage: 30,
    pages: 1,
    total: 0,
    hasPrevious: false,
    hasMore: false,
  },
};

const readEnvelopeData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return null;
  return Object.prototype.hasOwnProperty.call(payload, 'data')
    ? (payload as { data?: unknown }).data
    : payload;
};

export const fetchPublicTaxonomyDirectory = async ({
  type,
  page,
  search,
  letter,
}: {
  type: PublicTaxonomyDirectoryKind;
  page: number;
  search: string;
  letter: string;
}): Promise<PublicTaxonomyDirectoryPage> => {
  const apiBaseUrl = resolveAbsoluteApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  const url = new URL('filters/directory.php', apiBaseUrl);
  url.searchParams.set('type', type);
  url.searchParams.set('include_counts', 'questions,exams');
  url.searchParams.set('page', String(Math.max(1, page)));
  url.searchParams.set('per_page', '30');
  if (search) url.searchParams.set('search', search);
  if (letter) url.searchParams.set('letter', letter);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!response.ok) return EMPTY_PAGE;

    const data = readEnvelopeData(await response.json());
    if (!data || typeof data !== 'object') return EMPTY_PAGE;
    const record = data as Partial<PublicTaxonomyDirectoryPage>;
    const pageInfo = record.pageInfo || EMPTY_PAGE.pageInfo;

    return {
      items: Array.isArray(record.items) ? record.items.map((item) => {
        const expectedResourceType = type === 'boards' ? 'board' : 'taxonomy';
        const validated = withValidatedSeoEnvelopeShadow(item as PublicTaxonomyDirectoryItem & Record<string, unknown>, {
          expectedResourceType,
          expectedResourceId: item.id,
          source: `taxonomyDirectory.${type}`,
        });
        return {
          id: Number(item.id || 0),
          name: String(item.name || '').trim(),
          slug: String(item.slug || '').trim(),
          acronym: item.acronym ? String(item.acronym).trim() : null,
          description: item.description ? String(item.description).trim() : null,
          imageUrl: item.imageUrl ? String(item.imageUrl).trim() : null,
          questionCount: Math.max(0, Number(item.questionCount || 0)),
          examCount: Math.max(0, Number(item.examCount || 0)),
          ...(validated.publicationDecision ? { publicationDecision: validated.publicationDecision } : {}),
          ...(validated.seoDecision ? { seoDecision: validated.seoDecision } : {}),
          ...(validated.seoFacts ? { seoFacts: validated.seoFacts } : {}),
        };
      }).filter((item) => item.id > 0 && item.name !== '') : [],
      pageInfo: {
        page: Math.max(1, Number(pageInfo.page || 1)),
        perPage: Math.max(1, Number(pageInfo.perPage || 30)),
        pages: Math.max(1, Number(pageInfo.pages || 1)),
        total: Math.max(0, Number(pageInfo.total || 0)),
        hasPrevious: Boolean(pageInfo.hasPrevious),
        hasMore: Boolean(pageInfo.hasMore),
      },
    };
  } catch {
    return EMPTY_PAGE;
  }
};

export const fetchPublicBoardDetail = async ({
  slug,
  page,
  status,
}: {
  slug: string;
  page: number;
  status: PublicBoardExamStatus | 'all';
}): Promise<PublicBoardDetail | null> => {
  const apiBaseUrl = resolveAbsoluteApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  const url = new URL('filters/board.php', apiBaseUrl);
  url.searchParams.set('slug', slug);
  url.searchParams.set('page', String(Math.max(1, page)));
  url.searchParams.set('per_page', '12');
  url.searchParams.set('status', status);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const data = readEnvelopeData(await response.json());
    if (!data || typeof data !== 'object') return null;
    const record = data as PublicBoardDetail;
    if (!record.board || Number(record.board.id || 0) <= 0) return null;

    const validated = withValidatedSeoEnvelopeShadow(record as PublicBoardDetail & Record<string, unknown>, {
      expectedResourceType: 'board',
      expectedResourceId: record.board.id,
      source: 'taxonomyDirectory.fetchPublicBoardDetail',
    });

    return {
      ...validated,
      board: {
        ...record.board,
        id: Number(record.board.id),
        questionCount: Math.max(0, Number(record.board.questionCount || 0)),
        examCount: Math.max(0, Number(record.board.examCount || 0)),
      },
      examSummary: {
        total: Math.max(0, Number(record.examSummary?.total || 0)),
        open: Math.max(0, Number(record.examSummary?.open || 0)),
        upcoming: Math.max(0, Number(record.examSummary?.upcoming || 0)),
        completed: Math.max(0, Number(record.examSummary?.completed || 0)),
        unknown: Math.max(0, Number(record.examSummary?.unknown || 0)),
      },
      topSubjects: Array.isArray(record.topSubjects) ? record.topSubjects : [],
      questionProfile: Array.isArray(record.questionProfile) ? record.questionProfile : [],
      exams: Array.isArray(record.exams) ? record.exams : [],
      pageInfo: record.pageInfo || EMPTY_PAGE.pageInfo,
    };
  } catch {
    return null;
  }
};
