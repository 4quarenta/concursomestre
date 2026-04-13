export interface Material {
  id: string;
  title: string;
  description?: string;
  authorId?: string;
  authorName?: string;
  price: number;
  type?: 'PDF' | 'Simulado' | 'Resumo' | string;
  subject?: string;
  salesCount?: number;
  rating?: number;
  createdAt?: number | string;
  coverUrl?: string;
  status?: string;
}
