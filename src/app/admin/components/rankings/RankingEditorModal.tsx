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
import type { Ranking } from '@types';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

interface RankingEditorModalProps {
  ranking: Ranking;
  setRanking: React.Dispatch<React.SetStateAction<Ranking | null>>;
  onClose: () => void;
  onSave: () => void;
}

const RankingEditorModal = ({
  ranking,
  setRanking,
  onClose,
  onSave,
}: RankingEditorModalProps) => {
  const updateRanking = (patch: Partial<Ranking>) => {
    setRanking((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className={`${ADMIN_MODAL_PANEL_CLASS} flex max-h-[90vh] w-full max-w-2xl flex-col shadow-2xl animate-scale-up`}>
        <header className={ADMIN_MODAL_HEADER_CLASS}>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Editar ranking</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Ajuste as configurações e regras do ranking.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </header>

        <div className="no-scrollbar space-y-6 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nome do ranking</label>
              <input
                type="text"
                value={ranking.name}
                onChange={(event) => updateRanking({ name: event.target.value })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Instituição</label>
              <input
                type="text"
                value={ranking.institution}
                onChange={(event) => updateRanking({ institution: event.target.value })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vagas AC</label>
              <input
                type="number"
                value={ranking.vacanciesAc}
                onChange={(event) => updateRanking({ vacanciesAc: Number(event.target.value) })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vagas Afro</label>
              <input
                type="number"
                value={ranking.vacanciesAfro}
                onChange={(event) => updateRanking({ vacanciesAfro: Number(event.target.value) })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vagas PCD</label>
              <input
                type="number"
                value={ranking.vacanciesPcd}
                onChange={(event) => updateRanking({ vacanciesPcd: Number(event.target.value) })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vagas reserva</label>
              <input
                type="number"
                value={ranking.reserveLimit}
                onChange={(event) => updateRanking({ reserveLimit: Number(event.target.value) })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total de questões</label>
              <input
                type="number"
                value={ranking.totalQuestions}
                onChange={(event) => updateRanking({ totalQuestions: Number(event.target.value) })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Status do gabarito</label>
              <select
                value={ranking.keyStatus}
                onChange={(event) => updateRanking({ keyStatus: event.target.value as Ranking['keyStatus'] })}
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              >
                <option value="pending">Pendente / Preliminar</option>
                <option value="official">Oficial</option>
              </select>
            </div>
          </div>
        </div>

        <footer className={`${ADMIN_MODAL_FOOTER_CLASS} flex justify-end gap-3`}>
          <button
            type="button"
            onClick={onClose}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            <Save size={16} /> Salvar alterações
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default RankingEditorModal;
