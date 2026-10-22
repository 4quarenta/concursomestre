'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Database, Globe2, Lock, Scale, Shield, UserCheck } from 'lucide-react';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { PRIVACY_POLICY_EFFECTIVE_DATE, PRIVACY_POLICY_VERSION } from '@services/legal/legalDocumentVersion';

const PrivacyPolicy: React.FC = () => {
  const privacyContactEmail = useAppConfigStore((state) => (
    state.systemSettings.privacyContactEmail || ''
  )).trim();

  const contactHref = privacyContactEmail
    ? `mailto:${privacyContactEmail}`
    : '/support?category=info';

  return (
    <main className="w-full space-y-5 pb-8 font-sans text-slate-900 transition-colors dark:text-slate-100">
      <div className="space-y-5">
        <PlatformPageHeader
          title="Política de Privacidade"
          eyebrow="Privacidade e proteção de dados"
          breadcrumbs={[{ label: 'Início', path: '/' }, { label: 'Política de Privacidade', path: '/privacy' }]}
          description={(
            <>Este documento explica quais dados o ConcursoMestre pode tratar, para quais finalidades, com quem eles podem ser compartilhados e como você pode exercer seus direitos.</>
          )}
          className="border-b border-slate-200 pb-5 dark:border-slate-800"
          actions={(
            <div className="shrink-0 text-left text-xs text-slate-500 sm:text-right dark:text-slate-400">
            <span className="block">Atualizado em {PRIVACY_POLICY_EFFECTIVE_DATE}</span>
            <span className="mt-1 block font-semibold">Versão {PRIVACY_POLICY_VERSION}</span>
            </div>
          )}
        />

        <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-3 dark:border-slate-800" aria-label="Documentos legais">
          <Link href="/terms" className="inline-flex h-9 shrink-0 items-center rounded-md px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900">Termos de Uso</Link>
          <Link href="/privacy" aria-current="page" className="inline-flex h-9 shrink-0 items-center rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white">Política de Privacidade</Link>
        </nav>

        <div className="max-w-4xl">
          <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-2" aria-label="Seções da Política de Privacidade">
            <span className="sr-only">Neste documento</span>
            {[
              ['dados', '1. Dados tratados'],
              ['finalidades', '2. Finalidades e bases'],
              ['compartilhamento', '3. Compartilhamento'],
              ['seguranca', '4. Segurança'],
              ['retencao', '5. Retenção e exclusão'],
              ['direitos', '6. Seus direitos'],
              ['internacional', '7. Transferências'],
              ['alteracoes', '8. Alterações e contato'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-indigo-700 dark:text-slate-400 dark:decoration-slate-700 dark:hover:text-indigo-300"
              >
                {label}
              </a>
            ))}
          </nav>

          <article className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            <section id="dados" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Database} title="1. Dados que podemos tratar" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Os dados efetivamente tratados dependem dos recursos que você utiliza. O ConcursoMestre pode tratar as seguintes categorias:
              </p>
              <InfoGrid
                items={[
                  {
                    title: 'Conta e identificação',
                    text: 'Nome, e-mail, identificador interno, foto de perfil e outros dados de perfil que você forneça. Em autenticação social, também podem existir identificadores do provedor vinculado à conta.',
                  },
                  {
                    title: 'Estudo e uso da plataforma',
                    text: 'Questões respondidas, alternativas enviadas, acertos e erros, filtros de estudo, simulados, tempo e histórico de uso, notas, comentários, favoritos, XP, nível e estatísticas de desempenho.',
                  },
                  {
                    title: 'Assinaturas e transações',
                    text: 'Plano, status e período da assinatura, histórico de transações, valores, situação de pagamento e identificadores fornecidos pelo processador de pagamento. Dados financeiros adicionais podem ser necessários em fluxos de marketplace ou obrigações fiscais.',
                  },
                  {
                    title: 'Suporte e solicitações',
                    text: 'Conteúdo enviado em chamados, sugestões, reclamações e o motivo informado em pedidos de exclusão de conta.',
                  },
                  {
                    title: 'Dados técnicos e de segurança',
                    text: 'Podem ser tratados endereço IP, data e hora de acesso, user-agent, registros de autenticação e informações técnicas necessárias para segurança, prevenção de abuso, diagnóstico e operação do serviço.',
                  },
                  {
                    title: 'Recursos de inteligência artificial',
                    text: 'Quando você utiliza um recurso de IA, o conteúdo necessário para processar sua solicitação pode ser enviado ao provedor responsável por executar o modelo, de acordo com a configuração vigente do serviço.',
                  },
                ]}
              />
              <Notice>
                Senhas são armazenadas pelo backend em formato de hash. Os fluxos atuais de pagamento usam integração tokenizada/provida por terceiros; o ConcursoMestre pode manter identificadores e metadados de cobrança necessários para conciliação, suporte e histórico da conta.
              </Notice>
            </section>

            <section id="finalidades" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Scale} title="2. Finalidades e bases legais" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Tratamos dados para prestar e manter o serviço contratado, autenticar usuários, sincronizar progresso, personalizar a experiência de estudo, processar e conciliar pagamentos, atender suporte, prevenir fraude e abuso, cumprir obrigações legais e melhorar a estabilidade do produto.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Conforme o contexto, o tratamento pode se apoiar na execução de contrato ou de procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse e consentimento quando essa for a base adequada. Quando o consentimento for utilizado, ele poderá ser revogado nos termos da legislação aplicável, sem afetar tratamentos anteriores lícitos.
              </p>
            </section>

            <section id="compartilhamento" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Globe2} title="3. Compartilhamento com terceiros" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Não vendemos dados pessoais. Podemos compartilhar apenas as informações necessárias com prestadores que participam da operação do serviço, como infraestrutura e hospedagem, processadores de pagamento, serviços de e-mail, autenticação, segurança e provedores de inteligência artificial quando o recurso correspondente for utilizado.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Também poderemos tratar ou fornecer informações quando necessário para cumprir obrigação legal, ordem válida de autoridade competente, exercer ou defender direitos, investigar fraude ou proteger a segurança de usuários e da plataforma.
              </p>
              <Notice>
                A identidade dos provedores pode mudar ao longo da evolução técnica do produto. A Política deve ser interpretada junto aos fluxos efetivamente disponíveis e às informações apresentadas no momento da contratação ou utilização de cada recurso.
              </Notice>
            </section>

            <section id="seguranca" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Lock} title="4. Segurança da informação" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Adotamos medidas técnicas e administrativas compatíveis com a natureza do serviço para reduzir riscos de acesso não autorizado, alteração, perda ou divulgação indevida. Entre as medidas observadas no produto estão autenticação, controle de acesso, armazenamento seguro de sessão no aplicativo, HTTPS nos ambientes distribuíveis e hash de senhas no backend.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Nenhum sistema conectado à internet é absolutamente invulnerável. Por isso, os controles de segurança são revistos e ajustados conforme o produto e a infraestrutura evoluem.
              </p>
            </section>

            <section id="retencao" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Clock} title="5. Retenção e exclusão" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Mantemos dados pelo período necessário para prestar o serviço, preservar a segurança, manter registros legítimos e cumprir obrigações legais, regulatórias, fiscais, contábeis ou de prevenção à fraude. Os prazos podem variar conforme a categoria do dado e a finalidade do tratamento.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                O usuário pode solicitar a exclusão da própria conta dentro do aplicativo ou pela página pública de exclusão. O pedido é registrado e a conta é marcada para tratamento de exclusão; a eliminação não é necessariamente instantânea. Informações que devam ser conservadas por obrigação legal, exercício regular de direitos, segurança ou prevenção à fraude podem ser mantidas pelo período aplicável e depois eliminadas ou anonimizadas quando cabível.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/account-deletion" className="inline-flex min-h-9 items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700">
                  Como excluir minha conta
                </Link>
                <Link href="/profile/security" className="inline-flex min-h-9 items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Abrir segurança da conta
                </Link>
              </div>
            </section>

            <section id="direitos" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={UserCheck} title="6. Seus direitos" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Nos termos da LGPD e conforme aplicável ao caso concreto, você pode solicitar confirmação da existência de tratamento, acesso, correção de dados incompletos ou inexatos, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade nos termos da regulamentação, informação sobre compartilhamentos, revogação do consentimento e revisão de decisões tomadas unicamente com base em tratamento automatizado quando cabível.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Algumas solicitações podem exigir validação de identidade e podem estar sujeitas às hipóteses legais de conservação de dados.
              </p>
            </section>

            <section id="internacional" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Globe2} title="7. Transferências internacionais" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Alguns prestadores de infraestrutura, pagamento, autenticação ou inteligência artificial podem processar dados em outros países. Quando isso ocorrer, o tratamento deverá observar os mecanismos e salvaguardas aplicáveis à transferência internacional de dados.
              </p>
            </section>

            <section id="alteracoes" className="scroll-mt-24 space-y-4 py-6">
              <SectionTitle icon={Shield} title="8. Alterações e contato" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Esta Política pode ser atualizada para refletir mudanças no produto, em fornecedores, na legislação ou nas práticas de tratamento. Alterações relevantes serão publicadas nesta página com a data de atualização correspondente.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Para dúvidas ou solicitações relacionadas a privacidade e proteção de dados, utilize o contato configurado pela plataforma ou a Central de Suporte.
              </p>
              <a
                href={contactHref}
                className="inline-flex min-h-9 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {privacyContactEmail ? privacyContactEmail : 'Abrir Central de Suporte'}
              </a>
            </section>
          </article>
        </div>
      </div>
    </main>
  );
};

type SectionTitleProps = {
  icon: React.ElementType;
  title: string;
};

const SectionTitle: React.FC<SectionTitleProps> = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
      <Icon size={16} />
    </div>
    <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
  </div>
);

type InfoGridProps = {
  items: Array<{ title: string; text: string }>;
};

const InfoGrid: React.FC<InfoGridProps> = ({ items }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {items.map((item) => (
      <div key={item.title} className="border-l-2 border-slate-300 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
        <h3 className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
      </div>
    ))}
  </div>
);

const Notice: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="border-l-2 border-amber-500 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
    {children}
  </div>
);

export default PrivacyPolicy;
