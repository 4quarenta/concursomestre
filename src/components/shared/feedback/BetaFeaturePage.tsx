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
import { ArrowLeft, BadgeInfo, Clock3, Sparkles } from 'lucide-react';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';

interface BetaFeaturePageProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isEnabled: boolean;
  featureLabel: string;
}

const BetaFeaturePage: React.FC<BetaFeaturePageProps> = ({
  title,
  description,
  icon: Icon,
  isEnabled,
  featureLabel,
}) => {
  const statusTitle = isEnabled ? 'Modulo beta em preparacao' : 'Modulo beta desativado';
  const statusDescription = isEnabled
    ? 'A estrutura principal ja esta pronta, mas a experiencia completa ainda sera implementada em uma proxima rodada.'
    : 'Este modulo beta esta desligado por padrao no painel administrativo e sera liberado quando o fluxo oficial estiver pronto.';

  return (
    <div className={`mx-auto flex w-full flex-col gap-6 ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS}`}>
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{title}</h1>
                  <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-sm">
                    Beta
                  </span>
                </div>
                <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{description}</p>
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <Icon size={28} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-white p-2 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                  <BadgeInfo size={18} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{statusTitle}</h2>
                  <p className="text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{statusDescription}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <Clock3 size={12} />
                      {isEnabled ? 'Liberado em modo controlado' : 'Desativado por padrao'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <Icon size={12} />
                      {featureLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-5 py-5 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-950">
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
                  Proxima etapa
                </p>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Modulo reservado na navegacao e no admin
                </h2>
                <p className="text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  A chave do modulo ja esta vinculada ao painel administrativo para que a liberacao futura aconteca sem mudar a arquitetura do produto.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <Sparkles size={12} />
                  Modulo em beta
                </div>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:scale-[1.01] dark:bg-indigo-600"
                >
                  <ArrowLeft size={14} />
                  Voltar
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BetaFeaturePage;
