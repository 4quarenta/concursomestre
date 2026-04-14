export interface QuestionNote {
  id: string;
  questionId: number;
  text: string;
  timestamp: number;
  remoteId?: string | null;
  source?: 'remote' | 'local' | 'local_override';
}
