import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Cronograma de estudos',
  description: 'Crie um plano de estudos semanal com matérias, prioridades, revisões e metas de questões.',
});

export default function CronogramaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
