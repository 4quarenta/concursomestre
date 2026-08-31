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
import { Lock, Eye, Database, UserCheck, ChevronLeft, ArrowRight, Server, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

const PrivacyPolicy: React.FC = () => {
  const router = useRouter();
  const privacyContactEmail = useAppConfigStore((state) => state.systemSettings.privacyContactEmail || 'dpo@concursomestre.ai');
  const [activeTab, setActiveTab] = useState('coleta');

  // Highlighting intersection observer logic for scroll-spy
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
        <div className="relative rounded-2xl bg-emerald-600 dark:bg-emerald-900/50 p-10 md:p-16 mb-8 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 blur-3xl opacity-50 dark:opacity-30 mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-4 max-w-2xl text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Shield size={14} className="text-emerald-200" />
                Segurança de Dados
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Política de Privacidade</h1>
              <p className="text-emerald-100 text-sm md:text-base font-medium opacity-90 leading-relaxed">
                Conformidade com a LGPD (Lei 13.709/2018). Nosso compromisso inegociável com a segurança, o anonimato e a transparência em relação aos seus dados.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 px-6 py-4 rounded-2xl text-right">
              <span className="block text-[10px] uppercase font-black tracking-widest text-emerald-200 mb-1">Última Atualização</span>
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
                { id: 'coleta', icon: Database, label: '1. Coleta de Dados' },
                { id: 'segurança', icon: Lock, label: '2. Segurança da Informação' },
                { id: 'compartilhamento', icon: Server, label: '3. Compartilhamento' },
                { id: 'direitos', icon: UserCheck, label: '4. Seus Direitos (LGPD)' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left group ${activeTab === item.id
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <item.icon size={16} className={`transition-all ${activeTab === item.id ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                  {item.label}
                  {activeTab === item.id && <ArrowRight size={14} className="ml-auto opacity-50" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Areas */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 md:p-12 transition-colors">
            <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed transition-colors">

              <section id="coleta" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/20 text-indigo-500">
                    <Database size={24} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">1. Coleta de Dados</h2>
                </div>
                <div className="space-y-6">
                  <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    A transparência é a base da nossa relação. Coletamos e processamos única e exclusivamente as informações que são essenciais para a prestação plena e segura de nossos serviços educacionais, visando uma jornada de estudo customizada.
                  </p>

                  <div className="mt-8 grid grid-cols-1 gap-6">
                    <div className="group relative overflow-hidden bg-white dark:bg-slate-800/80 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700/50 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col md:flex-row gap-6 items-start">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/20"></div>
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-indigo-200 dark:border-slate-600 shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <UserCheck size={24} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="relative z-10 flex-1">
                        <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Dados Cadastrais Relacionais</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Coletamos nome completo, e-mail e avatar para identificação e comunicação transacional mínima. Senhas são &quot;hashed&quot; unidirecionalmente com os protocolos mais fortes da indústria.</p>
                      </div>
                    </div>

                    <div className="group relative overflow-hidden bg-white dark:bg-slate-800/80 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700/50 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col md:flex-row gap-6 items-start">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20"></div>
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-emerald-200 dark:border-slate-600 shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Lock size={24} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="relative z-10 flex-1">
                        <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Dados Fiscais Sensíveis</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">CPF e Endereço são requeridos apenas no ato da conversão para plano pago (Pagar.me/Stripe) ou para credenciamento obrigatório &quot;Know Your Customer&quot;. <strong className="text-slate-700 dark:text-slate-200">Nós NUNCA guardamos números integrais de seu cartão.</strong></p>
                      </div>
                    </div>

                    <div className="group relative overflow-hidden bg-white dark:bg-slate-800/80 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700/50 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col md:flex-row gap-6 items-start">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-sky-500/20"></div>
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-sky-200 dark:border-slate-600 shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Eye size={24} className="text-sky-600 dark:text-sky-400" />
                      </div>
                      <div className="relative z-10 flex-1">
                        <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2 tracking-tight group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">Dados Comportamentais</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Estatísticas ativas de acertos, tempo gasto interpretando a questão e prompts conversacionais com a IA Mestre, estritamente necessários para calibrar a árvore de aprendizado do seu Raio-X Preditivo.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="segurança" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl border border-emerald-500/20 text-emerald-500">
                    <Lock size={24} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 m-0 tracking-tight">2. Segurança da Informação</h2>
                </div>
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 font-medium mb-8">
                  Empregamos medidas técnicas e administrativas rigorosas para manter seus dados de reféns longe de vazamentos acidentais ou acessos não autorizados.
                </p>

                <div className="relative group p-8 md:p-10 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-emerald-500/10 transition-all"></div>
                  <ul className="relative z-10 space-y-6">
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-1 border border-emerald-200 dark:border-emerald-800">
                        <Shield size={14} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-slate-900 dark:text-slate-100 font-bold mb-1">Criptografia em Trânsito</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Todo o tráfego da plataforma é fortificado via TLS (Transport Layer Security) assegurando que endpoints em sua rede não espionem o payload de envio.</p>
                      </div>
                    </li>
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-1 border border-emerald-200 dark:border-emerald-800">
                        <Lock size={14} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-slate-900 dark:text-slate-100 font-bold mb-1">Gateway Blindado</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Dados críticos de assinatura e gateway de pagamento são processados por tokens indiretos, sem passarem (ou deixarem log) em nosso Back-end.</p>
                      </div>
                    </li>
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-1 border border-emerald-200 dark:border-emerald-800">
                        <Server size={14} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-slate-900 dark:text-slate-100 font-bold mb-1">Monitoramento Constante</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Nossa nuvem roda scan automático por injeções de SQL, manipulações de dom (XSS) e checagens excessivas contra robôs (Slowloris/DDoS).</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="compartilhamento" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-sky-500/20 to-blue-500/20 rounded-2xl border border-sky-500/20 text-sky-500">
                    <Server size={24} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 m-0 tracking-tight">3. Compartilhamento Restrito</h2>
                </div>
                <div className="space-y-4 text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  <p>
                    A ConcursoMestre orgulha-se de não comercializar o ativo mais valioso de nossa geração: <strong className="text-slate-800 dark:text-slate-200">sua privacidade</strong>. A locação ou venda de leads e dados é extritamente proibida e contramedida pelos fundadores.
                  </p>

                  <p>O compartilhamento se reduz aos vetores necessários para funcionamento do escopo legal:</p>
                  <ul className="list-disc pl-5 mt-4 space-y-3">
                    <li>Processadores de pagamento operando como &quot;Data Processor&quot;.</li>
                    <li>Integração das requisições junto aos provedores de Large Language Models (LLMs como Google Gemini / OpenAI), de forma que os provedores <strong>não possam</strong> treinar modelos nos prompts que não forem devidamente isolados ou se opuserem por API Opt-out.</li>
                    <li>Atividades estatais e Ordens Judiciais transitadas e julgadas.</li>
                  </ul>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-12"></div>

              <section id="direitos" className="scroll-mt-24 mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 rounded-2xl border border-fuchsia-500/20 text-fuchsia-500">
                    <UserCheck size={24} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 m-0 tracking-tight">4. Seus Direitos (LGPD)</h2>
                </div>
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 font-medium mb-8">
                  Por lei, você é plenamente dono e reinante sobre suas próprias informações. Você ostenta os seguintes direitos constitucionais que facilitamos acesso:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { title: "Direito de Esquecimento", desc: "A exclusão integral da sua conta remove suas notas sistêmicas, dados e correlações.", highlight: "text-red-500", borderColor: "hover:border-red-400 dark:hover:border-red-500/50" },
                    { title: "Direito de Correção", desc: "Painéis de edição transparentes para ajustar nome, avatar e vínculos de pagamento a qualquer instante.", highlight: "text-emerald-500", borderColor: "hover:border-emerald-400 dark:hover:border-emerald-500/50" },
                    { title: "Direito de Portabilidade", desc: "Caso requerido, empacotaremos seu histórico de banco em JSON legível formatado.", highlight: "text-indigo-500", borderColor: "hover:border-indigo-400 dark:hover:border-indigo-500/50" },
                    { title: "Revogação de Anuência", desc: "Newsletters e E-mails massivos podem ser opostos com simples de-check na área de Configurações.", highlight: "text-amber-500", borderColor: "hover:border-amber-400 dark:hover:border-amber-500/50" }
                  ].map((right, idx) => (
                    <div key={idx} className={`p-6 bg-white dark:bg-slate-800/80 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${right.borderColor}`}>
                      <h4 className={`text-sm font-black uppercase tracking-widest mb-3 ${right.highlight}`}>{right.title}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{right.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center md:text-left">
                  Fale com o DPO (Data Protection Officer)
                </div>
                <a href={`mailto:${privacyContactEmail}`} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:opacity-90 transition-all flex items-center gap-2">
                  {privacyContactEmail} <ArrowRight size={14} />
                </a>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
