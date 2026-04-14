export interface RankingListItem {
  id: string;
  name?: string;
  institution?: string;
  totalQuestions?: number;
  vacanciesAc?: number;
  vacanciesAfro?: number;
  vacanciesPcd?: number;
  reserveLimit?: number;
  correctKey?: string;
  keyStatus?: 'official' | 'pending' | string;
  status?: string;
  officialKeyReleaseDate?: string;
  examTypes?: string[];
  hasDiscursive?: boolean;
  entries?: RankingEntry[];
  createdAt?: number | string;
  officialKeyPdfUrl?: string;
  preliminaryKeyPdfUrl?: string;
}

export interface RankingEntry {
  id?: string;
  userId?: string;
  userName?: string;
  registrationNumber?: string;
  examType?: string;
  category?: 'AC' | 'Afro' | 'PCD' | string;
  userAnswers?: string;
  score?: number;
  discursiveScore?: number;
  timestamp?: number | string;
  status?: 'active' | 'eliminated' | 'approved' | string;
}
