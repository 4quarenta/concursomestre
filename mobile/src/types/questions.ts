import type { QuestionComment } from '@/types/comments';

export interface QuestionItem {
  id?: number;
  ordem?: number;
  rotulo?: string;
  corpo?: string;
  corpo_clean?: string;
}

export interface QuestionSubject {
  id?: number;
  nome?: string;
  materia?: boolean;
}

export interface QuestionAgency {
  id?: number;
  nome?: string;
  sigla?: string;
}

export interface QuestionOrganization {
  id?: number;
  nome?: string;
  sigla?: string;
}

export interface QuestionRole {
  id?: number;
  nome?: string;
  descricao?: string;
  ['descrição']?: string;
}

export interface QuestionUserAnswer {
  questionId?: number;
  selectedOptionIndex?: number;
  isCorrect?: boolean;
  timestamp?: number;
}

export interface QuestionStats {
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  optionDistribution?: Record<string, number>;
}

export interface QuestionHistoryEntry {
  questionId: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timestamp: number;
}

export interface Question {
  id?: number;
  enunciado?: string;
  enunciado_clean?: string;
  itens?: QuestionItem[];
  /**
   * Campos de gabarito existem somente em respostas ja liberadas/revisao.
   * A listagem de uma questao ainda nao respondida nao deve expo-los.
   */
  resposta?: number;
  correctOptionIndex?: number;
  dificuldade?: number;
  assuntos?: QuestionSubject[];
  bancas?: QuestionAgency[];
  orgaos?: QuestionOrganization[];
  cargos?: QuestionRole[];
  anos?: Array<number | string>;
  hasTeacherComment?: boolean;
  hasDetailedComment?: boolean;
  teacherComment?: string | null;
  detailedComment?: string | null;
  userAnswer?: QuestionUserAnswer | null;
  stats?: QuestionStats | null;
  comments?: QuestionComment[] | null;
  commentsCount?: number;
}

export interface QuestionListFilters {
  keyword?: string;
  subject?: string | string[];
  topic?: string | string[];
  difficulty?: string | string[];
  agency?: string | string[];
  organization?: string | string[];
  year?: string | number | Array<string | number>;
  level?: string | string[];
  role?: string | string[];
  career?: string | string[];
  modality?: string | string[];
  questionIds?: Array<string | number>;
  onlySaved?: boolean;
  hasTeacherComment?: boolean;
  hasDetailedComment?: boolean;
  excludeCanceled?: boolean;
  excludeOutdated?: boolean;
  excludeAnswered?: boolean;
}

export interface QuestionPageResult {
  rows: Question[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface UserAnswerInput {
  questionId: number;
  selectedOptionIndex: number;
  timeTaken?: number;
  /**
   * Compatibilidade temporaria com a tela legada. O service nao envia esse
   * valor e o backend nunca deve confiar nele para pontuacao ou estatisticas.
   */
  isCorrect?: boolean;
}

export interface QuestionAnswerResult {
  success: boolean;
  message?: string;
  newXp?: number;
  newLevel?: number;
  isCorrect?: boolean;
  correctOptionIndex?: number;
}
