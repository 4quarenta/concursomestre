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

interface AdminRankingsSectionProps {
  rankings: any[];
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onEdit: (ranking: any) => void;
}

const AdminRankingsSection = ({
  rankings,
  renderSortableHeader,
  onEdit,
}: AdminRankingsSectionProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
          <tr>
            {renderSortableHeader('Ranking', 'name')}
            {renderSortableHeader('InstituiÃ§Ã£o', 'institution')}
            {renderSortableHeader('Vagas/Reserva', 'vacancies')}
            {renderSortableHeader('Inscritos', 'entries.length')}
            {renderSortableHeader('Status', 'keyStatus')}
            <th className="p-4 text-center">AÃ§Ãµes</th>
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
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${ranking.keyStatus === 'official' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                  {ranking.keyStatus === 'official' ? 'Gabarito Oficial' : 'Preliminar'}
                </span>
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
  );
};

export default AdminRankingsSection;
