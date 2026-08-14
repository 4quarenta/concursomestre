import PublicInformationSeoSnapshot from '../PublicInformationSeoSnapshot';
import { buildSiteUrl } from '@/config/siteUrl';
import { publicRoutes } from '@services/routes/publicRoutes';

export default function PracticeSeoPage() {
  return (
    <PublicInformationSeoSnapshot
      eyebrow="Banco de questoes"
      title="Questoes de concursos para praticar"
      description="Resolva questoes organizadas por banca, disciplina, assunto, cargo e ano."
      sections={[
        {
          title: 'Estudo direcionado',
          paragraphs: [
            'Use os filtros para montar uma lista coerente com a prova, o cargo e os assuntos que voce esta estudando.',
          ],
        },
      ]}
      links={[
        { href: '/disciplinas', label: 'Explorar disciplinas' },
        { href: '/bancas', label: 'Explorar bancas' },
        { href: publicRoutes.exams.index(), label: 'Consultar provas' },
      ]}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Questoes de concursos para praticar',
        description: 'Banco de questoes organizado por banca, disciplina, assunto, cargo e ano.',
        url: buildSiteUrl(publicRoutes.questions.index()),
      }}
    />
  );
}
