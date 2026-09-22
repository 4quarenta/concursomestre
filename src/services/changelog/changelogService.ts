import { apiClient, assertApiSuccess, ENDPOINTS, readApiData } from '@services/api';
import type { ApiResponse } from '@services/api';

export type ChangelogSection = {
  title: string;
  icon: string;
  items: string[];
};

export type ChangelogStatus = 'draft' | 'published' | 'archived';
export type ChangelogChannel = 'WEB' | 'APP' | 'BOTH';

export type ChangelogEntry = {
  id: number;
  version: string;
  slug: string;
  releaseDate: string;
  publishedAt: string | null;
  title: string;
  description: string;
  content: ChangelogSection[];
  status: ChangelogStatus;
  channel?: ChangelogChannel;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: { id: string | null; name: string | null };
  updatedBy?: { id: string | null; name: string | null };
};

export type ChangelogDraft = Pick<
  ChangelogEntry,
  'title' | 'slug' | 'releaseDate' | 'description' | 'content' | 'status'
> & { id: number | null; version?: string; channel: ChangelogChannel };

export type ChangelogPage = {
  items: ChangelogEntry[];
  pageInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export type SuggestionProductStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'declined';

export type ChangelogSuggestion = {
  id: number;
  title: string;
  details: string;
  supportStatus: 'new' | 'read' | 'resolved';
  status: SuggestionProductStatus;
  platformVersion: string;
  adminNote: string | null;
  changelogId: number | null;
  changelogTitle: string | null;
  likes: number;
  dislikes: number;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  user: { id: string | null; name: string | null; email: string | null };
};

export type ChangelogSuggestionPage = Omit<ChangelogPage, 'items'> & {
  items: ChangelogSuggestion[];
};

const emptyPage = (limit = 8): ChangelogPage => ({
  items: [],
  pageInfo: { page: 1, limit, total: 0, totalPages: 1, hasMore: false },
});

const DEV_MARKER_PATTERN = /(?:\[\s*dev\s*\]|\(\s*dev\s*\)|\bdev\b)/i;

export const BASELINE_1_0_0_CHANGELOG: ChangelogEntry = {
  id: 100000,
  version: '1.0.0',
  slug: 'concurso-mestre-1-0-0',
  releaseDate: '2026-06-05',
  publishedAt: '2026-06-05T12:00:00-03:00',
  title: 'O ConcursoMestre está no ar',
  description: 'A primeira versão pública reúne as principais ferramentas para organizar seus estudos e acompanhar seu desempenho.',
  status: 'published',
  channel: 'BOTH',
  content: [
    {
      title: 'Estudo mais completo',
      icon: 'BookOpen',
      items: [
        'Questões, simulados e Lei Comentada reunidos em uma experiência de estudo única.',
        'Filtros e estatísticas ajudam a encontrar o conteúdo certo e acompanhar a evolução.',
      ],
    },
    {
      title: 'Conta e comunidade',
      icon: 'Users',
      items: ['Perfil, suporte, comentários e sugestões integrados à plataforma.'],
    },
  ],
};

const sanitizePublicEntry = (entry: ChangelogEntry): ChangelogEntry | null => {
  if (!entry || DEV_MARKER_PATTERN.test(`${entry.version} ${entry.title} ${entry.description}`)) return null;
  return {
    ...entry,
    content: (Array.isArray(entry.content) ? entry.content : [])
      .filter((section) => !DEV_MARKER_PATTERN.test(`${section.title} ${section.icon}`))
      .map((section) => ({
        ...section,
        items: (Array.isArray(section.items) ? section.items : []).filter((item) => !DEV_MARKER_PATTERN.test(item)),
      }))
      .filter((section) => section.items.length > 0),
  };
};

export const normalizePublicChangelogPage = (page: ChangelogPage): ChangelogPage => {
  const items = (page.items || [])
    .map(sanitizePublicEntry)
    .filter((entry): entry is ChangelogEntry => Boolean(entry));
  if (page.pageInfo.page === 1 && !items.some((entry) => entry.version === '1.0.0')) {
    items.push(BASELINE_1_0_0_CHANGELOG);
  }
  return { ...page, items };
};

export const changelogService = {
  async list(params: Record<string, string | number | undefined> = {}): Promise<ChangelogPage> {
    const response = await apiClient.get<ApiResponse<ChangelogPage>>(ENDPOINTS.changelog.list, { params });
    return normalizePublicChangelogPage(readApiData(response, emptyPage()));
  },

  async adminList(params: Record<string, string | number | undefined> = {}): Promise<ChangelogPage> {
    const response = await apiClient.get<ApiResponse<ChangelogPage>>(ENDPOINTS.changelog.adminList, { params });
    assertApiSuccess(response, 'Não foi possível listar as novidades.');
    return readApiData(response, emptyPage(20));
  },

  async adminDetail(id: number): Promise<ChangelogEntry> {
    const response = await apiClient.get<ApiResponse<ChangelogEntry>>(ENDPOINTS.changelog.adminDetail, { params: { id } });
    assertApiSuccess(response, 'Não foi possível carregar a novidade.');
    return readApiData(response, {} as ChangelogEntry);
  },

  async save(input: ChangelogDraft): Promise<ChangelogEntry> {
    const response = await apiClient.post<ApiResponse<ChangelogEntry>>(ENDPOINTS.changelog.adminSave, input);
    assertApiSuccess(response, 'Não foi possível salvar a novidade.');
    return readApiData(response, {} as ChangelogEntry);
  },

  async archive(id: number): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.changelog.adminArchive, { id });
    assertApiSuccess(response, 'Não foi possível arquivar a novidade.');
  },

  async listSuggestions(params: Record<string, string | number | undefined> = {}): Promise<ChangelogSuggestionPage> {
    const response = await apiClient.get<ApiResponse<ChangelogSuggestionPage>>(ENDPOINTS.changelog.adminSuggestions, { params });
    assertApiSuccess(response, 'Não foi possível listar as sugestões.');
    return readApiData(response, { ...emptyPage(20), items: [] });
  },

  async updateSuggestion(input: {
    id: number;
    status: SuggestionProductStatus;
    adminNote?: string;
    changelogId?: number | null;
  }): Promise<ChangelogSuggestion> {
    const response = await apiClient.put<ApiResponse<ChangelogSuggestion>>(ENDPOINTS.changelog.adminSuggestions, input);
    assertApiSuccess(response, 'Não foi possível atualizar a sugestão.');
    return readApiData(response, {} as ChangelogSuggestion);
  },
};

export default changelogService;
