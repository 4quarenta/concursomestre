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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { Question } from '@types';

export interface FiltersApiPayload {
  bancas?: Record<string, any>[];
  orgaos?: Record<string, any>[];
  assuntos?: Record<string, any>[];
  cargos?: Record<string, any>[];
  anos?: Array<string | number>;
  carreiras?: Record<string, any>[];
}

export interface FilterSavePayload {
  id?: number;
  type: string;
  name: string;
  slug?: string;
  parent_id?: number | null;
  description?: string;
  website?: string;
  metadata?: Record<string, any>;
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

const readNamedValue = (entry: any, keys: string[]) => {
  if (entry == null) {
    return '';
  }

  if (typeof entry === 'string' || typeof entry === 'number') {
    return String(entry);
  }

  for (const key of keys) {
    const value = entry?.[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  return '';
};

const collectQuestionTexts = (question: Question) => {
  const values = [
    ...(question.carreiras || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'descricao', 'descrição'])),
    ...(question.orgaos || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'sigla'])),
    ...(question.bancas || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'sigla'])),
    ...(question.assuntos || []).map((item: any) => readNamedValue(item, ['nome', 'name'])),
    ...((question as any).areas || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'descricao', 'descrição'])),
    ...((question as any).provas || []).flatMap((item: any) => [
      readNamedValue(item, ['nome', 'name']),
      readNamedValue(item?.orgao, ['nome', 'name', 'sigla']),
      readNamedValue(item?.banca, ['nome', 'name', 'sigla']),
    ]),
  ];

  return values.map(normalizeFilterText).filter(Boolean);
};

export const injectEnemFocusOption = (careers: string[]) => {
  const next = careers.filter(Boolean);
  const hasEnem = next.some((career) => normalizeFilterText(career) === normalizeFilterText(ENEM_FOCUS_NAME));
  if (hasEnem) {
    return next;
  }

  return [ENEM_FOCUS_NAME, ...next];
};

export const normalizeCareerSelectorLabel = (value: unknown) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  const trailingGroupMatch = rawValue.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!trailingGroupMatch) {
    return rawValue;
  }

  const baseLabel = trailingGroupMatch[1].trim();
  const detailLabel = trailingGroupMatch[2].trim();
  if (!baseLabel || !detailLabel) {
    return rawValue;
  }

  return `${baseLabel} / ${detailLabel}`;
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

/**
 * Converte o payload bruto da API para o formato de taxonomias usado no app.
 */
export const normalizeFiltersToTaxonomies = (data: FiltersApiPayload) => ({
  agencies: data.bancas?.map((b: any) => ({
    id: b.id,
    name: b.nome || b.name,
    sigla: b.sigla,
    slug: b.slug,
    description: b.description,
    website: b.website,
    type: 'agency',
  })) || [],
  organizations: data.orgaos?.map((o: any) => ({
    id: o.id,
    name: o.nome || o.name,
    sigla: o.sigla,
    slug: o.slug,
    description: o.description,
    website: o.website,
    type: 'organization',
  })) || [],
  subjects: data.assuntos?.filter((a: any) => a.materia).map((a: any) => ({
    id: a.id,
    name: a.nome || a.name,
    slug: a.slug,
    description: a.description,
    website: a.website,
    materia: true,
    type: 'subject',
  })) || [],
  topics: data.assuntos?.filter((a: any) => !a.materia).map((a: any) => ({
    id: a.id,
    name: a.nome || a.name,
    slug: a.slug,
    description: a.description,
    website: a.website,
    parentId: a.pai || a.parent_id,
    materia: false,
    type: 'topic',
  })) || [],
  roles: data.cargos?.map((c: any) => ({
    id: c.id,
    name: c['descrição'] || c.descricao || c.name,
    slug: c.slug,
    description: c.description,
    website: c.website,
    parentId: c.pai || c.parent_id,
    type: 'role',
  })) || [],
  careers: data.carreiras?.map((c: any) => ({
    id: c.id,
    name: c.nome || c.name,
    slug: c.slug,
    description: c.description,
    website: c.website,
    parentId: c.pai || c.parent_id,
    type: 'career',
  })) || [],
  years: data.anos?.map(String) || [],
  modalities: ['Múltipla Escolha', 'Certo/Errado'],
});

export const filtersService = {
  async list(): Promise<FiltersApiPayload> {
    const response = await apiClient.get<any>(ENDPOINTS.filters.list) as any;
    return readApiData(response, {});
  },

  async listTaxonomies() {
    const payload = await this.list();
    return normalizeFiltersToTaxonomies(payload);
  },

  async save(payload: FilterSavePayload): Promise<number> {
    const response = await apiClient.post<any>(ENDPOINTS.filters.save, payload) as any;
    const raw = assertApiSuccess(response, 'Erro ao salvar filtro').raw;

    return raw?.data?.id ?? raw?.id ?? 0;
  },

  async remove(id: number): Promise<void> {
    const response = await apiClient.get<any>(ENDPOINTS.filters.delete, { params: { id: id.toString() } }) as any;
    assertApiSuccess(response, 'Erro ao deletar filtro');
  },
};

export default filtersService;
