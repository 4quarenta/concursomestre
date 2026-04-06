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
import { Edit3, Eye } from 'lucide-react';

interface AdminUsersSectionProps {
  users: any[];
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onOpenProfile: (userId: string) => void;
}

const AdminUsersSection = ({
  users,
  renderSortableHeader,
  onOpenProfile,
}: AdminUsersSectionProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
          <tr>
            {renderSortableHeader('Usuário', 'name')}
            {renderSortableHeader('Cargo/Plano', 'billing.plan')}
            {renderSortableHeader('Estatisticas', 'level')}
            <th className="p-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{user.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{user.email}</span>
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {user.targetExam || 'N/I'}
                  </span>
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit">
                    {user.billing?.plan || 'Gratuito'}
                  </span>
                </div>
              </td>
              <td className="p-4">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Nivel {user.level} ? {user.xp} XP
                </div>
                <div className="w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (user.xp % 1000) / 10)}%` }} />
                </div>
              </td>
              <td className="p-4 text-center">
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(user.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
                    title="Ver Perfil Completo"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(user.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">
                Nenhum usuário encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersSection;
