import PublicInformationSeoSnapshot from '../PublicInformationSeoSnapshot';
import { PRIVACY_SEO_SECTIONS } from '../../publicInformationContent';

export default function PrivacySeoSnapshot() {
  return (
    <PublicInformationSeoSnapshot
      eyebrow="Privacidade e segurança"
      title="Política de Privacidade"
      description="Entenda como o ConcursoMestre coleta, utiliza, protege e compartilha dados pessoais e conheça seus direitos previstos na LGPD."
      sections={PRIVACY_SEO_SECTIONS}
      links={[
        { href: '/terms', label: 'Termos de uso' },
        { href: '/support', label: 'Falar com o suporte' },
      ]}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Política de Privacidade do ConcursoMestre',
        url: 'https://concursomestre.com/privacy',
        inLanguage: 'pt-BR',
      }}
    />
  );
}
