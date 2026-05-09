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
import type { Ranking } from '@types';
import { ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';

interface AdminRankingsSectionProps {
  rankings: Ranking[];
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onEdit: (ranking: Ranking) => void;
}

/**
 * Lista os rankings publicados com acoes de linha no padrao WordPress.
 * A secao fica em Suporte porque rankings exigem revisao operacional recorrente.
 *
 * @since 1.0.0
 */
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
            <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
              <tr>
                {renderSortableHeader('Ranking', 'name')}
                {renderSortableHeader('Instituicao', 'institution')}
                {renderSortableHeader('Vagas/Reserva', 'vacancies')}
                {renderSortableHeader('Inscritos', 'entries.length')}
                {renderSortableHeader('Status', 'keyStatus')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {rankings.map((ranking) => (
                <tr key={ranking.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{ranking.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(ranking.createdAt).toLocaleDateString()}</span>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => onEdit(ranking)}
                          className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{ranking.institution}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {(Number(ranking.vacanciesAc || 0) + Number(ranking.vacanciesAfro || 0) + Number(ranking.vacanciesPcd || 0))} + {ranking.reserveLimit}
                  </td>
                  <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{ranking.entries?.length || 0}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <AdminPublishStateBadge state={resolveAdminPublishState(ranking as unknown as Record<string, unknown>)} />
                      <span className={`w-fit rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${ranking.keyStatus === 'official' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                        {ranking.keyStatus === 'official' ? 'Gabarito oficial' : 'Preliminar'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {rankings.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center italic text-slate-400 dark:text-slate-600">Nenhum ranking cadastrado.</td>
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
