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
import { Edit3, Trash2 } from 'lucide-react';
import type { Question } from '@types';

interface QuestionsPagination {
  total: number;
  perPage: number;
  pages: number;
  page: number;
}

interface AdminQuestionsSectionProps {
  questions: Question[];
  pagination: QuestionsPagination;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onEdit: (question: Question) => void;
  onDelete: (questionId: string) => void;
  onPageChange: (page: number) => void;
}

const AdminQuestionsSection = ({
  questions,
  pagination,
  renderSortableHeader,
  onEdit,
  onDelete,
  onPageChange,
}: AdminQuestionsSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
            <tr>
              {renderSortableHeader('Questao', 'enunciado_clean')}
              <th className="p-4">Status</th>
              {renderSortableHeader('Banca/Materia', 'banca')}
              <th className="p-4 text-center">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {questions.map((question: any) => (
              <tr key={question.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4 max-w-md truncate text-slate-900 dark:text-slate-100 font-medium">
                  {question.enunciado_clean || question.text}
                </td>
                <td className="p-4">
                  <div className="flex gap-1">
                    {Number(question.anulada) === 1 && (
                      <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                        Anulada
                      </span>
                    )}
                    {Number(question.desatualizada) === 1 && (
                      <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                        Desat.
                      </span>
                    )}
                    {question.detailedComment && (
                      <span
                        className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black uppercase"
                        title="Possui Analise Detalhada"
                      >
                        IA
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {question.bancas?.map((banca: any) => banca.sigla).join(' / ') || 'Banca'}
                    </span>
                    <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit">
                      {question.assuntos?.map((subject: any) => (subject.materia ? subject.nome : '')).filter(Boolean).join(', ') || 'Materia'}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(question)}
                      className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(question.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {pagination.total}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="flex items-center px-4 text-[10px] font-black uppercase text-indigo-600">
            Pagina {pagination.page} de {pagination.pages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase disabled:opacity-30"
          >
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminQuestionsSection;
