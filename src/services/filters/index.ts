/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData, readApiErrorMessage } from '@services/api';
import { buildRequestCacheKey, clearRequestCoalescing, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { Question, TaxonomyUsage, TaxonomyUsageSummary } from '@types';

type RawFilterNode = Record<string, unknown>;

export type KnowledgeTaxonomyLevel = 'materia' | 'topico' | 'subtopico' | 'assunto';

type RawQuestionArea = {
  nome?: string;
  name?: string;
  descricao?: string;
  ['descrição']?: string;
};

type RawQuestionExam = {
  nome?: string;
  name?: string;
  orgao?: RawFilterNode;
  banca?: RawFilterNode;
};

type QuestionWithTaxonomyExtras = Question & {
  areas?: RawQuestionArea[];
  provas?: RawQuestionExam[];
};

type FiltersSaveResponse = {
  id?: number | string;
  data?: {
    id?: number | string;
  };
};

export interface FiltersBulkDeleteResult {
  deletedIds: number[];
  deletedCount: number;
}

export interface FiltersApiPayload {
  bancas?: RawFilterNode[];
  orgaos?: RawFilterNode[];
  assuntos?: RawFilterNode[];
  cargos?: RawFilterNode[];
  anos?: Array<string | number>;
  carreiras?: RawFilterNode[];
  areas?: RawFilterNode[];
  usage?: {
    all?: Record<string, unknown>;
    byType?: Record<string, Record<string, unknown>>;
    byFilterId?: Record<string, Record<string, unknown>>;
  };
}

export interface AdminFilterListItem {
  id: number;
  type: string;
  name: string;
  slug: string;
  sigla?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  description?: string | null;
  website?: string | null;
  assetUrl?: string | null;
  iconKey?: string | null;
  aliases?: string[];
  keywords?: string[];
  taxonomyLevel?: string | null;
  relationships?: Array<Record<string, unknown>>;
  sourceIdentities?: Array<Record<string, unknown>>;
  usage: TaxonomyUsage;
}

export interface AdminFiltersPage {
  rows: AdminFilterListItem[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  usage: {
    all: TaxonomyUsageSummary;
    byType: Record<string, TaxonomyUsageSummary>;
  };
}

export interface FilterSavePayload {
  id?: number;
  type: string;
  name: string;
  sigla?: string;
  slug?: string;
  parent_id?: number | null;
  materia?: boolean;
  taxonomy_level?: KnowledgeTaxonomyLevel | string;
  description?: string;
  website?: string;
  assetUrl?: string;
  iconKey?: string;
  aliases?: string[];
  keywords?: string[];
  metadata?: Record<string, unknown>;
}

const readStringList = (value: unknown): string[] => Array.isArray(value)
  ? value.map((item) => String(item || '').trim()).filter(Boolean)
  : [];

const readTaxonomyPresentation = (item: RawFilterNode) => ({
  description: typeof item.description === 'string' ? item.description : undefined,
  website: typeof item.website === 'string' ? item.website : undefined,
  assetUrl: typeof item.assetUrl === 'string'
    ? item.assetUrl
    : typeof item.asset_url === 'string' ? item.asset_url : undefined,
  iconKey: typeof item.iconKey === 'string'
    ? item.iconKey
    : typeof item.icon_key === 'string' ? item.icon_key : undefined,
  aliases: readStringList(item.aliases),
  keywords: readStringList(item.keywords),
  usage: readTaxonomyUsage(item.usage),
});

const readTaxonomyUsage = (value: unknown) => {
  const usage = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    questions: Number(usage.questions || 0),
    exams: Number(usage.exams || 0),
    laws: Number(usage.laws || 0),
    total: Number(usage.total || 0),
  };
};

export const ENEM_FOCUS_NAME = 'ENEM';

export const ENEM_SUBJECT_AREA_OPTIONS = [
  'Linguagens, Codigos e suas Tecnologias',
  'Ciencias Humanas e suas Tecnologias',
  'Ciencias da Natureza e suas Tecnologias',
  'Matematica e suas Tecnologias',
] as const;

export const ENEM_SUBJECT_AREA_DESCRIPTIONS: Record<(typeof ENEM_SUBJECT_AREA_OPTIONS)[number], string[]> = {
  'Linguagens, Codigos e suas Tecnologias': [
    'Lingua Portuguesa',
    'Literatura',
    'Lingua Estrangeira (Ingles ou Espanhol)',
    'Artes',
    'Educacao Fisica',
    'Tecnologias da Informacao e Comunicacao',
  ],
  'Ciencias Humanas e suas Tecnologias': [
    'Historia (Geral e Brasil)',
    'Geografia',
    'Filosofia',
    'Sociologia',
  ],
  'Ciencias da Natureza e suas Tecnologias': [
    'Quimica',
    'Fisica',
    'Biologia',
    'Ecologia',
    'Impactos Ambientais',
    'Saude',
  ],
  'Matematica e suas Tecnologias': [
    'Algebra',
    'Geometria',
    'Estatistica',
    'Matematica Financeira',
    'Raciocinio Logico',
    'Matematica',
  ],
};

const normalizeFilterText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeFilterSlug = (value: unknown) => normalizeFilterText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const isFilterSlugConflict = (error: unknown) => {
  const status = typeof error === 'object' && error && 'response' in error
    ? Number((error as { response?: { status?: unknown } }).response?.status)
    : 0;
  const message = readApiErrorMessage(error, '').toLowerCase();
  return status === 409 || (message.includes('slug') && (message.includes('uso') || message.includes('use')));
};

const ENEM_SUBJECT_AREA_KEYWORDS: Record<(typeof ENEM_SUBJECT_AREA_OPTIONS)[number], string[]> = {
  'Linguagens, Codigos e suas Tecnologias': [
    'lingua portuguesa',
    'portugues',
    'literatura',
    'ingles',
    'espanhol',
    'artes',
    'educacao fisica',
    'tecnologias da informacao',
    'tecnologia da informacao',
    'comunicacao',
  ],
  'Ciencias Humanas e suas Tecnologias': [
    'historia',
    'geografia',
    'filosofia',
    'sociologia',
  ],
  'Ciencias da Natureza e suas Tecnologias': [
    'quimica',
    'fisica',
    'biologia',
    'ecologia',
    'impactos ambientais',
    'saude',
  ],
  'Matematica e suas Tecnologias': [
    'matematica',
    'algebra',
    'geometria',
    'estatistica',
    'matematica financeira',
    'raciocinio logico',
  ],
};

const readNamedValue = (entry: unknown, keys: string[]) => {
  if (entry == null) {
    return '';
  }

  if (typeof entry === 'string' || typeof entry === 'number') {
    return String(entry);
  }

  if (typeof entry !== 'object') {
    return '';
  }

  const objectEntry = entry as Record<string, unknown>;
  for (const key of keys) {
    const value = objectEntry[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  return '';
};

const collectQuestionTexts = (question: Question) => {
  const extendedQuestion = question as QuestionWithTaxonomyExtras;
  const values = [
    ...(question.carreiras || []).map((item) => readNamedValue(item, ['nome', 'name', 'descricao', 'descrição'])),
    ...(question.orgaos || []).map((item) => readNamedValue(item, ['nome', 'name', 'sigla'])),
    ...(question.bancas || []).map((item) => readNamedValue(item, ['nome', 'name', 'sigla'])),
    ...(question.assuntos || []).map((item) => readNamedValue(item, ['nome', 'name'])),
    ...(extendedQuestion.areas || []).map((item) => readNamedValue(item, ['nome', 'name', 'descricao', 'descrição'])),
    ...(extendedQuestion.provas || []).flatMap((item) => [
      readNamedValue(item, ['nome', 'name']),
      readNamedValue(item.orgao, ['nome', 'name', 'sigla']),
      readNamedValue(item.banca, ['nome', 'name', 'sigla']),
    ]),
  ];

  return values.map(normalizeFilterText).filter(Boolean);
};

export const injectEnemFocusOption = (careers: string[]) => {
  const enemKey = normalizeFilterText(ENEM_FOCUS_NAME);
  const seen = new Set<string>();
  const next = careers
    .map((career) => String(career || '').trim())
    .filter(Boolean)
    .filter((career) => normalizeFilterText(career) !== enemKey)
    .filter((career) => {
      const key = normalizeFilterText(career);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return [ENEM_FOCUS_NAME, ...next];
};

export const normalizeCareerSelectorLabel = (value: unknown) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  const trailingGroupMatch = rawValue.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!trailingGroupMatch) {
    const [baseLabel] = rawValue.split('/');
    const normalizedBaseLabel = String(baseLabel || rawValue).trim();
    return normalizeFilterText(normalizedBaseLabel) === normalizeFilterText(ENEM_FOCUS_NAME)
      ? ENEM_FOCUS_NAME
      : normalizedBaseLabel;
  }

  const baseLabel = trailingGroupMatch[1].trim();
  if (!baseLabel) {
    return rawValue;
  }

  return normalizeFilterText(baseLabel) === normalizeFilterText(ENEM_FOCUS_NAME)
    ? ENEM_FOCUS_NAME
    : baseLabel;
};

export const isEnemQuestion = (question: Question) => {
  const texts = collectQuestionTexts(question);
  return texts.some((text) =>
    text.includes('enem')
    || text.includes('exame nacional do ensino medio')
    || text.includes('inep')
    || text.includes('instituto nacional de estudos e pesquisas educacionais'),
  );
};

export const getEnemSubjectAreasForQuestion = (question: Question) => {
  const texts = collectQuestionTexts(question);
  const matchedAreas = ENEM_SUBJECT_AREA_OPTIONS.filter((areaName) =>
    ENEM_SUBJECT_AREA_KEYWORDS[areaName].some((keyword) =>
      texts.some((text) => text.includes(keyword)),
    ),
  );

  return Array.from(new Set(matchedAreas));
};

const getTaxonomyParentId = (item: RawFilterNode) => {
  const parentId = item.pai ?? item.parent_id ?? item.parentId ?? item.assunto_raiz ?? null;
  return parentId === null || parentId === undefined || parentId === '' ? undefined : String(parentId);
};

const getTaxonomyLevelFromPayload = (item: RawFilterNode): KnowledgeTaxonomyLevel | '' => {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {};
  const rawLevel = String(
    item.taxonomy_level
    || item.taxonomyLevel
    || item.nivel_taxonomia
    || metadata.taxonomy_level
    || '',
  ).toLowerCase();

  return ['materia', 'topico', 'subtopico', 'assunto'].includes(rawLevel)
    ? rawLevel as KnowledgeTaxonomyLevel
    : '';
};

const readBooleanFlag = (value: unknown) => value === true || value === 1 || value === '1';

const isMatterTaxonomy = (item: RawFilterNode) => (
  readBooleanFlag(item.materia) || readBooleanFlag(item.meta_materia)
  || getTaxonomyLevelFromPayload(item) === 'materia'
);

/**
 * Converte o payload bruto da API para o formato de taxonomias usado no app.
 * A hierarquia canonica e: Materia -> Topico -> Subtopico -> Assunto.
 * Payloads legados sem taxonomy_level preservam a inferencia anterior.
 */
export const normalizeFiltersToTaxonomies = (data: FiltersApiPayload) => {
  const rawSubjects = data.assuntos || [];
  const subjectIds = new Set(
    rawSubjects
      .filter(isMatterTaxonomy)
      .map((item) => String(item.id)),
  );
  const nonSubjectIds = new Set(
    rawSubjects
      .filter((item) => !isMatterTaxonomy(item))
      .map((item) => String(item.id)),
  );

  const rawById = new Map(rawSubjects.map((item) => [String(item.id), item]));
  const resolveRootSubjectId = (item: RawFilterNode): string | undefined => {
    let current: RawFilterNode | undefined = item;
    const visited = new Set<string>();
    for (let depth = 0; current && depth < 16; depth += 1) {
      const currentId = String(current.id ?? '');
      if (!currentId || visited.has(currentId)) return undefined;
      visited.add(currentId);
      if (isMatterTaxonomy(current)) return currentId;
      const parentId = getTaxonomyParentId(current);
      current = parentId ? rawById.get(parentId) : undefined;
    }
    return undefined;
  };

  const subjects = rawSubjects.filter(isMatterTaxonomy).map((item) => ({
    id: String(item.id),
    name: readNamedValue(item, ['nome', 'name']),
    slug: typeof item.slug === 'string' ? item.slug : undefined,
    ...readTaxonomyPresentation(item),
    materia: true,
    taxonomyLevel: 'materia',
    type: 'subject',
  }));

  const nonSubjectTaxonomies = rawSubjects.filter((item) => !isMatterTaxonomy(item)).map((item) => {
    const parentId = getTaxonomyParentId(item);
    const explicitLevel = getTaxonomyLevelFromPayload(item);
    const taxonomyLevel = explicitLevel || (parentId && nonSubjectIds.has(parentId) ? 'assunto' : 'topico');
    const rootSubjectId = resolveRootSubjectId(item);

    return {
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      ...readTaxonomyPresentation(item),
      parentId,
      rootSubjectId: rootSubjectId && subjectIds.has(String(rootSubjectId)) ? String(rootSubjectId) : undefined,
      materia: false,
      taxonomyLevel,
      type: taxonomyLevel === 'topico' ? 'topic' : 'subject',
    };
  });

  return {
    agencies: (data.bancas || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      sigla: typeof item.sigla === 'string' ? item.sigla : undefined,
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      ...readTaxonomyPresentation(item),
      type: 'agency',
    })),
    organizations: (data.orgaos || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      sigla: typeof item.sigla === 'string' ? item.sigla : undefined,
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      ...readTaxonomyPresentation(item),
      type: 'organization',
    })),
    subjects,
    topics: nonSubjectTaxonomies,
    subjectTopics: nonSubjectTaxonomies.filter((item) => item.taxonomyLevel === 'topico'),
    subtopics: nonSubjectTaxonomies.filter((item) => item.taxonomyLevel === 'subtopico'),
    specificSubjects: nonSubjectTaxonomies.filter((item) => item.taxonomyLevel === 'assunto'),
    roles: (data.cargos || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['descrição', 'descricao', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      ...readTaxonomyPresentation(item),
      parentId: item.pai || item.parent_id ? String(item.pai || item.parent_id) : undefined,
      type: 'role',
    })),
    careers: (data.carreiras || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      ...readTaxonomyPresentation(item),
      parentId: item.pai || item.parent_id ? String(item.pai || item.parent_id) : undefined,
      type: 'career',
    })),
    areas: (data.areas || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      ...readTaxonomyPresentation(item),
      parentId: item.pai || item.parent_id ? String(item.pai || item.parent_id) : undefined,
      type: 'area',
    })),
    years: (data.anos || []).map(String),
    usage: data.usage ? {
      all: {
        taxonomies: Number(data.usage.all?.taxonomies || 0),
        questions: Number(data.usage.all?.questions || 0),
        exams: Number(data.usage.all?.exams || 0),
        laws: Number(data.usage.all?.laws || 0),
        total: Number(data.usage.all?.total || 0),
      },
      byType: Object.fromEntries(Object.entries(data.usage.byType || {}).map(([type, usage]) => [type, {
        taxonomies: Number(usage.taxonomies || 0),
        questions: Number(usage.questions || 0),
        exams: Number(usage.exams || 0),
        laws: Number(usage.laws || 0),
        total: Number(usage.total || 0),
      }])),
      byFilterId: Object.fromEntries(Object.entries(data.usage.byFilterId || {}).map(([id, usage]) => [id, readTaxonomyUsage(usage)])),
    } : undefined,
    modalities: ['Múltipla Escolha', 'Certo/Errado'],
  };
};

