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
import { ChevronRight, Edit3, Eye } from 'lucide-react';
import {
  getAdminUserRoleBadgeClass,
  getAdminUserRoleLabel,
  getAdminUserStatusBadgeClass,
  getAdminUserStatusLabel,
} from './userAdminOptions';

const getInitials = (name: string) => (
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
);

interface AdminUsersSectionProps {
  users: any[];
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onOpenProfile: (userId: string) => void;
}

/**
 * Lista operacional de usuarios do admin.
 * A tabela resume papel, status, plano e atividade antes de abrir o modal completo.
 *
 * @since 1.0.0
 */
const AdminUsersSection = ({
  users,
  renderSortableHeader,
  onOpenProfile,
}: AdminUsersSectionProps) => {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
          <tr>
            {renderSortableHeader('Usuario', 'name')}
            {renderSortableHeader('Papel e status', 'role')}
            {renderSortableHeader('Plano e meta', 'billing.plan')}
            {renderSortableHeader('Engajamento', 'level')}
            <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {users.map((user) => {
            const progressWidth = Math.min(100, ((Number(user.xp || 0) % 1000) / 1000) * 100);

            return (
              <tr key={user.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {getInitials(user.name)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name}</span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{user.email}</span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">ID: {user.id}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${getAdminUserRoleBadgeClass(user.role)}`}>
                      {getAdminUserRoleLabel(user.role)}
                    </span>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${getAdminUserStatusBadgeClass(user.status)}`}>
                      {getAdminUserStatusLabel(user.status)}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {user.billing?.plan || 'Gratuito'}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Meta: {user.targetExam || 'Nao definida'}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>Nivel {Number(user.level || 0)}</span>
                      <span>{Number(user.xp || 0)} XP</span>
                    </div>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressWidth}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      Reputacao {Number(user.reputation || 0)}/100
                    </span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(user.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="Abrir perfil detalhado"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProfile(user.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="Editar usuario"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProfile(user.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="Abrir operacao completa"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-400 italic dark:text-slate-600">
                Nenhum usuario encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersSection;
