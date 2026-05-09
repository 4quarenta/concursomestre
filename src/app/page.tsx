import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomePageClient from './HomePageClient';
import LandingPage from './landing/LandingPage';

const AUTH_CSRF_COOKIE_NAME = 'cm_csrf';

/**
 * O refresh cookie fica restrito ao path da API e nao aparece em `/`.
 * Aqui usamos o cookie CSRF, que e visivel na raiz, apenas como sinal de que
 * a sessao pode estar sendo retomada apos hard refresh.
 *
 * @since 1.0.0
 */
const hasAuthSessionHint = async () => {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(AUTH_CSRF_COOKIE_NAME)?.value);
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

const readQueryValue = (searchParams: HomeSearchParams, key: string): string => {
  const raw = searchParams[key];
  if (Array.isArray(raw)) {
    return String(raw[0] || '').trim();
  }
  return String(raw || '').trim();
};

const pickFirstNonEmpty = (...values: string[]) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return '';
};

const normalizeMode = (value: string) => String(value || '').trim().toLowerCase();

const resolveCanonicalAuthRedirect = (searchParams: HomeSearchParams): string | null => {
  const mode = normalizeMode(readQueryValue(searchParams, 'mode'));
  const action = normalizeMode(readQueryValue(searchParams, 'action'));
  const email = pickFirstNonEmpty(
    readQueryValue(searchParams, 'email'),
    readQueryValue(searchParams, 'mail'),
  );

  const resetToken = pickFirstNonEmpty(
    readQueryValue(searchParams, 'resetToken'),
    readQueryValue(searchParams, 'reset_token'),
    readQueryValue(searchParams, 'passwordResetToken'),
    readQueryValue(searchParams, 'password_reset'),
    readQueryValue(searchParams, 'password_reset_token'),
    readQueryValue(searchParams, 'resetPasswordToken'),
    readQueryValue(searchParams, 'recover_token'),
    readQueryValue(searchParams, 'token_reset'),
  );

  const verificationToken = pickFirstNonEmpty(
    readQueryValue(searchParams, 'verifyToken'),
    readQueryValue(searchParams, 'verificationToken'),
    readQueryValue(searchParams, 'verify_token'),
    readQueryValue(searchParams, 'token_verification'),
    readQueryValue(searchParams, 'confirmation_token'),
    readQueryValue(searchParams, 'email_verification_token'),
    readQueryValue(searchParams, 'activation_token'),
    readQueryValue(searchParams, 'confirm_token'),
    readQueryValue(searchParams, 'email_confirm_token'),
  );

  const genericToken = readQueryValue(searchParams, 'token');

  const isResetMode = ['reset', 'reset-password', 'forgot-password', 'forgot'].includes(mode)
    || ['reset', 'password_reset', 'reset_password', 'forgot_password'].includes(action);
  const isVerificationMode = ['confirm-email', 'verify-email', 'activation', 'activate', 'confirm'].includes(mode)
    || ['confirm_email', 'verify_email', 'activate_account', 'activation', 'confirm-account', 'confirm_account'].includes(action);

  const effectiveResetToken = pickFirstNonEmpty(resetToken, isResetMode ? genericToken : '');
  if (effectiveResetToken) {
    const params = new URLSearchParams();
    params.set('token', effectiveResetToken);
    if (email) {
      params.set('email', email);
    }
    return `/reset-password?${params.toString()}`;
  }

  const effectiveVerificationToken = pickFirstNonEmpty(
    verificationToken,
    isVerificationMode ? genericToken : '',
    genericToken && !effectiveResetToken ? genericToken : '',
  );
  if (effectiveVerificationToken) {
    const params = new URLSearchParams();
    params.set('token', effectiveVerificationToken);
    return `/confirm-email?${params.toString()}`;
  }

  return null;
};

/**
 * Rota raiz da plataforma.
 * Visitante anonimo recebe a landing comercial; sessao em retomada recebe shell leve
 * e o cliente conclui o roteamento para dashboard ou landing apos o bootstrap de auth.
 *
 * @since 1.0.0
 */
export default async function HomePage({
  searchParams = {},
}: {
  searchParams?: Promise<HomeSearchParams> | HomeSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const canonicalAuthRedirect = resolveCanonicalAuthRedirect(resolvedSearchParams || {});
  if (canonicalAuthRedirect) {
    redirect(canonicalAuthRedirect);
  }

  const hasSessionHint = await hasAuthSessionHint();

  if (!hasSessionHint) {
    return <LandingPage />;
  }

  return <HomePageClient />;
}
