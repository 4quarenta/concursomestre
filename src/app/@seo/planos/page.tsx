import PublicInformationSeoSnapshot from '../PublicInformationSeoSnapshot';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildSiteUrl } from '@/config/siteUrl';

export default function PlansSeoSnapshot() {
  return (
    <PublicInformationSeoSnapshot
      eyebrow="Planos"
      title="Planos do ConcursoMestre"
      description="Compare os planos e escolha os recursos adequados para sua rotina de estudos."
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Planos do ConcursoMestre',
        description: 'Compare os planos e escolha os recursos adequados para sua rotina de estudos.',
        url: buildSiteUrl('/planos'),
      }}
      sections={[
        {
          title: 'Estude no seu ritmo',
          paragraphs: ['A plataforma oferece opções para começar gratuitamente e ampliar os recursos conforme sua preparação evolui.'],
        },
      ]}
      links={[{ href: publicRoutes.questions.index(), label: 'Conhecer as questões' }]}
    />
  );
}