export const filtersService = {
  async list(force = false): Promise<FiltersApiPayload> {
    const cacheKey = buildRequestCacheKey('filters:list');
    if (force) {
      clearRequestCoalescing(cacheKey);
    }

    return withRequestCoalescing(
      cacheKey,
      async () => {
        const response = await apiClient.get<FiltersApiPayload>(ENDPOINTS.filters.list);
        return readApiData<FiltersApiPayload>(response, {});
      },
      60_000,
    );
  },

  async listTaxonomies(force = false) {
    const payload = await this.list(force);
    return normalizeFiltersToTaxonomies(payload);
  },

  async listPracticeTaxonomies(force = false) {
    const cacheKey = buildRequestCacheKey('filters:list:practice');
    if (force) {
      clearRequestCoalescing(cacheKey);
    }

    const payload = await withRequestCoalescing(
      cacheKey,
      async () => {
        const response = await apiClient.get<FiltersApiPayload>(ENDPOINTS.filters.list, {
          params: { scope: 'practice' },
        });
        return readApiData<FiltersApiPayload>(response, {});
      },
      60_000,
    );

    return normalizeFiltersToTaxonomies(payload);
  },

  async listAdminPage(params: {
    page?: number;
    perPage?: number;
    type?: string;
    search?: string;
  } = {}): Promise<AdminFiltersPage> {
    const response = await apiClient.get<AdminFiltersPage>(ENDPOINTS.filters.adminList, {
      params: {
        page: String(params.page || 1),
        per_page: String(params.perPage || 50),
        type: params.type || 'all',
        search: params.search || '',
      },
    });
    return readApiData<AdminFiltersPage>(response, {
      rows: [],
      total: 0,
      page: 1,
      perPage: 50,
      pages: 1,
      usage: {
        all: { taxonomies: 0, questions: 0, exams: 0, laws: 0, total: 0 },
        byType: {},
      },
    });
  },

  async getAdminItem(id: number): Promise<AdminFilterListItem> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Taxonomia invalida.');
    }

    const response = await apiClient.get<AdminFilterListItem>(ENDPOINTS.filters.adminList, {
      params: { id: String(id) },
    });
    const item = readApiData<AdminFilterListItem | null>(response, null);
    if (!item || Number(item.id) !== id) {
      throw new Error('A taxonomia nao foi encontrada.');
    }
    return item;
  },

  async save(payload: FilterSavePayload): Promise<number> {
    let response;
    try {
      response = await apiClient.post<FiltersSaveResponse>(ENDPOINTS.filters.save, payload);
    } catch (error) {
      if (!payload.id && isFilterSlugConflict(error)) {
        const taxonomies = await this.listTaxonomies(true);
        const requestedType = normalizeFilterText(payload.type);
        const requestedName = normalizeFilterText(payload.name);
        const requestedSlug = normalizeFilterSlug(payload.slug || payload.name);

        if (['ano', 'anos', 'year', 'years'].includes(requestedType)) {
          const existingYear = (taxonomies.years || []).find((year) => (
            normalizeFilterText(year) === requestedName
            || normalizeFilterSlug(year) === requestedSlug
          ));

          if (existingYear) {
            return Number(existingYear) || 0;
          }
        }

        const matches = [
          ...taxonomies.agencies,
          ...taxonomies.organizations,
          ...taxonomies.subjects,
          ...taxonomies.topics,
          ...taxonomies.roles,
          ...taxonomies.careers,
        ];
        const existing = matches.find((item) => {
          const itemType = normalizeFilterText(item.type);
          const itemName = normalizeFilterText(item.name);
          const itemSigla = normalizeFilterText('sigla' in item ? item.sigla : '');
          const itemSlug = normalizeFilterSlug(item.slug || item.name);
          const sameType = !requestedType
            || itemType === requestedType
            || (requestedType === 'bancas' && itemType === 'agency')
            || (requestedType === 'orgaos' && itemType === 'organization')
            || (requestedType === 'cargos' && itemType === 'role')
            || (requestedType === 'carreiras' && itemType === 'career')
            || (requestedType === 'assuntos' && ['subject', 'topic'].includes(itemType));
          return sameType && (
            itemSlug === requestedSlug
            || itemName === requestedName
            || Boolean(itemSigla && itemSigla === requestedName)
          );
        });

        const existingId = Number(existing?.id || 0);
        if (existingId > 0) {
          return existingId;
        }
      }
      throw error;
    }

    const envelope = assertApiSuccess(response, 'Erro ao salvar filtro');
    const result = readApiData<FiltersSaveResponse>(response, {});

    clearRequestCoalescing(buildRequestCacheKey('filters:list'));

    return Number(result.data?.id ?? result.id ?? envelope.raw.id ?? 0);
  },

  async remove(id: number): Promise<void> {
    const response = await apiClient.get(ENDPOINTS.filters.delete, { params: { id: id.toString() } });
    assertApiSuccess(response, 'Erro ao deletar filtro');
    clearRequestCoalescing(buildRequestCacheKey('filters:list'));
  },

  async removeMany(ids: number[]): Promise<FiltersBulkDeleteResult> {
    const normalizedIds = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      throw new Error('Selecione ao menos uma taxonomia para excluir.');
    }

    const response = await apiClient.post(ENDPOINTS.filters.delete, { ids: normalizedIds });
    assertApiSuccess(response, 'Erro ao excluir taxonomias');
    const result = readApiData<FiltersBulkDeleteResult>(response, {
      deletedIds: [],
      deletedCount: 0,
    });
    clearRequestCoalescing(buildRequestCacheKey('filters:list'));

    return {
      deletedIds: Array.isArray(result.deletedIds) ? result.deletedIds.map(Number).filter(Number.isFinite) : [],
      deletedCount: Number(result.deletedCount || 0),
    };
  },
};

export default filtersService;
