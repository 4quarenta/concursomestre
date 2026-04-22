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
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
            <tr>
              {renderSortableHeader('Questao', 'enunciado_clean')}
              <th className="p-4">ID</th>
              <th className="p-4">Comentario</th>
              <th className="p-4">Analise detalhada</th>
              <th className="p-4">Prova vinculada</th>
              <th className="p-4">Ano</th>
              <th className="p-4">Status</th>
              {renderSortableHeader('Banca/Materia', 'banca')}
              <th className="p-4 text-center">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {questions.map((question: any) => {
              const hasComment = Boolean(
                question?.hasTeacherComment ||
                  question?.teacherComment ||
                  (Number(question?.commentsCount) || 0) > 0 ||
                  (Array.isArray(question?.comments) && question.comments.length > 0),
              );

              const hasDetailedAnalysis = Boolean(
                question?.hasDetailedComment ||
                  question?.detailedComment ||
                  question?.comentarios?.ia,
              );

              const linkedExam = Array.isArray(question?.provas) && question.provas.length > 0
                ? question.provas[0]
                : null;

              const linkedExamName = linkedExam?.nome || '-';
              const linkedYear = linkedExam?.ano
                ?? (Array.isArray(question?.anos) && question.anos.length > 0
                  ? Math.max(...question.anos.map((year: any) => Number(year) || 0))
                  : null);

              return (
                <tr key={question.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="max-w-[260px] truncate p-4 font-medium text-slate-900 dark:text-slate-100 sm:max-w-md">
                    {question.enunciado_clean || question.text}
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                    #{question.id ?? '-'}
                  </td>

                  <td className="p-4">
                    {hasComment ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                        Sim
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(question)}
                        className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                        title="Gerar comentario"
                      >
                        Gerar
                      </button>
                    )}
                  </td>

                  <td className="p-4">
                    {hasDetailedAnalysis ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                        Sim
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(question)}
                        className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                        title="Gerar analise detalhada"
                      >
                        Gerar
                      </button>
                    )}
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300 max-w-[220px] truncate" title={linkedExamName}>
                    {linkedExamName}
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300">
                    {linkedYear || '-'}
                  </td>

                  <td className="p-4">
                    <div className="flex gap-1">
                      {Number(question.anulada) === 1 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          Anulada
                        </span>
                      )}
                      {Number(question.desatualizada) === 1 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          Desat.
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {question.bancas?.map((banca: any) => banca.sigla).join(' / ') || 'Banca'}
                      </span>
                      <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {question.assuntos
                          ?.map((subject: any) => (subject.materia ? subject.nome : ''))
                          .filter(Boolean)
                          .join(', ') || 'Materia'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(question)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(question.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">Mostrando {questions.length} de {pagination.total} questoes</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Anterior
          </button>
          <span className="flex items-center px-4 text-sm font-semibold text-blue-600 dark:text-blue-300">
            Pagina {pagination.page} de {pagination.pages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminQuestionsSection;
