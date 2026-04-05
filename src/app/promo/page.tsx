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


import React from 'react';
import { useData } from '@providers/DataProvider';
import { Check, Star, Zap, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PromoLanding: React.FC = () => {
    const { systemSettings } = useData();
    const navigate = useNavigate();
    const promo = systemSettings.activePromotion;

    if (!promo.isActive) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 transition-colors">Nenhuma promoÃ§Ã£o ativa no momento.</h1>
                <button onClick={() => navigate('/')} className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline transition-colors font-bold">Voltar ao inÃ­cio</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 animate-fade-in transition-colors">
            {/* Hero Section */}
            <div className="w-full py-24 px-6 text-center text-white relative overflow-hidden" style={{ backgroundColor: promo.themeColor }}>
                <div className="relative z-10 max-w-4xl mx-auto space-y-8">
                    <span className="inline-block px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-[0.2em] animate-pulse border border-white/10">Oferta por Tempo Limitado</span>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none drop-shadow-sm">{promo.landingPageHeadline}</h1>
                    <p className="text-xl md:text-2xl font-medium opacity-90 max-w-2xl mx-auto leading-relaxed">{promo.landingPageSubheadline}</p>
                    <div className="pt-4">
                        <button onClick={() => navigate('/profile')} className="px-12 py-5 bg-white text-slate-900 font-black uppercase tracking-widest text-sm rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">
                            Quero Aproveitar {promo.discountPercentage}% OFF
                        </button>
                    </div>
                </div>
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 right-0 w-80 h-80 bg-white rounded-full blur-3xl"></div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="max-w-6xl mx-auto py-24 px-6">
                <h2 className="text-4xl font-black text-slate-900 dark:text-slate-100 text-center mb-16 transition-colors">Por que assinar agora?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {promo.featuresHighlight.map((feat, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl hover:-translate-y-2 transition-all group overflow-hidden relative">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-8 text-slate-900 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                {idx === 0 ? <Zap size={32} /> : idx === 1 ? <ShieldCheck size={32} /> : <Star size={32} />}
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3 transition-colors">{feat}</h3>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medum transition-colors">Aproveite todos os recursos premium para acelerar sua aprovaÃ§Ã£o com a melhor tecnologia do mercado.</p>
                            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pricing CTA */}
            <div className="bg-slate-900 dark:bg-slate-950 py-24 px-6 text-center transition-colors">
                <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-indigo-700 dark:to-purple-900 p-12 md:p-20 rounded-[4rem] shadow-2xl text-white relative overflow-hidden transition-colors">
                    <div className="relative z-10 flex flex-col items-center">
                        <h2 className="text-4xl md:text-5xl font-black mb-8">Plano Elite Anual</h2>
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-10">
                            <span className="text-2xl opacity-50 line-through font-bold">R$ {systemSettings.pricing.Elite.annual.toFixed(2).replace('.', ',')}</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs uppercase font-black opacity-80 tracking-widest">Apenas</span>
                                <span className="text-6xl md:text-8xl font-black">R$ {(systemSettings.pricing.Elite.annual * (1 - promo.discountPercentage / 100)).toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                        <p className="text-indigo-100 font-medium mb-12 text-lg max-w-xl opacity-90">Sua jornada rumo Ã  estabilidade comeÃ§a com a melhor decisÃ£o do seu ano.</p>
                        <button onClick={() => navigate('/profile')} className="w-full md:w-auto px-16 py-6 bg-white text-indigo-700 font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all">
                            Assinar com Desconto
                        </button>
                        <div className="flex items-center gap-2 mt-8 text-[11px] opacity-70 uppercase tracking-widest font-black">
                            <Check size={14} /> Garantia incondicional de 7 dias
                        </div>
                    </div>
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
                </div>
            </div>
        </div>
    );
};

export default PromoLanding;
