import type { Dispatch, SetStateAction } from 'react';
import type { GrupoQuestao, Prova } from '@types';
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
