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
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';

interface AdminConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/**
 * Modal padrao de confirmacao do admin.
 * Centraliza confirmacoes destrutivas em modal oficial.
 * e manter feedback visual, loading e foco no contexto da acao.
 *
 * @since 1.0.0
 */
export const AdminConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Voltar',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: AdminConfirmDialogProps) => {
  const titleId = React.useId();
  const descriptionId = React.useId();

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm">
      <div
        className={`${ADMIN_MODAL_PANEL_CLASS} w-full max-w-md`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex items-start gap-4 px-5 py-4`}>
          <div className={`rounded-sm p-2 ${tone === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300'}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-1">
            <h3 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p id={descriptionId} className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>

        {children}
        <div className="flex items-center justify-end gap-3 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`${tone === 'danger' ? 'border-red-700 bg-red-700 hover:border-red-800 hover:bg-red-800' : ''} ${ADMIN_PRIMARY_BUTTON_CLASS} min-w-[132px] justify-center`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? 'Processando' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AdminConfirmDialog;
