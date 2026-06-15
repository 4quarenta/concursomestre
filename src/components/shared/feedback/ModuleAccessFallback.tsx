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
import { ArrowRight, CheckCircle2, Crown, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';

interface ModuleAccessFallbackProps {
  description: string;
  eyebrow?: string;
  title?: string;
  ctaTo?: string;
  ctaLabel?: string;
  benefits?: string[];
  tone?: 'upgrade' | 'disabled';
}

const ModuleAccessFallback: React.FC<ModuleAccessFallbackProps> = ({
  description,
  eyebrow = 'Acesso restrito',
  title = 'Desbloqueie este recurso',
  ctaTo = '/',
  ctaLabel = 'Ver planos',
  benefits = [
    'Experiencia completa do modulo',
    'Recursos premium liberados pelo plano',
    'Estudo sem bloqueios artificiais',
    'Upgrade imediato apos a assinatura',
  ],
  tone = 'upgrade',
}) => {
  const isUpgrade = tone === 'upgrade';

  return (
  <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
    <div className={`${PLATFORM_SURFACE_CARD_CLASS} relative overflow-hidden p-8 md:p-10`}>
      <div className={`absolute inset-0 ${
        isUpgrade
          ? 'bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(79,70,229,0.12),_transparent_40%)]'
          : 'bg-slate-50/70 dark:bg-slate-950/40'
      }`} />
      <div className="relative z-10 mx-auto max-w-xl space-y-5 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] border shadow-sm ${
          isUpgrade
            ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
        }`}>
          {isUpgrade ? <Lock size={30} /> : <Sparkles size={30} />}
        </div>

        <div className="space-y-2">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
            isUpgrade ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {eyebrow}
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        {isUpgrade && benefits.length > 0 ? (
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="rounded-[1.25rem] border border-slate-200 bg-white/80 px-4 py-3 text-xs font-bold text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                  <span>{benefit}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

      <Link
        href={ctaTo}
          className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-lg transition-all ${
            isUpgrade
              ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600 dark:shadow-none'
              : 'bg-slate-900 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 dark:shadow-none'
          }`}
      >
          {isUpgrade ? <Crown size={16} /> : <ArrowRight size={14} />}
        {ctaLabel}
      </Link>
      </div>
    </div>
  </section>
  );
};

export default ModuleAccessFallback;
