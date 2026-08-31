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
import type { UserProfile } from '@types';
import {
  getAdminUserRoleBadgeClass,
  getAdminUserRoleLabel,
  getAdminUserStatusBadgeClass,
  getAdminUserStatusLabel,
} from './userAdminOptions';
import { ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import { buildAdminUserEditPath } from '../../config/adminPageNavigationConfig';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';

const getInitials = (name: string) => (
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
);

interface AdminUsersSectionProps {
  users: UserProfile[];
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onOpenProfile: (userId: string) => void;
  onDeleteUser: (user: UserProfile) => Promise<unknown> | unknown;
}

/**
 * Lista operacional de usuarios do admin.
 * A tabela resume papel, status, plano e atividade antes de abrir o modal completo.
 *
 * @since 1.0.0
 */
const AdminUsersSection = ({
  users,
  filter,
  onFilterChange,
  renderSortableHeader,
  onOpenProfile,
  onDeleteUser,
}: AdminUsersSectionProps) => {
  const [pendingDeleteUser, setPendingDeleteUser] = React.useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = React.useState(false);

  const requestDeleteUser = (user: UserProfile) => {
    setPendingDeleteUser(user);
  };

  const cancelDeleteUser = () => {
    if (!isDeletingUser) {
      setPendingDeleteUser(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser || isDeletingUser) {
      return;
    }

    setIsDeletingUser(true);
    try {
      await onDeleteUser(pendingDeleteUser);
      setPendingDeleteUser(null);
    } catch {
      // O controller superior exibe o toast; manter aberto permite nova tentativa.
    } finally {
      setIsDeletingUser(false);
    }
  };

  const pendingDeleteUserLabel = String(
    pendingDeleteUser?.name || pendingDeleteUser?.email || pendingDeleteUser?.id || 'usuario selecionado',
  );

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Usuarios"
        description="Base de contas, papeis, planos e engajamento da plataforma."
        itemCount={users.length}
        itemCountLabel="usuarios"
        searchValue={filter}
        onSearchChange={onFilterChange}
        searchPlaceholder="Buscar usuarios..."
        primaryActionLabel="Adicionar usuario"
        primaryActionHref={buildAdminUserEditPath('new')}
      />

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden transition-colors duration-300`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Usuarios da plataforma</p>
        </div>
        <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-xs">
        <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
          <tr>
            {renderSortableHeader('Usuario', 'name')}
            {renderSortableHeader('Papel e status', 'role')}
            {renderSortableHeader('Plano e meta', 'billing.plan')}
            {renderSortableHeader('Engajamento', 'level')}
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
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(String(user.id))}
                          className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          Ver
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <Link
                          href={buildAdminUserEditPath(user.id)}
                          className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          Editar
                        </Link>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={() => requestDeleteUser(user)}
                          className="font-medium text-red-600 hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
                        >
                          Lixeira
                        </button>
                      </div>
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
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-slate-400 italic dark:text-slate-600">
                Nenhum usuario encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={Boolean(pendingDeleteUser)}
        title="Remover usuario"
        description={`O usuario "${pendingDeleteUserLabel}" sera removido da listagem administrativa e tera o acesso desativado. O historico permanece preservado para auditoria.`}
        confirmLabel="Remover usuario"
        cancelLabel="Cancelar"
        tone="danger"
        loading={isDeletingUser}
        onCancel={cancelDeleteUser}
        onConfirm={() => void confirmDeleteUser()}
      />
    </div>
  );
};

export default AdminUsersSection;
