'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, Database, Globe2, Lock, Scale, Shield, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

const LAST_UPDATED = '10 de Setembro de 2026';

const PrivacyPolicy: React.FC = () => {
  const router = useRouter();
  const privacyContactEmail = useAppConfigStore((state) => (
    state.systemSettings.privacyContactEmail || ''
  )).trim();

  const contactHref = privacyContactEmail
    ? `mailto:${privacyContactEmail}`
    : '/support?category=info';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 font-sans text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>

        <header className="mb-8 overflow-hidden rounded-3xl bg-emerald-700 p-8 text-white shadow-xl md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                <Shield size={14} />
                Privacidade e proteção de dados
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">Política de Privacidade</h1>
              <p className="max-w-2xl text-sm font-medium leading-6 text-emerald-50 md:text-base">
                Este documento explica quais dados o ConcursoMestre pode tratar, para quais finalidades,
                com quem eles podem ser compartilhados e como você pode exercer seus direitos.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-100">Última atualização</span>
              <span className="mt-1 block text-sm font-bold">{LAST_UPDATED}</span>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24">
            <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Neste documento</p>
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
                className="block rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
              >
                {label}
              </a>
            ))}
          </aside>

          <article className="space-y-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-10">
            <section id="dados" className="scroll-mt-24 space-y-5">
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

            <section id="finalidades" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={Scale} title="2. Finalidades e bases legais" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Tratamos dados para prestar e manter o serviço contratado, autenticar usuários, sincronizar progresso, personalizar a experiência de estudo, processar e conciliar pagamentos, atender suporte, prevenir fraude e abuso, cumprir obrigações legais e melhorar a estabilidade do produto.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Conforme o contexto, o tratamento pode se apoiar na execução de contrato ou de procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse e consentimento quando essa for a base adequada. Quando o consentimento for utilizado, ele poderá ser revogado nos termos da legislação aplicável, sem afetar tratamentos anteriores lícitos.
              </p>
            </section>

            <section id="compartilhamento" className="scroll-mt-24 space-y-5">
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

            <section id="seguranca" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={Lock} title="4. Segurança da informação" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Adotamos medidas técnicas e administrativas compatíveis com a natureza do serviço para reduzir riscos de acesso não autorizado, alteração, perda ou divulgação indevida. Entre as medidas observadas no produto estão autenticação, controle de acesso, armazenamento seguro de sessão no aplicativo, HTTPS nos ambientes distribuíveis e hash de senhas no backend.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Nenhum sistema conectado à internet é absolutamente invulnerável. Por isso, os controles de segurança são revistos e ajustados conforme o produto e a infraestrutura evoluem.
              </p>
            </section>

            <section id="retencao" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={Clock} title="5. Retenção e exclusão" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Mantemos dados pelo período necessário para prestar o serviço, preservar a segurança, manter registros legítimos e cumprir obrigações legais, regulatórias, fiscais, contábeis ou de prevenção à fraude. Os prazos podem variar conforme a categoria do dado e a finalidade do tratamento.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                O usuário pode solicitar a exclusão da própria conta dentro do aplicativo ou pela página pública de exclusão. O pedido é registrado e a conta é marcada para tratamento de exclusão; a eliminação não é necessariamente instantânea. Informações que devam ser conservadas por obrigação legal, exercício regular de direitos, segurança ou prevenção à fraude podem ser mantidas pelo período aplicável e depois eliminadas ou anonimizadas quando cabível.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/account-deletion" className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90">
                  Como excluir minha conta
                </Link>
                <Link href="/profile/security" className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  Abrir segurança da conta
                </Link>
              </div>
            </section>

            <section id="direitos" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={UserCheck} title="6. Seus direitos" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Nos termos da LGPD e conforme aplicável ao caso concreto, você pode solicitar confirmação da existência de tratamento, acesso, correção de dados incompletos ou inexatos, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade nos termos da regulamentação, informação sobre compartilhamentos, revogação do consentimento e revisão de decisões tomadas unicamente com base em tratamento automatizado quando cabível.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Algumas solicitações podem exigir validação de identidade e podem estar sujeitas às hipóteses legais de conservação de dados.
              </p>
            </section>

            <section id="internacional" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={Globe2} title="7. Transferências internacionais" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Alguns prestadores de infraestrutura, pagamento, autenticação ou inteligência artificial podem processar dados em outros países. Quando isso ocorrer, o tratamento deverá observar os mecanismos e salvaguardas aplicáveis à transferência internacional de dados.
              </p>
            </section>

            <section id="alteracoes" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={Shield} title="8. Alterações e contato" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Esta Política pode ser atualizada para refletir mudanças no produto, em fornecedores, na legislação ou nas práticas de tratamento. Alterações relevantes serão publicadas nesta página com a data de atualização correspondente.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Para dúvidas ou solicitações relacionadas a privacidade e proteção de dados, utilize o contato configurado pela plataforma ou a Central de Suporte.
              </p>
              <a
                href={contactHref}
                className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
      <Icon size={20} />
    </div>
    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
  </div>
);

type InfoGridProps = {
  items: Array<{ title: string; text: string }>;
};

const InfoGrid: React.FC<InfoGridProps> = ({ items }) => (
  <div className="grid gap-4 md:grid-cols-2">
    {items.map((item) => (
      <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
        <h3 className="mb-2 text-sm font-black text-slate-900 dark:text-white">{item.title}</h3>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
      </div>
    ))}
  </div>
);

const Notice: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
    {children}
  </div>
);

export default PrivacyPolicy;
