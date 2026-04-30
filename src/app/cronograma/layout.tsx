import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cronograma de estudos',
  description: 'Crie um plano de estudos semanal com matérias, prioridades, revisões e metas de questões.',
  alternates: {
    canonical: '/cronograma',
  },
};

export default function CronogramaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
