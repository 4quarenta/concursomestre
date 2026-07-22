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
import {
  ADMIN_COLLECTION_TABLE_CLASS,
  ADMIN_COLLECTION_TABLE_HEAD_CLASS,
  ADMIN_COLLECTION_TABLE_ROW_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import AdminCollectionPagination from '../shared/AdminCollectionPagination';
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

const COLLECTION_PAGE_SIZE = 20;

/**
 * Lista e edita o banco de provas da operação.
 * A seção centraliza os vínculos usados no modal de questões.
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
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(exams.length / COLLECTION_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleExams = React.useMemo(
    () => exams.slice((currentPage - 1) * COLLECTION_PAGE_SIZE, currentPage * COLLECTION_PAGE_SIZE),
    [currentPage, exams],
  );

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Banco de provas"
        description="Cadastro canônico de provas salvo no banco de dados, com vínculos, arquivos e metadados editoriais."
        itemCount={totalExams}
        itemCountLabel="provas"
        searchValue={filter}
        onSearchChange={(value) => {
          setPage(1);
          onFilterChange(value);
        }}
        searchPlaceholder="Buscar provas..."
        primaryActionLabel="Adicionar nova"
        primaryActionHref={buildAdminExamEditPath('new')}
      />

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Banco principal de provas</p>
        </div>

        <div className="overflow-x-auto">
          <table className={ADMIN_COLLECTION_TABLE_CLASS}>
            <thead className={ADMIN_COLLECTION_TABLE_HEAD_CLASS}>
              <tr>
                <th className="p-4">Prova</th>
                <th className="p-4">Banca</th>
                <th className="p-4">Órgão</th>
                <th className="p-4">Cargo</th>
                <th className="p-4">Vínculos</th>
                <th className="p-4">Publicação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleExams.map((exam) => (
                <tr key={exam.id} className={ADMIN_COLLECTION_TABLE_ROW_CLASS}>
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
                          Arquivar
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
                      <p className="text-xs font-medium">Cadastre uma prova para vincular questões, arquivos e taxonomias oficiais.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AdminCollectionPagination
        visibleCount={visibleExams.length}
        totalCount={exams.length}
        itemLabel="provas"
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AdminConfirmDialog
        isOpen={Boolean(deletingExam)}
        title="Arquivar prova"
        description={`A prova "${deletingExam?.nome || ''}" será removida da listagem principal, mas o histórico continuará preservado no banco.`}
        confirmLabel="Arquivar prova"
        loading={actionLoading === 'delete'}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </div>
  );
};

export default AdminExamBankSection;
