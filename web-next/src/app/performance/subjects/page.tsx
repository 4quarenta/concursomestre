import type { Metadata } from 'next';
import PerformanceSubjectsPageClient from '@/components/performance/PerformanceSubjectsPageClient';

export const metadata: Metadata = {
  title: 'Performance por materia | ConcursoMestre',
  description: 'Acompanhe sua leitura detalhada por materia com acertos, erros e precisao consolidada.',
  alternates: {
    canonical: '/performance/subjects',
  },
};

export default function PerformanceSubjectsPage() {
  return <PerformanceSubjectsPageClient />;
}
