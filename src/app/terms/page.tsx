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

import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Scale, AlertCircle, ChevronLeft, ArrowRight, CheckCircle2, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TermsOfUse: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('aceite');

  // Highlighting intersection observer logic for beautiful scroll-spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );

    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => sections.forEach((section) => observer.unobserve(section));
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors relative">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs uppercase tracking-widest mb-8 transition-all"
        >
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-indigo-200 dark:group-hover:border-indigo-900 shadow-sm transition-all text-inherit">
            <ChevronLeft size={16} />
          </div>
          Voltar
        </button>

        {/* Hero Section */}
        <div className="relative rounded-2xl bg-indigo-600 dark:bg-indigo-900/50 p-10 md:p-16 mb-8 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 blur-3xl opacity-50 dark:opacity-30 mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-4 max-w-2xl text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                <ShieldCheck size={14} className="text-indigo-200" />
                Documento Legal
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Termos de Uso</h1>
              <p className="text-indigo-100 text-sm md:text-base font-medium opacity-90 leading-relaxed">
                Os Termos e Condições que regem o uso da plataforma ConcursoMestre. Leia com atenção para entender nossas diretrizes e o seu papel na comunidade.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 px-6 py-4 rounded-2xl text-right">
              <span className="block text-[10px] uppercase font-black tracking-widest text-indigo-200 mb-1">Última Atualização</span>
              <span className="block text-lg font-bold text-white">24 de Maio de 2024</span>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Sidebar Navigation */}
          <div className="lg:sticky lg:top-24 w-full lg:w-72 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 ml-2 mt-2">Sumário</h3>

              {[
                { id: 'aceite', icon: ShieldCheck, label: '1. Aceite dos Termos' },
                { id: 'regras', icon: BookOpen, label: '2. Regras de Conduta' },
                { id: 'serviços', icon: FileText, label: '3. Nossos Serviços' },
                { id: 'assinaturas', icon: Scale, label: '4. Planos e Assinaturas' },
                { id: 'responsabilidade', icon: AlertCircle, label: '5. Responsabilidades' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left group ${activeTab === item.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <item.icon size={16} className={`transition-all ${activeTab === item.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                  {item.label}
                  {activeTab === item.id && <ArrowRight size={14} className="ml-auto opacity-50" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Areas */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 md:p-12 transition-colors">
            <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed transition-colors">

              <section id="aceite" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 m-0">1. Aceite dos Termos</h2>
                </div>
                <div className="space-y-4">
                  <p className="text-sm md:text-base">
                    Ao acessar e utilizar a plataforma <strong>ConcursoMestre</strong>, você concorda de forma irrevogável e irretratável em cumprir e estar vinculado aos presentes Termos de Uso. Este documento de caráter legal estabelece as obrigações que devem ser cumpridas entre você (o Usuário) e a ConcursoMestre.
                  </p>
                  <p className="text-sm md:text-base">
                    Caso você não concorde com qualquer aspecto ou cláusula descrita nestes termos, você deve abster-se imediatamente do uso de nossos serviços, excluindo sua conta ou solicitando a remoção de seus dados.
                  </p>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="regras" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400">
                    <BookOpen size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 m-0">2. Regras de Conduta</h2>
                </div>
                <p className="text-sm md:text-base mb-6">
                  Esperamos que os nossos usuários mantenham um ambiente comunitário focado, educado e pautado pelo respeito mútuo. Sendo assim, é expressamente proibido:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    "Publicar conteúdo discriminatório, abusivo ou ilegal nos cadernos ou fóruns.",
                    "Realizar vendas de materiais de terceiros no Marketplace sem a devida autorização/licença dos detentores legais.",
                    "Criar de forma automatizada (bots/crawlers) inúmeras requisições para raspar conteúdo da plataforma sem autorização expressa.",
                    "Tentar burlar os controles de assinatura, contadores de uso da IA ou medidas de segurança."
                  ].map((rule, idx) => (
                    <div key={idx} className="flex gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                      <CheckCircle2 size={18} className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{rule}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="serviços" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-sky-50 dark:bg-sky-900/30 rounded-2xl border border-sky-100 dark:border-sky-800/30 text-sky-600 dark:text-sky-400">
                    <FileText size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 m-0">3. Nossos Serviços e Aplicações IA</h2>
                </div>
                <div className="space-y-4 text-sm md:text-base">
                  <p>
                    A ConcursoMestre é dotada de funcionalidades orientadas por modelos de Inteligência Artificial para facilitar seus momentos de estudo: resoluções passo a passo, resumos automáticos e análise de perfil preditiva.
                  </p>

                  <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-6">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4">Atenção Especial</h4>
                    <ul className="list-disc pl-5 space-y-3 font-medium text-slate-600 dark:text-slate-400">
                      <li><strong>Natureza Probabilística:</strong> Modelos geradores de linguagem (IA) podem alucinar (produzir dados incorretos). Nossas explicações geradas devem servir apenas de apoio. O gabarito oficial da banca é incontestável.</li>
                      <li><strong>Ferramentas de Marketplace:</strong> Fornecemos espaço digital para compartilhamento de PDFs e Vedações. A validade do material é de responsabilidade do vendedor criador do conteúdo.</li>
                      <li><strong>Atualizações e Melhorias:</strong> Modificamos nossos algoritmos regularmente. Modelos e interfaces podem sofrer alterações drásticas visando aprimoramento da performance e UX.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="assinaturas" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl border border-amber-100 dark:border-amber-800/30 text-amber-600 dark:text-amber-400">
                    <Scale size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 m-0">4. Planos, Assinaturas e Estornos</h2>
                </div>
                <div className="space-y-4 text-sm md:text-base">
                  <p>
                    Conosco, você pode estudar de forma gratuita ou pagando um plano Premium, usufruindo de benefícios exclusivos como perguntas ilimitadas à IA Mestre, Raio-X avançado e ausência de limites diários de resolução.
                  </p>

                  <div className="overflow-x-auto ring-1 ring-slate-200 dark:ring-slate-800 rounded-2xl mt-6">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Tópico</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Diretriz</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900 dark:text-white">Renovação</td>
                          <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">Renovações são automáticas ao fim do ciclo atual para evitar descontinuidade no seu cronograma de estudos. Pode ser cancelada a qualquer momento.</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-900 dark:text-white">Estornos / Cancelamento</td>
                          <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">De acordo com o CDC (Código de Defesa do Consumidor), você tem até 7 dias corridos contados da primeira assinatura para exigir reembolso integral em caso de arrependimento.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="responsabilidade" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-2xl border border-red-100 dark:border-red-800/30 text-red-600 dark:text-red-400">
                    <AlertCircle size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 m-0">5. Limitação de Responsabilidade</h2>
                </div>
                <p className="text-sm md:text-base mb-6">
                  Esforçamo-nos para manter a estabilidade de sistema (uptime de 99%), porém o ConcursoMestre não é civil ou materialmente responsável caso danos ocorram decorrentes de:
                </p>

                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-red-200 dark:hover:border-red-900/50">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 font-black text-xs text-slate-500">1</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Falta de aprovação do usuário na prova real, uma vez que aprovações baseiam-se numa gama enorme de variáveis para as quais nossa ferramenta funciona apenas como elemento acessório facilitador e orientador metodológico.</p>
                  </div>
                  <div className="flex gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-red-200 dark:hover:border-red-900/50">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 font-black text-xs text-slate-500">2</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Interrupções e manutenções repentinas e emergenciais das nossas APIs. Quedas prolongadas geram bônus de dias para assinantes, sempre que superada a margem crítica técnica tolerável.</p>
                  </div>
                  <div className="flex gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-red-200 dark:hover:border-red-900/50">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 font-black text-xs text-slate-500">3</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Roubos de senhas caso o usuário não exerça as medidas prudentes de salvaguardar seu acesso de ataques de Phishing originados fôra do ecossistema do site do ConcursoMestre.</p>
                  </div>
                </div>
              </section>

              <div className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center md:text-left">
                  Precisa de Suporte Jurídico?
                </div>
                <a href="mailto:juridico@concursomestre.ai" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-all flex items-center gap-2">
                  juridico@concursomestre.ai <ArrowRight size={14} />
                </a>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
