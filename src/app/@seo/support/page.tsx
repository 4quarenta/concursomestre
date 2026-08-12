import PublicInformationSeoSnapshot from '../PublicInformationSeoSnapshot';

export default function SupportSeoPage() {
  return (
    <PublicInformationSeoSnapshot
      eyebrow="Atendimento"
      title="Suporte ConcursoMestre"
      description="Relate problemas, envie sugestoes e encontre os canais de atendimento da plataforma."
      sections={[]}
      links={[
        { href: '/faq', label: 'Perguntas frequentes' },
        { href: '/novidades', label: 'Novidades da plataforma' },
      ]}
    />
  );
}
