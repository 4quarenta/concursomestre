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
import {
  AUTH_SESSION_EXPIRED_EVENT,
  AUTH_SESSION_EXPIRED_MESSAGE,
  AUTH_SESSION_EXPIRED_TOAST_KEY,
  type AuthSessionExpiredNoticeDetail,
  isSessionExpiredMessage,
} from '@services/auth/sessionExpiredNotice';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastAction = {
  label: string;
  onClick: () => void;
};

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
  dedupeKey?: string;
}

type ToastOptions = {
  action?: ToastAction;
  durationMs?: number;
  dedupeKey?: string;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
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

  const startLoginRecovery = useCallback(() => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!currentPath.startsWith('/auth')) {
      window.sessionStorage.setItem('redirectAfterLogin', currentPath);
    }

    window.location.assign('/auth');
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', options: ToastOptions = {}) => {
    const isSessionExpiredToast = isSessionExpiredMessage(message);
    const nextMessage = isSessionExpiredToast ? AUTH_SESSION_EXPIRED_MESSAGE : message;
    const nextType = isSessionExpiredToast ? 'warning' : type;
    const nextOptions: ToastOptions = isSessionExpiredToast
      ? {
          ...options,
          action: {
            label: 'Entrar novamente',
            onClick: startLoginRecovery,
          },
          dedupeKey: AUTH_SESSION_EXPIRED_TOAST_KEY,
          durationMs: options.durationMs ?? 12000,
        }
      : options;

    const id = Date.now() + Math.round(Math.random() * 1000);
    let shouldScheduleRemoval = true;

    setToasts((prev) => {
      if (nextOptions.dedupeKey && prev.some((toast) => toast.dedupeKey === nextOptions.dedupeKey)) {
        shouldScheduleRemoval = false;
        return prev;
      }

      return [...prev, {
        id,
        message: nextMessage,
        type: nextType,
        action: nextOptions.action,
        dedupeKey: nextOptions.dedupeKey,
      }];
    });

    if (shouldScheduleRemoval && nextOptions.durationMs !== 0) {
      setTimeout(() => removeToast(id), nextOptions.durationMs ?? 5000);
    }
  }, [removeToast, startLoginRecovery]);

  React.useEffect(() => {
    const handleAuthSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent<AuthSessionExpiredNoticeDetail>;
      addToast(customEvent.detail?.message || AUTH_SESSION_EXPIRED_MESSAGE, 'warning');
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);
    };
  }, [addToast]);

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
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="shrink-0 rounded-md bg-white/20 px-2 py-1 text-xs font-black uppercase tracking-widest text-current transition hover:bg-white/30"
                >
                  {toast.action.label}
                </button>
              ) : null}
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
