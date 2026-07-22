import PublicInformationSeoSnapshot from '../PublicInformationSeoSnapshot';
import { SUPPORT_SEO_SECTIONS } from '../../publicInformationContent';

export default function SupportSeoSnapshot() {
  return (
    <PublicInformationSeoSnapshot
      eyebrow="Central de atendimento"
      title="Suporte ConcursoMestre"
      description="Relate problemas, envie sugestões, solicite ajuda e acompanhe o atendimento da equipe ConcursoMestre."
      sections={SUPPORT_SEO_SECTIONS}
      links={[
        { href: '/faq', label: 'Consultar dúvidas frequentes' },
        { href: '/privacy', label: 'Política de privacidade' },
      ]}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Suporte ConcursoMestre',
        url: 'https://concursomestre.com/support',
      }}
    />
  );
}
