import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveCanonicalAuthRedirectPath } from '@services/auth/canonicalAuthRedirect';
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
  const canonicalAuthRedirect = resolveCanonicalAuthRedirectPath('/', resolvedSearchParams || {});
  if (canonicalAuthRedirect) {
    redirect(canonicalAuthRedirect);
  }

  const hasSessionHint = await hasAuthSessionHint();

  if (!hasSessionHint) {
    return <LandingPage />;
  }

  return <HomePageClient />;
}
