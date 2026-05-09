import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const normalizeMode = (value: string | null) => String(value || '').trim().toLowerCase();

const pickFirstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue.length > 0) {
      return normalizedValue;
    }
  }

  return '';
};

const resolveCanonicalAuthRedirect = (request: NextRequest): URL | null => {
  const pathname = request.nextUrl.pathname;

  if (pathname !== '/' && pathname !== '/auth') {
    return null;
  }

  const searchParams = request.nextUrl.searchParams;
  const mode = normalizeMode(searchParams.get('mode'));
  const action = normalizeMode(searchParams.get('action'));
  const email = pickFirstNonEmpty(searchParams.get('email'), searchParams.get('mail'));

  const resetToken = pickFirstNonEmpty(
    searchParams.get('resetToken'),
    searchParams.get('reset_token'),
    searchParams.get('passwordResetToken'),
    searchParams.get('password_reset'),
    searchParams.get('password_reset_token'),
    searchParams.get('resetPasswordToken'),
    searchParams.get('recover_token'),
    searchParams.get('token_reset'),
  );

  const verificationToken = pickFirstNonEmpty(
    searchParams.get('verifyToken'),
    searchParams.get('verificationToken'),
    searchParams.get('verify_token'),
    searchParams.get('token_verification'),
    searchParams.get('confirmation_token'),
    searchParams.get('email_verification_token'),
    searchParams.get('activation_token'),
    searchParams.get('confirm_token'),
    searchParams.get('email_confirm_token'),
  );

  const genericToken = pickFirstNonEmpty(searchParams.get('token'));
  const isResetMode = ['reset', 'reset-password', 'forgot-password', 'forgot'].includes(mode)
    || ['reset', 'password_reset', 'reset_password', 'forgot_password'].includes(action);
  const isVerificationMode = ['confirm-email', 'verify-email', 'activation', 'activate', 'confirm'].includes(mode)
    || ['confirm_email', 'verify_email', 'activate_account', 'activation', 'confirm-account', 'confirm_account'].includes(action);

  const effectiveResetToken = pickFirstNonEmpty(resetToken, isResetMode ? genericToken : '');
  if (effectiveResetToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/reset-password';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('token', effectiveResetToken);
    if (email) {
      redirectUrl.searchParams.set('email', email);
    }
    return redirectUrl;
  }

  const effectiveVerificationToken = pickFirstNonEmpty(
    verificationToken,
    isVerificationMode ? genericToken : '',
    genericToken && !effectiveResetToken ? genericToken : '',
  );
  if (effectiveVerificationToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/confirm-email';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('token', effectiveVerificationToken);
    return redirectUrl;
  }

  return null;
};

export function middleware(request: NextRequest) {
  const redirectUrl = resolveCanonicalAuthRedirect(request);
  if (!redirectUrl) {
    return NextResponse.next();
  }

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/', '/auth'],
};
