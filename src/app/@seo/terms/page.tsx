import PublicInformationSeoSnapshot from '../PublicInformationSeoSnapshot';
import { TERMS_SEO_SECTIONS } from '../../publicInformationContent';

export default function TermsSeoSnapshot() {
  return (
    <PublicInformationSeoSnapshot
      eyebrow="Regras da plataforma"
      title="Termos de Uso"
      description="Consulte as condições para criar uma conta, utilizar os recursos de estudo, contratar planos e interagir com o ConcursoMestre."
      sections={TERMS_SEO_SECTIONS}
      links={[
        { href: '/privacy', label: 'Política de privacidade' },
        { href: '/support', label: 'Central de suporte' },
      ]}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Termos de Uso do ConcursoMestre',
        url: 'https://concursomestre.com/terms',
        inLanguage: 'pt-BR',
      }}
    />
  );
}
