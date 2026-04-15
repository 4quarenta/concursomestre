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
  resposta?: number;
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

export interface UserAnswerInput {
  questionId: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timeTaken?: number;
}
