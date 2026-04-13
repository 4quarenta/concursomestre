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

export interface Question {
  id?: number;
  enunciado?: string;
  enunciado_clean?: string;
  itens?: QuestionItem[];
  resposta?: number;
  dificuldade?: number;
  assuntos?: QuestionSubject[];
}

export interface UserAnswerInput {
  questionId: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timeTaken?: number;
}
