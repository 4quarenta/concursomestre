'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, BookOpen, ChevronLeft, CreditCard, FileText, Scale, ShieldCheck, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { LEGAL_DOCUMENT_VERSION, LEGAL_EFFECTIVE_DATE } from '@services/legal/legalDocumentVersion';

const TermsOfUse: React.FC = () => {
  const router = useRouter();
  const legalContactEmail = useAppConfigStore((state) => (
    state.systemSettings.legalContactEmail || ''
  )).trim();

  const contactHref = legalContactEmail
    ? `mailto:${legalContactEmail}`
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

        <header className="mb-8 overflow-hidden rounded-3xl bg-indigo-700 p-8 text-white shadow-xl md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck size={14} />
                Regras de utilização
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">Termos de Uso</h1>
              <p className="max-w-2xl text-sm font-medium leading-6 text-indigo-50 md:text-base">
                Estes Termos estabelecem as regras para criação de conta e uso dos recursos do ConcursoMestre,
                incluindo questões, simulados, conteúdos, recursos de IA e funcionalidades vinculadas a planos.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
              <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-100">Última atualização</span>
              <span className="mt-1 block text-sm font-bold">{LEGAL_EFFECTIVE_DATE}</span>
              <span className="mt-1 block text-[10px] font-semibold text-indigo-100">Versão {LEGAL_DOCUMENT_VERSION}</span>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24">
            <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Neste documento</p>
            {[
              ['aceite', '1. Aceite e conta'],
              ['servicos', '2. Serviços'],
              ['conduta', '3. Uso permitido'],
              ['conteudo', '4. Conteúdo e IA'],
              ['planos', '5. Planos e pagamentos'],
              ['cancelamento', '6. Cancelamento'],
              ['propriedade', '7. Propriedade intelectual'],
              ['disponibilidade', '8. Disponibilidade'],
              ['encerramento', '9. Encerramento da conta'],
              ['alteracoes', '10. Alterações e contato'],
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
            <section id="aceite" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={UserCheck} title="1. Aceite e responsabilidade pela conta" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Ao criar uma conta ou utilizar o ConcursoMestre, você declara ter lido estes Termos e a Política de Privacidade e concorda em observar as regras aplicáveis ao serviço. Caso não concorde, não utilize os recursos autenticados da plataforma.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Você é responsável por manter suas credenciais sob controle, fornecer informações verdadeiras e comunicar uso não autorizado da conta quando tomar conhecimento. Não compartilhe senha ou token de acesso com terceiros.
              </p>
            </section>

            <section id="servicos" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={BookOpen} title="2. Serviços do ConcursoMestre" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                A plataforma oferece recursos educacionais que podem incluir banco de questões, filtros, simulados, histórico e estatísticas de estudo, anotações, comentários, materiais, recursos de inteligência artificial, gamificação, marketplace e funcionalidades de conta e assinatura. A disponibilidade de cada recurso pode variar por versão, plano, dispositivo, região ou fase de lançamento.
              </p>
              <Notice>
                O ConcursoMestre é uma ferramenta de apoio ao estudo. A utilização do serviço não representa garantia de aprovação, classificação, convocação ou qualquer resultado específico em concurso, prova ou processo seletivo.
              </Notice>
            </section>

            <section id="conduta" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={ShieldCheck} title="3. Uso permitido e condutas proibidas" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Você pode utilizar o serviço para fins pessoais de estudo e demais usos expressamente disponibilizados pela plataforma. É proibido utilizar o ConcursoMestre para praticar ato ilegal, violar direitos de terceiros, explorar vulnerabilidades, tentar obter acesso não autorizado, burlar limites de plano ou controles de segurança, interferir na disponibilidade do serviço ou automatizar coleta massiva de conteúdo sem autorização.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Conteúdo publicado pelo usuário em áreas colaborativas deve respeitar a legislação, direitos autorais, privacidade e regras de convivência. Podemos moderar, restringir ou remover conteúdo quando necessário para segurança, cumprimento legal ou aplicação destes Termos.
              </p>
            </section>

            <section id="conteudo" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={FileText} title="4. Questões, conteúdos e inteligência artificial" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Empregamos esforços para manter o conteúdo útil e consistente, mas questões, comentários, materiais, explicações, estatísticas ou informações de terceiros podem conter erros, ficar desatualizados ou divergir de fontes oficiais. Quando houver conflito relevante, o edital, a banca, a legislação vigente e a fonte oficial aplicável devem prevalecer.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Recursos de inteligência artificial produzem resultados probabilísticos e podem gerar respostas incorretas, incompletas ou imprecisas. Esses recursos são auxiliares e não substituem conferência em fontes oficiais, orientação profissional ou análise humana quando necessária.
              </p>
            </section>

            <section id="planos" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={CreditCard} title="5. Planos, assinaturas e pagamentos" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                A plataforma pode oferecer recursos gratuitos e recursos vinculados a planos pagos. Preço, período, benefícios, forma de cobrança, renovação e demais condições aplicáveis devem ser apresentados antes da contratação no canal em que a compra estiver disponível.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Pagamentos podem ser processados por terceiros. No canal de distribuição de lojas de aplicativos, a disponibilidade de compra e gerenciamento financeiro observará as regras e mecanismos permitidos pela respectiva loja e região. A ausência de compra dentro do aplicativo não impede que uma conta já elegível utilize benefícios associados ao acesso contratado em canal permitido.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Quando houver renovação automática, ela deve seguir as condições informadas na contratação. Alterações de preço ou condições futuras serão comunicadas ou apresentadas conforme exigido pelo canal de pagamento e pela legislação aplicável.
              </p>
            </section>

            <section id="cancelamento" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={Scale} title="6. Cancelamento, renovação e reembolso" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                O cancelamento de renovação, encerramento de plano e eventual reembolso dependem do tipo de contratação, do estágio da cobrança, do canal de pagamento utilizado e dos direitos assegurados pela legislação aplicável. Compras realizadas por uma loja de aplicativos também podem estar sujeitas aos procedimentos de cobrança e reembolso da própria loja.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Quando o direito de arrependimento ou outro direito de reembolso for aplicável, ele será tratado conforme a legislação de consumo vigente e as características da contratação. Estes Termos não pretendem limitar direitos que não possam ser afastados por contrato.
              </p>
              <Link href="/support?category=info" className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90">
                Falar sobre assinatura ou cobrança
              </Link>
            </section>

            <section id="propriedade" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={FileText} title="7. Propriedade intelectual" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                A marca, identidade visual, software, organização do produto, textos autorais, comentários editoriais e demais conteúdos próprios do ConcursoMestre são protegidos pela legislação aplicável. O acesso ao serviço não transfere ao usuário a titularidade desses elementos nem autoriza reprodução ou exploração comercial fora das permissões expressas da plataforma.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Conteúdos provenientes de bancas, órgãos públicos, legislação, autores, professores, vendedores ou outros terceiros permanecem sujeitos aos respectivos direitos, licenças e regras de uso. Usuários que enviarem conteúdo devem possuir autorização ou base legal adequada para fazê-lo.
              </p>
            </section>

            <section id="disponibilidade" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={AlertCircle} title="8. Disponibilidade e alterações do serviço" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                O serviço pode passar por manutenção, atualizações, indisponibilidades temporárias, alterações de interface, correções, mudanças de fornecedores ou descontinuação de funcionalidades. Buscamos preservar a continuidade do produto, mas não prometemos disponibilidade ininterrupta ou ausência absoluta de falhas.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Quando uma alteração afetar materialmente uma contratação vigente, serão observadas as obrigações legais e contratuais aplicáveis.
              </p>
            </section>

            <section id="encerramento" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={UserCheck} title="9. Encerramento e exclusão da conta" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Você pode solicitar a exclusão da conta pelos mecanismos disponibilizados no aplicativo e na plataforma web. O pedido é registrado para tratamento e pode exigir reautenticação. A eliminação de dados não é necessariamente instantânea e observará as hipóteses de retenção previstas na Política de Privacidade e na legislação aplicável.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                O ConcursoMestre também poderá restringir ou encerrar acesso em caso de fraude, abuso, violação relevante destes Termos, risco de segurança ou obrigação legal, observados os direitos aplicáveis ao usuário.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/account-deletion" className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90">
                  Exclusão de conta
                </Link>
                <Link href="/privacy" className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  Política de Privacidade
                </Link>
              </div>
            </section>

            <section id="alteracoes" className="scroll-mt-24 space-y-5">
              <SectionTitle icon={ShieldCheck} title="10. Alterações destes Termos e contato" />
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Estes Termos podem ser atualizados para refletir mudanças no produto, nas modalidades de contratação, em fornecedores ou na legislação. A versão vigente será publicada nesta página com a data correspondente. Quando necessário, alterações relevantes serão comunicadas por meios adequados.
              </p>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Dúvidas sobre uso, conta, assinatura ou estes Termos podem ser encaminhadas pelo contato jurídico configurado ou pela Central de Suporte.
              </p>
              <a
                href={contactHref}
                className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
              >
                {legalContactEmail ? legalContactEmail : 'Abrir Central de Suporte'}
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
      <Icon size={20} />
    </div>
    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
  </div>
);

const Notice: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
    {children}
  </div>
);

export default TermsOfUse;
