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
import { ChevronLeft, ChevronRight, Clock3, Loader2, PauseCircle, TimerReset } from 'lucide-react';
import type { StudyTimeTotals } from '@services/statistics/studyTrackerStore';
import { formatStudyClock, formatStudyDuration } from '@services/statistics/studyTimeFormatting';

interface StudySessionWidgetProps {
  isLoading: boolean;
  isSaving: boolean;
  isExpanded: boolean;
  persistedTotals: StudyTimeTotals;
  sessionTotals: StudyTimeTotals;
  displayTotals: StudyTimeTotals;
  onToggle: () => void;
  onStop: () => void;
}

const StudyMetric = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-3 dark:border-slate-800/80 dark:bg-slate-950/80">
    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{value}</p>
  </div>
);

/**
 * Widget flutuante discreto que resume a sessão ativa de estudo.
 *
 * @since 1.0.0
 */
const StudySessionWidget: React.FC<StudySessionWidgetProps> = ({
  isLoading,
  isSaving,
  isExpanded,
  persistedTotals,
  sessionTotals,
  displayTotals,
  onToggle,
  onStop,
}) => {
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-4 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-l-2xl rounded-r-xl border border-slate-200 bg-white/95 px-3 py-3 shadow-xl shadow-slate-200/50 transition-all hover:-translate-y-1/2 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none dark:hover:border-indigo-900/50 dark:hover:text-indigo-300"
        aria-label="Mostrar widget de estudos"
      >
        <Clock3 size={16} />
        <span className="text-[10px] font-black uppercase tracking-[0.16em]">
          {formatStudyClock(sessionTotals.totalSeconds)}
        </span>
        <ChevronLeft size={14} />
      </button>
    );
  }

  return (
    <aside className="fixed right-4 top-1/2 z-40 w-[min(20rem,calc(100vw-2rem))] -translate-y-1/2 rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-2xl shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-950/96 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Sessão atual</p>
          <h2 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">Tempo de estudos</h2>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
            O tempo é contado automaticamente enquanto você resolve questões, faz simulado ou lê conteúdos. Use o botão abaixo para salvar a sessão atual no histórico.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-indigo-900/50 dark:hover:text-indigo-300"
          aria-label="Ocultar widget de estudos"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-4 rounded-[1.6rem] bg-slate-50/80 p-4 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Sessão em andamento</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
              {formatStudyClock(sessionTotals.totalSeconds)}
            </p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm dark:bg-slate-950">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Acumulado</p>
            <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatStudyDuration(displayTotals.totalSeconds)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StudyMetric label="Questões" value={formatStudyDuration(sessionTotals.questionSeconds)} />
        <StudyMetric label="Leitura" value={formatStudyDuration(sessionTotals.readingSeconds)} />
        <StudyMetric label="Total" value={formatStudyDuration(sessionTotals.totalSeconds)} />
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          <span>Persistido</span>
          {isLoading ? (
            <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <Loader2 size={11} className="animate-spin" />
              Sincronizando
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StudyMetric label="Questões" value={formatStudyDuration(persistedTotals.questionSeconds)} />
          <StudyMetric label="Leitura" value={formatStudyDuration(persistedTotals.readingSeconds)} />
          <StudyMetric label="Total" value={formatStudyDuration(persistedTotals.totalSeconds)} />
        </div>
      </div>

      <button
        type="button"
        onClick={onStop}
        disabled={isSaving}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-600 disabled:cursor-wait disabled:opacity-70 dark:bg-indigo-600 dark:hover:bg-indigo-500"
      >
        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
        {isSaving ? 'Salvando tempo...' : 'Salvar tempo estudado'}
      </button>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
        <TimerReset size={12} />
        Ao salvar, a sessão é enviada para o seu histórico e o contador recomeça do zero.
      </div>
    </aside>
  );
};

export default StudySessionWidget;
