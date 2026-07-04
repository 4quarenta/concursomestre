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
import type { Question } from '@types';

type RawFilterNode = Record<string, unknown>;

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

export interface FiltersApiPayload {
  bancas?: RawFilterNode[];
  orgaos?: RawFilterNode[];
  assuntos?: RawFilterNode[];
  cargos?: RawFilterNode[];
  anos?: Array<string | number>;
  carreiras?: RawFilterNode[];
}

export interface FilterSavePayload {
  id?: number;
  type: string;
  name: string;
  sigla?: string;
  slug?: string;
  parent_id?: number | null;
  materia?: boolean;
  taxonomy_level?: 'materia' | 'topico' | 'assunto' | string;
  description?: string;
  website?: string;
  metadata?: Record<string, unknown>;
}

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

const getTaxonomyLevelFromPayload = (item: RawFilterNode) => {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {};
  const rawLevel = String(
    item.taxonomy_level
    || item.taxonomyLevel
    || item.nivel_taxonomia
    || metadata.taxonomy_level
    || '',
  ).toLowerCase();

  return rawLevel === 'materia' || rawLevel === 'topico' || rawLevel === 'assunto'
    ? rawLevel
    : '';
};

/**
 * Converte o payload bruto da API para o formato de taxonomias usado no app.
 * A hierarquia de estudo passa a ser: Materia -> Topico -> Assunto.
 */
export const normalizeFiltersToTaxonomies = (data: FiltersApiPayload) => {
  const rawSubjects = data.assuntos || [];
  const subjectIds = new Set(
    rawSubjects
      .filter((item) => Boolean(item.materia))
      .map((item) => String(item.id)),
  );
  const nonSubjectIds = new Set(
    rawSubjects
      .filter((item) => !item.materia)
      .map((item) => String(item.id)),
  );

  const subjects = rawSubjects.filter((item) => item.materia).map((item) => ({
    id: String(item.id),
    name: readNamedValue(item, ['nome', 'name']),
    slug: typeof item.slug === 'string' ? item.slug : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    website: typeof item.website === 'string' ? item.website : undefined,
    materia: true,
    taxonomyLevel: 'materia',
    type: 'subject',
  }));

  const nonSubjectTaxonomies = rawSubjects.filter((item) => !item.materia).map((item) => {
    const parentId = getTaxonomyParentId(item);
    const explicitLevel = getTaxonomyLevelFromPayload(item);
    const taxonomyLevel = explicitLevel || (parentId && nonSubjectIds.has(parentId) ? 'assunto' : 'topico');
    const parentTopic = taxonomyLevel === 'assunto'
      ? rawSubjects.find((rawItem) => String(rawItem.id) === parentId)
      : null;
    const rootSubjectId = taxonomyLevel === 'topico'
      ? parentId
      : parentTopic
        ? getTaxonomyParentId(parentTopic)
        : undefined;

    return {
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      website: typeof item.website === 'string' ? item.website : undefined,
      parentId,
      rootSubjectId: rootSubjectId && subjectIds.has(String(rootSubjectId)) ? String(rootSubjectId) : undefined,
      materia: false,
      taxonomyLevel,
      type: 'topic',
    };
  });

  return {
    agencies: (data.bancas || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      sigla: typeof item.sigla === 'string' ? item.sigla : undefined,
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      website: typeof item.website === 'string' ? item.website : undefined,
      type: 'agency',
    })),
    organizations: (data.orgaos || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      sigla: typeof item.sigla === 'string' ? item.sigla : undefined,
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      website: typeof item.website === 'string' ? item.website : undefined,
      type: 'organization',
    })),
    subjects,
    topics: nonSubjectTaxonomies,
    subjectTopics: nonSubjectTaxonomies.filter((item) => item.taxonomyLevel === 'topico'),
    specificSubjects: nonSubjectTaxonomies.filter((item) => item.taxonomyLevel === 'assunto'),
    roles: (data.cargos || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['descrição', 'descricao', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      website: typeof item.website === 'string' ? item.website : undefined,
      parentId: item.pai || item.parent_id ? String(item.pai || item.parent_id) : undefined,
      type: 'role',
    })),
    careers: (data.carreiras || []).map((item) => ({
      id: String(item.id),
      name: readNamedValue(item, ['nome', 'name']),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      website: typeof item.website === 'string' ? item.website : undefined,
      parentId: item.pai || item.parent_id ? String(item.pai || item.parent_id) : undefined,
      type: 'career',
    })),
    years: (data.anos || []).map(String),
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
          const itemSigla = normalizeFilterText(item.sigla);
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
};

export default filtersService;
