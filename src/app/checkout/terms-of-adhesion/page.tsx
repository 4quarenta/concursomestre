'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronLeft, CreditCard, FileText, Lock, RefreshCcw, RotateCcw, Scale, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

const sections = [
  { id: 'adesao', icon: BadgeCheck, label: '1. Adesão ao plano' },
  { id: 'cobranca', icon: CreditCard, label: '2. Cobrança e pagamento' },
  { id: 'renovacao', icon: RefreshCcw, label: '3. Renovação automática' },
  { id: 'cancelamento', icon: RotateCcw, label: '4. Cancelamento e reembolso' },
  { id: 'acesso', icon: Lock, label: '5. Acesso e segurança' },
  { id: 'disposicoes', icon: Scale, label: '6. Disposições finais' },
];

const CheckoutAdhesionTermsPage: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('adesao');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' },
    );

    const observedSections = document.querySelectorAll('section[id]');
    observedSections.forEach((section) => observer.observe(section));

    return () => observedSections.forEach((section) => observer.unobserve(section));
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    const top = element.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 font-sans transition-colors dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="group mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-all hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-1.5 text-inherit shadow-sm transition-all group-hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:border-indigo-900">
            <ChevronLeft size={16} />
          </div>
          Voltar
        </button>

        <div className="relative mb-8 overflow-hidden rounded-[2.5rem] bg-slate-950 p-10 shadow-2xl dark:bg-indigo-950/70 md:p-16">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-emerald-500/20 opacity-80" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl space-y-4 text-white">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-100 shadow-sm backdrop-blur-md">
                <ShieldCheck size={14} />
                Checkout e assinatura
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">Termos de adesão</h1>
              <p className="text-sm font-medium leading-relaxed text-slate-200 md:text-base">
                Condições aplicáveis à contratação de planos pagos, renovação automática, cancelamento e uso dos recursos premium do ConcursoMestre.
              </p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/10 px-6 py-4 text-left backdrop-blur-lg md:text-right">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-indigo-100">Última atualização</span>
              <span className="block text-lg font-bold text-white">10 de abril de 2026</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
            <div className="space-y-1 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 ml-2 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Sumário</h2>
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition-all ${
                    activeTab === item.id
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                  }`}
                >
                  <item.icon size={16} className={activeTab === item.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-400'} />
                  {item.label}
                  {activeTab === item.id && <ArrowRight size={14} className="ml-auto opacity-50" />}
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 md:p-12">
            <div className="prose prose-slate max-w-none text-slate-600 transition-colors dark:prose-invert dark:text-slate-300">
              <section id="adesao" className="mb-16 scroll-mt-24">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600 dark:border-indigo-800/30 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <BadgeCheck size={24} />
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">1. Adesão ao plano</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed md:text-base">
                  <p>
                    Estes Termos de adesão regulam a contratação de planos pagos do <strong>ConcursoMestre</strong>. Ao concluir o checkout, o usuário declara que leu, compreendeu e aceitou as condições de assinatura apresentadas na tela de pagamento.
                  </p>
                  <p>
                    O plano contratado, o valor, a periodicidade, os benefícios ativos e eventuais descontos são exibidos antes da confirmação da compra. A contratação depende da aprovação do pagamento pelo provedor financeiro integrado à plataforma.
                  </p>
                </div>
              </section>

              <div className="my-12 h-px w-full bg-slate-100 dark:bg-slate-800" />

              <section id="cobranca" className="mb-16 scroll-mt-24">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CreditCard size={24} />
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">2. Cobrança e pagamento</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed md:text-base">
                  <p>
                    A cobrança é realizada de acordo com o ciclo escolhido no momento da compra, podendo envolver pagamento mensal, trimestral, anual ou outra periodicidade disponibilizada oficialmente pela plataforma.
                  </p>
                  <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/50">
                    <h3 className="m-0 mb-4 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Pontos essenciais</h3>
                    <ul className="m-0 space-y-3 pl-5 text-sm font-medium">
                      <li>O valor final exibido no checkout considera descontos, créditos e condições promocionais válidas naquele momento.</li>
                      <li>Dados de cartão são processados pelo gateway de pagamento e não ficam armazenados em texto puro pelo ConcursoMestre.</li>
                      <li>A liberação dos recursos pagos ocorre após confirmação financeira e sincronização do status da assinatura.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <div className="my-12 h-px w-full bg-slate-100 dark:bg-slate-800" />

              <section id="renovacao" className="mb-16 scroll-mt-24">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-600 dark:border-sky-800/30 dark:bg-sky-900/30 dark:text-sky-400">
                    <RefreshCcw size={24} />
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">3. Renovação automática</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed md:text-base">
                  <p>
                    Quando a renovação automática estiver ativa, o usuário autoriza a cobrança recorrente no cartão de crédito informado para manter a continuidade do acesso ao plano contratado.
                  </p>
                  <p>
                    A renovação pode ser cancelada pelo próprio usuário nas configurações de assinatura, observadas as regras operacionais do plano e o prazo do ciclo vigente. O cancelamento da renovação não altera cobranças já confirmadas para períodos anteriores.
                  </p>
                </div>
              </section>

              <div className="my-12 h-px w-full bg-slate-100 dark:bg-slate-800" />

              <section id="cancelamento" className="mb-16 scroll-mt-24">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-600 dark:border-amber-800/30 dark:bg-amber-900/30 dark:text-amber-400">
                    <RotateCcw size={24} />
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">4. Cancelamento e reembolso</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed md:text-base">
                  <p>
                    O usuário pode solicitar cancelamento da renovação automática a qualquer momento pelos canais disponibilizados na plataforma. O acesso aos recursos pagos tende a permanecer ativo até o fim do período já contratado, salvo hipóteses de fraude, abuso ou descumprimento dos Termos de Uso.
                  </p>
                  <p>
                    Em caso de arrependimento, o usuário pode solicitar reembolso em até 7 dias corridos após a contratação, conforme política operacional exibida no checkout e regras legais aplicáveis. A análise de reembolso considera a transação, o status da assinatura e eventuais usos indevidos.
                  </p>
                </div>
              </section>

              <div className="my-12 h-px w-full bg-slate-100 dark:bg-slate-800" />

              <section id="acesso" className="mb-16 scroll-mt-24">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-rose-600 dark:border-rose-800/30 dark:bg-rose-900/30 dark:text-rose-400">
                    <Lock size={24} />
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">5. Acesso e segurança</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed md:text-base">
                  <p>
                    O acesso aos recursos pagos é pessoal, vinculado à conta do usuário e não deve ser compartilhado com terceiros. A plataforma pode aplicar medidas de segurança quando identificar uso incompatível, fraude, tentativa de burlar limites ou violação de regras.
                  </p>
                  <p>
                    O usuário é responsável por manter seus dados de acesso protegidos e por revisar informações de pagamento, assinatura e renovação na área de perfil.
                  </p>
                </div>
              </section>

              <div className="my-12 h-px w-full bg-slate-100 dark:bg-slate-800" />

              <section id="disposicoes" className="scroll-mt-24">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <FileText size={24} />
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900 dark:text-slate-100">6. Disposições finais</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed md:text-base">
                  <p>
                    Estes Termos de adesão complementam os Termos de Uso e a Política de Privacidade do ConcursoMestre. Em caso de conflito, prevalecem as condições específicas apresentadas no checkout para o plano contratado, desde que compatíveis com a legislação aplicável.
                  </p>
                  <p>
                    Dúvidas sobre assinatura, cobrança, cancelamento ou reembolso podem ser tratadas pelos canais oficiais de suporte da plataforma.
                  </p>
                </div>
              </section>

              <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-10 dark:border-slate-800 md:flex-row">
                <div className="text-center text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 md:text-left">
                  Precisa de suporte sobre assinatura?
                </div>
                <a
                  href="mailto:suporte@concursomestre.ai"
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 dark:bg-white dark:text-slate-900"
                >
                  suporte@concursomestre.ai <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CheckoutAdhesionTermsPage;
