export interface Material {
  id: string;
  title: string;
  description?: string;
  details?: string;
  authorId?: string;
  authorName?: string;
  price: number;
  type?: 'PDF' | 'Simulado' | 'Resumo' | string;
  subject?: string;
  subjectText?: string;
  topic?: string;
  salesCount?: number;
  rating?: number;
  createdAt?: number | string;
  coverUrl?: string;
  fileUrl?: string;
  pdfPassword?: string;
  status?: string;
}
