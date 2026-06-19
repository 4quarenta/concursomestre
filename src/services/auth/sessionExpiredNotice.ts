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

export const AUTH_SESSION_EXPIRED_EVENT = 'concursomestre:auth-session-expired';
export const AUTH_SESSION_EXPIRED_TOAST_KEY = 'auth-session-expired';
export const AUTH_SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar de onde parou.';

export type AuthSessionExpiredNoticeDetail = {
  message?: string;
  status?: number;
  url?: string;
};

export const isSessionExpiredMessage = (message: string) => {
  const normalized = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return normalized.includes('sessao invalida')
    || normalized.includes('sessao expirada')
    || normalized.includes('faca login novamente');
};

export const dispatchAuthSessionExpiredNotice = (detail: AuthSessionExpiredNoticeDetail = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<AuthSessionExpiredNoticeDetail>(AUTH_SESSION_EXPIRED_EVENT, {
    detail: {
      message: AUTH_SESSION_EXPIRED_MESSAGE,
      ...detail,
    },
  }));
};
