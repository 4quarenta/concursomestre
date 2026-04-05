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

interface GroupedReport {
  id: string;
  targetId: string | number;
  targetType: ErrorReport['targetType'];
  reports: ErrorReport[];
  lastReport: ErrorReport;
}

interface AdminReportsSectionProps {
  reports: GroupedReport[];
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  getReportTargetBadgeClass: (targetType: ErrorReport['targetType']) => string;
  getReportTargetLabel: (targetType: ErrorReport['targetType']) => string;
  onInspect: (report: ErrorReport) => void;
  onResolve: (report: ErrorReport) => void;
}

const AdminReportsSection = ({
  reports,
  renderSortableHeader,
  getReportTargetBadgeClass,
  getReportTargetLabel,
  onInspect,
  onResolve,
}: AdminReportsSectionProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
          <tr>
            {renderSortableHeader('Alvo', 'targetType')}
            {renderSortableHeader('Motivo', 'lastReport.reason')}
            <th className="p-4">Detalhes</th>
            {renderSortableHeader('UsuÃ¡rio', 'lastReport.userName')}
            <th className="p-4">Prova</th>
            <th className="p-4 text-center">AÃ§Ãµes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {reports.map((group) => (
            <tr key={group.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-500">
              <td className="p-4">
                <div className="flex flex-col gap-1">
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase w-fit ${getReportTargetBadgeClass(group.targetType)}`}>
                    {getReportTargetLabel(group.targetType)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">ID: {group.targetId}</span>
                  {group.reports.length > 1 && (
                    <span className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1">
                      <AlertTriangle size={10} /> {group.reports.length} DenÃºncias
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{group.lastReport.reason}</span>
                  {group.reports.length > 1 && <span className="text-[10px] text-slate-400">Ãšltima: {new Date(group.lastReport.timestamp).toLocaleDateString()}</span>}
                </div>
              </td>
              <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">{group.lastReport.details}</td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{group.lastReport.userName}</span>
                  {group.reports.length > 1 && <span className="text-[10px] text-slate-400">+{group.reports.length - 1} outros</span>}
                </div>
              </td>
              <td className="p-4">
                {group.lastReport.evidenceUrl ? (
                  <a href={group.lastReport.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                    <ImageIcon size={20} />
                  </a>
                ) : (
                  <span className="text-slate-300 dark:text-slate-700">-</span>
                )}
              </td>
              <td className="p-4">
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onInspect(group.lastReport)}
                    className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"
                  >
                    <Shield size={14} /> {group.targetType === 'comment' ? 'Inspecionar' : 'Moderar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(group.lastReport)}
                    className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"
                  >
                    <CheckCircle2 size={14} /> Resolver
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {reports.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">Nenhuma denÃºncia pendente.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminReportsSection;
