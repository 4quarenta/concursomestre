import type { Dispatch, SetStateAction } from 'react';
import type { GrupoQuestao, Prova, QuestionAsset, QuestionAssetUsage } from '@types';
import { normalizeProvaRecord } from '../exams/examBankUtils';

export interface QuestionTaxonomyRecord {
  id?: string | number | null;
  value?: string | number | null;
  filterId?: string | number | null;
  filter_id?: string | number | null;
  name?: string;
  nome?: string;
  descricao?: string;
  ['descri\u00e7\u00e3o']?: string;
  sigla?: string;
  label?: string;
  slug?: string;
  materia?: boolean;
  parentId?: string | number | null;
  parent_id?: string | number | null;
  pai?: string | number | null;
  assunto_raiz?: string | number | null;
  rootSubjectId?: string | number | null;
  root_subject_id?: string | number | null;
  rootSubjectName?: string;
  root_subject_name?: string;
  subjectId?: string | number | null;
  subject_id?: string | number | null;
  materiaId?: string | number | null;
  materia_id?: string | number | null;
  topicId?: string | number | null;
  topic_id?: string | number | null;
  parentName?: string;
  parent_name?: string;
  taxonomyLevel?: string;
  taxonomy_level?: string;
  parent?: QuestionTaxonomyRecord | null;
  paiItem?: QuestionTaxonomyRecord | null;
  rootSubject?: QuestionTaxonomyRecord | null;
}

export type QuestionTaxonomyOption = string | number | QuestionTaxonomyRecord | null | undefined;

export interface ManualQuestionItem {
  id: number;
  ordem?: number;
  rotulo: string;
  corpo: string;
  corpo_clean: string;
}

export interface ManualQuestionState {
  enunciado: string;
  enunciado_clean: string;
  introText: string;
  imageUrl: string;
  assets: QuestionAsset[];
  publishStatus: string;
  visibilityStatus: string;
  scheduledAt: string;
  publishedAt?: string;
  createdAt?: string;
  bancas: QuestionTaxonomyOption[];
  orgaos: QuestionTaxonomyOption[];
  subjects: QuestionTaxonomyOption[];
  assuntos: QuestionTaxonomyOption[];
  topics: QuestionTaxonomyOption[];
  anos: Array<string | number>;
  focos: QuestionTaxonomyOption[];
  focuses: QuestionTaxonomyOption[];
  carreiras: QuestionTaxonomyOption[];
  cargos: QuestionTaxonomyOption[];
  dificuldade: number;
  difficulty: number;
  itens: ManualQuestionItem[];
  resposta: number;
  teacherComment: string;
  detailedComment: string;
  level: string;
  tipo: string;
  modality?: string;
  anulada: boolean;
  desatualizada: boolean;
  text: string;
  agencies: string[];
  years: Array<string | number>;
  roles: QuestionTaxonomyOption[];
  questionOrigin: 'platform' | 'exam' | string;
  question_origin: 'platform' | 'exam' | string;
  grupoQuestao: Partial<GrupoQuestao> | null;
  grupoQuestaoId: number | string | null;
  grupo_questao_id: number | string | null;
  provaId: number | string | null;
  provas: Array<Prova | QuestionTaxonomyRecord>;
  [key: string]: unknown;
}

export type ManualQuestionPatch = Partial<ManualQuestionState>;
export type ManualQuestionSetter = Dispatch<SetStateAction<ManualQuestionState>>;

export const QUESTION_IMAGE_MARKER_PATTERN = /\[image:([^\]\s]+)\]/g;

export const buildQuestionImageMarker = (assetId: string) => `[image:${assetId}]`;

export const insertQuestionImageMarker = (content: string, assetId: string) => {
  const marker = buildQuestionImageMarker(assetId);
  if (content.includes(marker)) {
    return content;
  }

  return [content.trimEnd(), marker].filter(Boolean).join(content.trim() ? '\n\n' : '');
};

export const removeQuestionImageMarker = (content: string, assetId: string) => (
  content
    .replace(new RegExp(`\\n*\\[image:${assetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\n*`, 'g'), '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
);

export const getQuestionAssetMarkerIds = (content: string) => (
  Array.from(content.matchAll(QUESTION_IMAGE_MARKER_PATTERN))
    .map((match) => match[1])
    .filter(Boolean)
);

export const getQuestionAssetsByUsage = (
  assets: QuestionAsset[] | undefined,
  usage: QuestionAssetUsage,
) => (Array.isArray(assets) ? assets.filter((asset) => asset.usage === usage) : []);

export const createQuestionImageAsset = ({
  assets,
  usage,
  url,
  alt,
  label,
}: {
  assets: QuestionAsset[] | undefined;
  usage: QuestionAssetUsage;
  url: string;
  alt: string;
  label?: string;
}): QuestionAsset => {
  const existingAssets = Array.isArray(assets) ? assets : [];
  const normalizedLabel = label ? `_${String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : '';
  const usageAssets = existingAssets.filter((asset) => asset.usage === usage);
  let nextIndex = usageAssets.length + 1;
  let id = `img_${usage}${normalizedLabel}_${nextIndex}`.replace(/_+/g, '_');

  while (existingAssets.some((asset) => asset.id === id)) {
    nextIndex += 1;
    id = `img_${usage}${normalizedLabel}_${nextIndex}`.replace(/_+/g, '_');
  }

  return {
    id,
    type: 'image',
    usage,
    url,
    alt,
    order: existingAssets.length + 1,
  };
};

const QUESTION_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const QUESTION_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const readQuestionImageFileAsDataUrl = (file: File): Promise<string> => {
  if (!QUESTION_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    return Promise.reject(new Error('Use uma imagem JPG, PNG, WebP ou GIF.'));
  }
  if (file.size > QUESTION_IMAGE_MAX_BYTES) {
    return Promise.reject(new Error('A imagem deve ter no maximo 6 MB.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem selecionada.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(result)) {
        reject(new Error('O arquivo selecionado nao e uma imagem valida.'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
};

export const isQuestionTaxonomyRecord = (value: QuestionTaxonomyOption): value is QuestionTaxonomyRecord =>
  Boolean(value) && typeof value === 'object';

export const getRoleDisplayLabel = (value: QuestionTaxonomyOption) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (isQuestionTaxonomyRecord(value)) {
    return String(
      value.descricao
      ?? value['descri\u00e7\u00e3o']
      ?? value.name
      ?? value.nome
      ?? value.sigla
      ?? '',
    ).trim();
  }

  return '';
};

export const getQuestionOptionLabel = (value: QuestionTaxonomyOption) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (isQuestionTaxonomyRecord(value)) {
    return String(
      value.name
      ?? value.nome
      ?? value.descricao
      ?? value['descri\u00e7\u00e3o']
      ?? value.sigla
      ?? value.label
      ?? '',
    ).trim();
  }

  return '';
};

export const mergeProvaSources = (
  primary: Prova[],
  fallback: Array<Prova | QuestionTaxonomyRecord | null | undefined>,
) => {
  const provaMap = new Map<string, Prova>();

  [...primary, ...fallback].forEach((item) => {
    const normalized = normalizeProvaRecord(item);
    if (normalized) {
      provaMap.set(String(normalized.id), normalized);
    }
  });

  return Array.from(provaMap.values()).sort((left, right) => {
    if (right.ano !== left.ano) {
      return right.ano - left.ano;
    }

    return left.nome.localeCompare(right.nome, 'pt-BR');
  });
};
