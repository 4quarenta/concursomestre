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
import { Edit3 } from 'lucide-react';
import { ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';

interface AdminRankingsSectionProps {
  rankings: any[];
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onEdit: (ranking: any) => void;
}

const AdminRankingsSection = ({
  rankings,
  filter,
  onFilterChange,
  renderSortableHeader,
  onEdit,
}: AdminRankingsSectionProps) => {
  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Rankings"
        description="Editais publicados, gabaritos e configuracoes operacionais de ranking."
        itemCount={rankings.length}
        itemCountLabel="rankings"
        searchValue={filter}
        onSearchChange={onFilterChange}
        searchPlaceholder="Buscar rankings..."
      />

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden animate-slide-up transition-colors duration-300`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rankings publicados</p>
        </div>
        <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
          <tr>
            {renderSortableHeader('Ranking', 'name')}
            {renderSortableHeader('Instituição', 'institution')}
            {renderSortableHeader('Vagas/Reserva', 'vacancies')}
            {renderSortableHeader('Inscritos', 'entries.length')}
            {renderSortableHeader('Status', 'keyStatus')}
            <th className="p-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {rankings.map((ranking) => (
            <tr key={ranking.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{ranking.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(ranking.createdAt).toLocaleDateString()}</span>
                </div>
              </td>
              <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{ranking.institution}</td>
              <td className="p-4 text-slate-600 dark:text-slate-400">{ranking.vacancies} + {ranking.reserveLimit}</td>
              <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{ranking.entries?.length || 0}</td>
              <td className="p-4">
                <div className="flex flex-col gap-1">
                  <AdminPublishStateBadge state={resolveAdminPublishState(ranking as Record<string, any>)} />
                  <span className={`w-fit rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${ranking.keyStatus === 'official' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                    {ranking.keyStatus === 'official' ? 'Gabarito oficial' : 'Preliminar'}
                  </span>
                </div>
              </td>
              <td className="p-4 text-center">
                <button
                  type="button"
                  onClick={() => onEdit(ranking)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors group"
                >
                  <Edit3 size={14} className="group-hover:scale-110 transition-transform" />
                </button>
              </td>
            </tr>
          ))}
          {rankings.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">Nenhum ranking cadastrado.</td>
            </tr>
          )}
        </tbody>
      </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRankingsSection;
