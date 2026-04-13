export interface SubjectStatistics {
  subject: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracyRate: number;
}

export interface UserStatistics {
  userId: string;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracyRate: number;
  currentStreak: number;
  bestStreak: number;
  questionStudyTime: number;
  readingStudyTime: number;
  totalStudyTime: number;
  lastActivity: string;
  subjectBreakdown: SubjectStatistics[];
}
