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
import Link from 'next/link';
import { FileText, Link2 } from 'lucide-react';
import type { Prova } from '@types';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import { ADMIN_PAGE_PANEL_CLASS, ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';
import { buildAdminExamEditPath } from '../../config/adminPageNavigationConfig';

interface AdminExamBankSectionProps {
  exams: Prova[];
  totalExams: number;
  linkedCountByExamId: Map<string, number>;
  filter: string;
  onFilterChange: (value: string) => void;
  deletingExam: Prova | null;
  onRequestDelete: (exam: Prova) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  actionLoading: 'save' | 'delete' | null;
}

/**
 * Lista e edita o banco de provas da operacao.
 * A secao centraliza os vinculos usados no modal de questoes.
 *
 * @since 1.0.0
 */
const AdminExamBankSection = ({
  exams,
  totalExams,
  linkedCountByExamId,
  filter,
  onFilterChange,
  deletingExam,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  actionLoading,
}: AdminExamBankSectionProps) => {
  const totalLinkedQuestions = Array.from(linkedCountByExamId.values()).reduce((sum, current) => sum + current, 0);

  return (
    <div className="space-y-5">
      <AdminCollectionToolbar
        title="Banco de provas"
        description="Cadastro global de provas para vinculo, busca e manutencao editorial."
        itemCount={totalExams}
        itemCountLabel="provas"
        searchValue={filter}
        onSearchChange={onFilterChange}
        searchPlaceholder="Buscar provas..."
        primaryActionLabel="Adicionar nova"
        primaryActionHref={buildAdminExamEditPath('new')}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Banco de provas</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{totalExams}</p>
        </div>
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Questoes vinculadas</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{totalLinkedQuestions}</p>
        </div>
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Uso principal</p>
          <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">Vinculo rapido no editar questao</p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">A busca de prova usa este mesmo cadastro.</p>
        </div>
      </div>

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-black text-slate-900 dark:text-slate-100">Lista de provas cadastradas</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Use editar para ajustar o cadastro e deletar para remover o vinculo do banco global.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Prova</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Banca</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Orgao</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Cargo</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vinculos</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Visibilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{exam.nome}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        #{exam.id} {exam.ano ? `- ${exam.ano}` : ''} {exam.nivel ? `- ${exam.nivel}` : ''}
                      </span>
                      {(exam.caderno || exam.tipoCaderno || exam.corCaderno || exam.bookletType || exam.bookletColor) ? (
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                          {exam.caderno || [exam.tipoCaderno || exam.bookletType, exam.corCaderno || exam.bookletColor].filter(Boolean).join(' - ')}
                        </span>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <Link
                          href={buildAdminExamEditPath(exam.id)}
                          className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          Editar
                        </Link>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={() => onRequestDelete(exam)}
                          className="font-medium text-red-600 hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
                        >
                          Lixeira
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{exam.banca?.sigla || exam.banca?.nome || '-'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{exam.orgao?.sigla || exam.orgao?.nome || '-'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{exam.cargo?.descricao || exam.cargo?.['descrição'] || '-'}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <Link2 size={12} />
                      {linkedCountByExamId.get(String(exam.id)) || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <AdminPublishStateBadge state={resolveAdminPublishState(exam as unknown as Record<string, unknown>)} />
                  </td>
                </tr>
              ))}

              {exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                      <FileText size={20} />
                      <p className="text-sm font-black">Nenhuma prova encontrada</p>
                      <p className="text-xs font-medium">As provas vinculadas nas questoes passarao a aparecer aqui.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={Boolean(deletingExam)}
        title="Remover prova do banco"
        description={`A prova "${deletingExam?.nome || ''}" sera removida do cadastro global e o vinculo sera limpo das questoes que usam este ID.`}
        confirmLabel="Remover prova"
        loading={actionLoading === 'delete'}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </div>
  );
};

export default AdminExamBankSection;
