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
import { createPortal } from 'react-dom';
import { Save, Trophy, X } from 'lucide-react';

interface RankingEditorModalProps {
  ranking: any;
  setRanking: React.Dispatch<React.SetStateAction<any | null>>;
  onClose: () => void;
  onSave: () => void;
}

const RankingEditorModal = ({
  ranking,
  setRanking,
  onClose,
  onSave,
}: RankingEditorModalProps) => {
  const updateRanking = (patch: Record<string, unknown>) => {
    setRanking((prev: any) => (prev ? { ...prev, ...patch } : prev));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-scale-up dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-8 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Editar Ranking</h3>
              <p className="text-xs font-medium text-slate-500">Ajuste as configurações e regras do ranking.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white dark:hover:bg-slate-700">
            <X size={20} />
          </button>
        </header>

        <div className="no-scrollbar space-y-6 overflow-y-auto p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nome do Ranking</label>
              <input
                type="text"
                value={ranking.name}
                onChange={(event) => updateRanking({ name: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Instituicao</label>
              <input
                type="text"
                value={ranking.institution}
                onChange={(event) => updateRanking({ institution: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vagas Imediatas</label>
              <input
                type="number"
                value={ranking.vacancies}
                onChange={(event) => updateRanking({ vacancies: Number(event.target.value) })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vagas Reserva</label>
              <input
                type="number"
                value={ranking.reserveLimit}
                onChange={(event) => updateRanking({ reserveLimit: Number(event.target.value) })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total de Questões</label>
              <input
                type="number"
                value={ranking.totalQuestions}
                onChange={(event) => updateRanking({ totalQuestions: Number(event.target.value) })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Status do Gabarito</label>
              <select
                value={ranking.keyStatus}
                onChange={(event) => updateRanking({ keyStatus: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="pending">Pendente / Preliminar</option>
                <option value="official">Oficial</option>
              </select>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/30 p-8 dark:border-slate-800 dark:bg-slate-800/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700"
          >
            <Save size={16} /> Salvar Alteracoes
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default RankingEditorModal;
