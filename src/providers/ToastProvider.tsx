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

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Resolve as classes visuais do toast sem depender de CSS-in-JS global.
 * Isso evita estilos stale em HMR e garante que o portal nao sobreponha a tela quando estiver vazio.
 * @since 1.0.0
 */
const getToastToneClassName = (type: ToastType) => {
  switch (type) {
    case 'error':
      return 'bg-rose-600';
    case 'success':
      return 'bg-emerald-600';
    case 'warning':
      return 'bg-amber-500 text-slate-950';
    default:
      return 'bg-sky-600';
  }
};

/**
 * Provider oficial de toasts da arquitetura congelada.
 * Mantem toda a logica visual e temporal centralizada fora dos contexts legados.
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {toasts.length > 0 && createPortal(
        <div className="pointer-events-none fixed bottom-8 right-8 z-[999999] flex max-w-[calc(100vw-2rem)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={[
                'pointer-events-auto flex min-w-[250px] max-w-[400px] items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl',
                'animate-in slide-in-from-right-4 fade-in duration-300',
                getToastToneClassName(toast.type),
              ].join(' ')}
            >
              <span className="leading-relaxed">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-black uppercase tracking-widest text-current/90 transition hover:bg-black/10 hover:text-current"
              >
                Fechar
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
