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

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isProcessing?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirmar a\u00E7\u00E3o',
  description = 'Voc\u00EA tem certeza que deseja prosseguir?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'info',
  isProcessing = false,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirstControl = () => {
      const firstControl = dialog?.querySelector<HTMLElement>(focusableSelector);
      firstControl?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const frameId = window.requestAnimationFrame(focusFirstControl);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 size={32} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={32} className="text-amber-500" />;
      default:
        return <Info size={32} className="text-indigo-500" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 shadow-red-100 dark:shadow-none';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 shadow-amber-100 dark:shadow-none';
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-500 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 shadow-inner dark:border-slate-700 dark:bg-slate-800">
            {getIcon()}
          </div>

          <div className="space-y-2">
            <h3 id={titleId} className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
            <p id={descriptionId} className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="h-14 rounded-2xl border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className={`h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 shadow-lg disabled:cursor-not-allowed disabled:opacity-70 ${getButtonClass()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default React.memo(ConfirmModal);
