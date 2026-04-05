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

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BrainCircuit, ArrowRight, CheckCircle2, Star, Users,
    Trophy, BookOpen, Zap, Sparkles, ShieldCheck,
    MessageSquare, Globe, Target, ShoppingBag, Flame, Music, Gift, Clock, Percent, GraduationCap
} from 'lucide-react';
import { useData } from '@providers/DataProvider';
import { themeConfig } from '@constants/themes';
import { ThemeOrnaments } from './components/ThemeOrnaments';
import platformIllustration from '../../assets/site/concurso-mestre-platform.svg';

const LandingPage: React.FC = () => {
    const { systemSettings } = useData();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'annual'>('annual');

    const currentTheme = themeConfig[systemSettings.activeTheme || 'default'] || themeConfig.default;
    const ThemeIcon = currentTheme.icon;

    // Determine forced mode classes
    const forceModeClass = currentTheme.forceMode === 'dark'
        ? 'dark bg-slate-950 text-white'
        : currentTheme.forceMode === 'light'
            ? 'light bg-white text-slate-950'
            : '';

    const navLinks = [
        { label: 'InÃ­cio', to: '/', active: true },
        { label: 'Concursos', to: '/exams', visible: true },
        { label: 'Aulas', to: '/video-lessons', visible: true },
        { label: 'QuestÃµes', to: '/practice', visible: systemSettings.features.practiceEnabled },
        { label: 'Rankings', to: '/ranking', visible: systemSettings.features.rankingsEnabled },
        { label: 'Materiais', to: '/marketplace', visible: systemSettings.features.marketplaceEnabled },
    ].filter(link => link.visible !== false);

    const stats = [
        { label: 'QuestÃµes Cadastradas', value: '850k+', icon: BookOpen },
        { label: 'Alunos Aprovados', value: '45k+', icon: Trophy },
        { label: 'Materiais de Estudo', value: '12k+', icon: ShoppingBag },
        { label: 'ComentÃ¡rios Reais', value: '1.5M+', icon: MessageSquare },
    ];

    const features = [
        {
            title: 'Ranking PÃ³s-Prova',
            description: 'Cadastre suas notas e compare seu desempenho em tempo real com outros candidatos. A ferramenta essencial para prever sua aprovaÃ§Ã£o.',
            icon: Trophy,
            color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20'
        },
        {
            title: 'Materiais de Estudo',
            description: 'Acesse resumos, mapas mentais e materiais em PDF criados pelos melhores professores e aprovados do paÃ­s.',
            icon: ShoppingBag,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
        },
        {
            title: 'ExplicaÃ§Ãµes Detalhadas',
            description: 'Nossas questÃµes contam com explicaÃ§Ãµes profissionais passo a passo, garantindo que vocÃª entenda a lÃ³gica por trÃ¡s de cada alternativa.',
            icon: BookOpen,
            color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
        },
        {
            title: 'Sistema de QuestÃµes Premium',
            description: 'Filtros avanÃ§ados por banca, ano, assunto e dificuldade. Sua preparaÃ§Ã£o organizada com foco total no que cai.',
            icon: Target,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
        },
        {
            title: 'Raio-X da Banca',
            description: 'Entenda o perfil de cada banca examinadora. Saiba exatamente os temas recorrentes e as "pegadinhas" mais comuns.',
            icon: Zap,
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
        },
        {
            title: 'Comunidade e InteraÃ§Ã£o',
            description: 'A maior rede de concurseiros do Brasil. Troque experiÃªncias, tire dÃºvidas e colabore na construÃ§Ã£o do conhecimento.',
            icon: Users,
            color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20'
        }
    ];

    const plans = Object.entries(systemSettings.pricing).map(([name, priceConfig]: [any, any]) => {
        const details = systemSettings.planDetails[name];
        const rawPrice = priceConfig[billingCycle];
        const monthlyEquivalent = billingCycle === 'monthly' ? rawPrice :
            billingCycle === 'quarterly' ? rawPrice / 3 :
                rawPrice / 12;

        return {
            name,
            displayPrice: `R$ ${monthlyEquivalent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            priceDetail: '/mÃªs',
            totalPrice: billingCycle !== 'monthly' && rawPrice > 0
                ? `R$ ${rawPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} no total`
                : null,
            description: name === 'Gratuito' ? 'Ideal para quem estÃ¡ comeÃ§ando agora.' :
                name === 'Essencial' ? 'Tudo o que vocÃª precisa para acelerar.' :
                    name === 'Pro' ? 'A escolha definitiva dos aprovados.' : 'Foco total em performance de alto nÃ­vel.',
            features: details.features.filter((f: any) => f.included).map((f: any) => f.text),
            button: name === 'Gratuito' ? 'Escolher GrÃ¡tis' :
                name === 'Pro' ? 'Mais Vendido' :
                    name === 'Elite' ? 'Seja Elite' : 'Assinar Agora',
            highlight: name === 'Pro',
            cyclePrice: rawPrice
        };
    });

    return (
        <div className={`min-h-screen font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30 transition-colors duration-300 ${forceModeClass || 'bg-white dark:bg-slate-950'}`}>

            {/* Promotion Banner */}
            {systemSettings.activePromotion.isActive && (
                <div className="bg-slate-900 dark:bg-indigo-950 text-white py-2.5 px-6 text-center text-[10px] font-black uppercase tracking-[0.2em] relative z-[60] animate-fade-in border-b border-white/10 flex items-center justify-center gap-3">
                    <Zap size={14} className="text-amber-400 animate-pulse" />
                    <span>{systemSettings.activePromotion.bannerText}</span>
                    <Link to="/auth?register=true" className="ml-4 bg-white text-slate-900 px-3 py-1 rounded-full text-[9px] hover:bg-slate-100 transition-colors">Aproveitar Agora</Link>
                </div>
            )}

            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-900 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-2xl tracking-tight shrink-0 mr-8">
                        <ThemeIcon className="w-8 h-8" />
                        <span>ConcursoMestre</span>
                    </div>

                    <div className="hidden md:flex items-center gap-6 flex-1 px-8 overflow-x-auto no-scrollbar justify-center">
                        {navLinks.map((link, idx) => (
                            <Link
                                key={idx}
                                to={link.to}
                                className={`text-[10px] font-black uppercase tracking-widest transition-colors shrink-0 ${link.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400'}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 ml-8 shrink-0">
                        <Link to="/auth" className="sm:block text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Entrar</Link>
                        <Link
                            to="/auth?register=true"
                            className={`px-6 py-2.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg ${currentTheme.button}`}
                        >
                            Assinar Agora
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-20 pb-32 px-6 overflow-hidden">
                <ThemeOrnaments themeId={systemSettings.activeTheme} />

                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-10 dark:opacity-20 pointer-events-none">
                    <div className={`absolute top-20 left-10 w-96 h-96 ${currentTheme.bgOverlay} rounded-full blur-[120px]`} />
                    <div className={`absolute bottom-20 right-10 w-96 h-96 ${currentTheme.bgOverlay} rounded-full blur-[120px] opacity-60`} />
                </div>

                <div className="max-w-5xl mx-auto text-center space-y-8 animate-slide-up">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${currentTheme.accent} rounded-full text-[10px] font-black uppercase tracking-[0.2em] animate-fade-in`}>
                        <CheckCircle2 size={14} /> {currentTheme.heroBadge}
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-slate-950 dark:text-white tracking-tight leading-[1.1]">
                        Transforme seu estudo em <span className={`text-transparent bg-clip-text bg-gradient-to-r ${currentTheme.heroGradient}`}>Alta Performance</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed">
                        Mais que um banco de questÃµes. Uma plataforma completa que entende suas dificuldades e acelera sua aprovaÃ§Ã£o com estatÃ­sticas precisas.
                    </p>

                    {systemSettings.activeTheme !== 'default' && (
                        <div className="flex justify-center items-center gap-4 animate-fade-in">
                            <div className="h-px w-12 bg-slate-200 dark:bg-slate-800" />
                            <span className="text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Clock size={14} className="animate-spin-slow" /> Oferta expira em breve
                            </span>
                            <div className="h-px w-12 bg-slate-200 dark:bg-slate-800" />
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link
                            to="/auth?register=true"
                            className={`w-full sm:w-auto px-10 py-5 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 ${currentTheme.button}`}
                        >
                            {systemSettings.activeTheme !== 'default' ? 'Aproveitar PromoÃ§Ã£o Exclusiva' : 'ComeÃ§ar agora - Ã‰ grÃ¡tis'} <ArrowRight size={20} />
                        </Link>
                        <a
                            href="#recursos"
                            className="w-full sm:w-auto px-10 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center justify-center gap-3 shadow-md"
                        >
                            Ver Funcionalidades
                        </a>
                    </div>

                    <div className="pt-12">
                        <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
                            <img
                                src={platformIllustration}
                                alt="Visao geral da plataforma ConcursoMestre com questoes, simulados, ranking, desempenho e materiais."
                                className="w-full rounded-[2rem] border border-white/10"
                            />
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                                <span className="rounded-full bg-white/10 px-3 py-1.5">Questoes comentadas</span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5">Simulados</span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5">Ranking</span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5">Materiais em PDF</span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5">Desempenho</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="bg-slate-950 py-16 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats.map((s, i) => (
                        <div key={i} className="text-center space-y-2 group">
                            <div className="flex justify-center mb-2">
                                <s.icon size={24} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-3xl md:text-4xl font-black text-white">{s.value}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Grid */}
            <section id="recursos" className="py-32 px-6 bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 space-y-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Diferenciais ConcursoMestre</h2>
                        <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">O que vocÃª encontra na plataforma</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${f.color}`}>
                                    <f.icon size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{f.title}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="planos" className="py-32 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-16 space-y-4">
                        <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">Planos que cabem no seu bolso</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto">Escolha o nÃ­vel de acesso que mais combina com seu momento de estudos.</p>

                        {/* Cycle Toggle */}
                        <div className="flex justify-center pt-8">
                            <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
                                {(['monthly', 'quarterly', 'annual'] as const).map(cycle => (
                                    <button
                                        key={cycle}
                                        onClick={() => setBillingCycle(cycle)}
                                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billingCycle === cycle
                                            ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        {cycle === 'monthly' ? 'Mensal' : cycle === 'quarterly' ? 'Trimestral' : 'Anual'}
                                        {cycle !== 'monthly' && (
                                            <span className="ml-1.5 text-[8px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-md">
                                                -{cycle === 'quarterly' ? systemSettings.pricing.Pro.quarterlyDiscountPercent : systemSettings.pricing.Pro.annualDiscountPercent}%
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {systemSettings.activeTheme !== 'default' && (
                            <div className="pt-6 animate-bounce space-x-2">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg ${currentTheme.button}`}>
                                    <Percent size={12} className="inline mr-1" /> Oferta Especial: {currentTheme.heroBadge.split(':')[0]}
                                </span>
                                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                                    PreÃ§os Reduzidos!
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((p, i) => (
                            <div key={i} className={`flex flex-col p-8 rounded-[2.5rem] border transition-all ${p.highlight
                                ? 'bg-slate-900 dark:bg-indigo-600 border-slate-800 dark:border-indigo-500 scale-105 shadow-2xl z-10'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                }`}>
                                <h4 className={`text-sm font-black uppercase tracking-widest mb-2 ${p.highlight ? 'text-indigo-400 dark:text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {p.name}
                                </h4>
                                <div className="space-y-0.5 mb-1">
                                    <p className={`text-4xl font-black ${p.highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                        {p.displayPrice}<span className="text-sm font-bold opacity-60 ml-1">{p.priceDetail}</span>
                                    </p>
                                    {p.totalPrice && (
                                        <p className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${p.highlight ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {p.totalPrice}
                                        </p>
                                    )}
                                </div>
                                <p className={`text-xs font-medium mb-8 leading-relaxed ${p.highlight ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {p.description}
                                </p>
                                <ul className="space-y-4 mb-8 flex-1">
                                    {p.features.map((f, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-[10px] font-bold">
                                            <CheckCircle2 size={14} className={p.highlight ? 'text-indigo-300' : 'text-emerald-500'} />
                                            <span className={p.highlight ? 'text-white' : 'text-slate-600 dark:text-slate-300'}>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    to="/auth?register=true"
                                    className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-center ${p.highlight
                                        ? 'bg-white text-slate-950 hover:bg-slate-100 shadow-xl'
                                        : `text-white hover:opacity-90 ${currentTheme.button}`
                                        }`}
                                >
                                    {p.button}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={`py-20 px-6 border-t ${currentTheme.forceMode === 'dark' ? 'border-white/10' : 'border-slate-100 dark:border-slate-900 shadow-inner'}`}>
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xl tracking-tight">
                            <ThemeIcon size={24} />
                            <span>ConcursoMestre</span>
                        </div>
                        <p className={`text-sm leading-relaxed ${currentTheme.forceMode === 'dark' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            A plataforma completa para quem busca a aprovaÃ§Ã£o definitiva em concursos pÃºblicos.
                        </p>
                        {systemSettings.activeTheme !== 'default' && (
                            <div className={`inline-block px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${currentTheme.accent}`}>
                                Campanha {systemSettings.activeTheme} Ativa
                            </div>
                        )}
                    </div>

                    <div>
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">MÃ³dulos</h5>
                        <ul className="space-y-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                            <li><Link to="/practice" className="hover:text-indigo-600 transition-colors">QuestÃµes e Simulados</Link></li>
                            <li><Link to="/ranking" className="hover:text-indigo-600 transition-colors">Ranking PÃ³s-Prova</Link></li>
                            <li><Link to="/marketplace" className="hover:text-indigo-600 transition-colors">Materiais de Estudo</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">Links Ãšteis</h5>
                        <ul className="space-y-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                            <li><Link to="/auth" className="hover:text-indigo-600 transition-colors">Entrar / Cadastrar</Link></li>
                            <li><Link to="/terms" className="hover:text-indigo-600 transition-colors">Termos de Uso</Link></li>
                            <li><Link to="/privacy" className="hover:text-indigo-600 transition-colors">Privacidade</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">Institucional</h5>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-bold">
                            <Globe size={18} /> PortuguÃªs (Brasil)
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 leading-relaxed font-medium">
                            Â© 2026 ConcursoMestre Tecnologia Ltda.<br />
                            CNPJ: 00.000.000/0000-00
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
