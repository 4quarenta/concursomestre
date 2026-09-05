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
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Shield } from 'lucide-react';
import type { ErrorReport } from '@types';
import { ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import { AdminDataTable, AdminRowActions } from '../shared/AdminDesignSystem';
import type { GroupedReport } from './reportModeration';

const REPORTS_PAGE_SIZE = 10;

interface AdminReportsSectionProps {
  reports: GroupedReport[];
  totalReportCount?: number;
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  getReportTargetBadgeClass: (targetType: ErrorReport['targetType']) => string;
  getReportTargetLabel: (targetType: ErrorReport['targetType']) => string;
  onInspect: (group: GroupedReport) => void;
  onResolve: (group: GroupedReport) => void;
}

const AdminReportsSection = ({
  reports,
  totalReportCount,
  filter,
  onFilterChange,
  renderSortableHeader,
  getReportTargetBadgeClass,
  getReportTargetLabel,
  onInspect,
  onResolve,
}: AdminReportsSectionProps) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const totalDenuncias = Number(totalReportCount ?? reports.reduce((total, group) => total + group.reports.length, 0));
  const totalPages = Math.max(1, Math.ceil(reports.length / REPORTS_PAGE_SIZE));
  const visibleReports = React.useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * REPORTS_PAGE_SIZE;
    return reports.slice(start, start + REPORTS_PAGE_SIZE);
  }, [currentPage, reports, totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Denúncias"
        description="Fila de revisão e moderação de conteúdos sinalizados pelos usuários."
        itemCount={reports.length}
        itemCountLabel={totalDenuncias === reports.length ? 'denúncias' : `grupo(s) · ${totalDenuncias} denúncia(s)`}
        searchValue={filter}
        onSearchChange={onFilterChange}
        searchPlaceholder="Buscar denúncias..."
      />

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden animate-slide-up transition-colors duration-300`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fila de denúncias</p>
        </div>

        <AdminDataTable label="Fila de denúncias">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
              <tr>
                {renderSortableHeader('Alvo', 'targetType')}
                {renderSortableHeader('Motivo', 'lastReport.reason')}
                <th className="p-4">Detalhes</th>
                {renderSortableHeader('Usuário', 'lastReport.userName')}
                <th className="p-4">Prova</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {visibleReports.map((group) => (
                <tr key={group.id} className="transition-colors duration-500 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`w-fit rounded px-2 py-1 text-[9px] font-black uppercase ${getReportTargetBadgeClass(group.targetType)}`}>
                        {getReportTargetLabel(group.targetType)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">ID: {group.targetId}</span>
                      {group.reports.length > 1 ? (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-500">
                          <AlertTriangle size={10} /> {group.reports.length} denúncias
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{group.lastReport.reason}</span>
                      {group.reports.length > 1 ? (
                        <span className="text-[10px] text-slate-400">
                          Última: {new Date(group.lastReport.timestamp).toLocaleDateString('pt-BR')}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    <div className="max-w-xs space-y-1">
                      <p className="truncate">{group.lastReport.details || '-'}</p>
                      {group.lastReport.targetContent ? (
                        <p className="line-clamp-2 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                          {group.lastReport.targetContent}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-500 dark:text-slate-400">{group.lastReport.userName}</span>
                      {group.reports.length > 1 ? <span className="text-[10px] text-slate-400">+{group.reports.length - 1} outros</span> : null}
                    </div>
                  </td>
                  <td className="p-4">
                    {group.lastReport.evidenceUrl ? (
                      <a href={group.lastReport.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                        <ImageIcon size={20} />
                      </a>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <AdminRowActions label="Ações da denúncia">
                      <button
                        type="button"
                        onClick={() => onInspect(group)}
                        className="flex items-center gap-1 rounded-lg bg-indigo-50 p-2 text-[9px] font-bold uppercase text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                      >
                        <Shield size={14} /> Moderar
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolve(group)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 p-2 text-[9px] font-bold uppercase text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                      >
                        <CheckCircle2 size={14} /> Resolver
                      </button>
                    </AdminRowActions>
                  </td>
                </tr>
              ))}

              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center italic text-slate-400 dark:text-slate-600">
                    Nenhuma denúncia pendente.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminDataTable>

        {reports.length > REPORTS_PAGE_SIZE ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Página {currentPage} de {totalPages} · {reports.length} alvo(s) · {totalDenuncias} denúncia(s)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Próxima
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminReportsSection;
