export interface QuestionComment {
  id: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  userPlan?: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite' | string;
  userRole?: string;
  userHasPendingReport?: boolean;
  text: string;
  date?: string;
  likes: number;
  isLiked?: boolean;
  parentId?: string;
  replies: QuestionComment[];
}
