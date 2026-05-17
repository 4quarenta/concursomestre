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

export const AUTH_REDIRECT_PATHS = new Set([
  '/',
  '/auth',
  '/activate',
  '/activation',
  '/verify-email',
  '/confirm',
  '/confirm-email',
  '/recover',
  '/forgot-password',
  '/reset',
]);

export const VERIFICATION_ALIAS_PATHS = new Set([
  '/activate',
  '/activation',
  '/verify-email',
  '/confirm',
  '/confirm-email',
]);

export const RESET_ALIAS_PATHS = new Set([
  '/recover',
  '/forgot-password',
  '/reset',
]);

export type CanonicalSearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

const normalizeMode = (value: string) => String(value || '').trim().toLowerCase();

const pickFirstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue.length > 0) {
      return normalizedValue;
    }
  }
  return '';
};

const readSearchParam = (searchParams: CanonicalSearchParams, key: string): string => {
  if (searchParams instanceof URLSearchParams) {
    return String(searchParams.get(key) || '').trim();
  }

  const raw = searchParams[key];
  if (Array.isArray(raw)) {
    return String(raw[0] || '').trim();
  }

  return String(raw || '').trim();
};

const buildRedirectPath = (pathname: string, params: URLSearchParams) => {
  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
};

export const resolveCanonicalAuthRedirectPath = (
  pathname: string,
  searchParams: CanonicalSearchParams,
): string | null => {
  if (!AUTH_REDIRECT_PATHS.has(pathname)) {
    return null;
  }

  const mode = normalizeMode(readSearchParam(searchParams, 'mode'));
  const action = normalizeMode(readSearchParam(searchParams, 'action'));
  const email = pickFirstNonEmpty(
    readSearchParam(searchParams, 'email'),
    readSearchParam(searchParams, 'mail'),
  );

  const resetToken = pickFirstNonEmpty(
    readSearchParam(searchParams, 'resetToken'),
    readSearchParam(searchParams, 'reset_token'),
    readSearchParam(searchParams, 'passwordResetToken'),
    readSearchParam(searchParams, 'password_reset'),
    readSearchParam(searchParams, 'password_reset_token'),
    readSearchParam(searchParams, 'resetPasswordToken'),
    readSearchParam(searchParams, 'recover_token'),
    readSearchParam(searchParams, 'token_reset'),
    readSearchParam(searchParams, 'reset_password_token'),
  );

  const verificationToken = pickFirstNonEmpty(
    readSearchParam(searchParams, 'verifyToken'),
    readSearchParam(searchParams, 'verificationToken'),
    readSearchParam(searchParams, 'verify_token'),
    readSearchParam(searchParams, 'token_verification'),
    readSearchParam(searchParams, 'confirmation_token'),
    readSearchParam(searchParams, 'email_verification_token'),
    readSearchParam(searchParams, 'activation_token'),
    readSearchParam(searchParams, 'confirm_token'),
    readSearchParam(searchParams, 'email_confirm_token'),
    readSearchParam(searchParams, 'verification_code'),
  );

  const genericToken = pickFirstNonEmpty(
    readSearchParam(searchParams, 'token'),
    readSearchParam(searchParams, 'code'),
  );

  const isResetMode = RESET_ALIAS_PATHS.has(pathname)
    || ['reset', 'reset-password', 'forgot-password', 'forgot'].includes(mode)
    || ['reset', 'password_reset', 'reset_password', 'forgot_password'].includes(action);
  const isVerificationMode = VERIFICATION_ALIAS_PATHS.has(pathname)
    || ['confirm-email', 'verify-email', 'activation', 'activate', 'confirm'].includes(mode)
    || ['confirm_email', 'verify_email', 'activate_account', 'activation', 'confirm-account', 'confirm_account'].includes(action);

  const effectiveResetToken = pickFirstNonEmpty(resetToken, isResetMode ? genericToken : '');
  if (effectiveResetToken) {
    const params = new URLSearchParams();
    params.set('token', effectiveResetToken);
    if (email) {
      params.set('email', email);
    }
    return buildRedirectPath('/reset-password', params);
  }

  if (RESET_ALIAS_PATHS.has(pathname)) {
    const params = new URLSearchParams();
    if (email) {
      params.set('email', email);
    }
    return buildRedirectPath('/reset-password', params);
  }

  const effectiveVerificationToken = pickFirstNonEmpty(
    verificationToken,
    isVerificationMode ? genericToken : '',
    genericToken && !effectiveResetToken ? genericToken : '',
  );
  if (effectiveVerificationToken) {
    const params = new URLSearchParams();
    params.set('token', effectiveVerificationToken);
    return buildRedirectPath('/confirm-email', params);
  }

  if (VERIFICATION_ALIAS_PATHS.has(pathname)) {
    return '/confirm-email';
  }

  return null;
};
