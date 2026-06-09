'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Hammer, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { canAccessAdminPanel } from '@services/auth';
import { getAccessToken } from '@services/auth/session';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import Layout from '@/components/shared/layout/Layout';
import PageTransition from '@/components/PageTransition';
import GlobalLoader from '@/components/GlobalLoader';
import ModuleAccessFallback from '@/components/shared/feedback/ModuleAccessFallback';
import GlobalPaymentIssueBanner from '@/components/shared/feedback/GlobalPaymentIssueBanner';
import DebugBanner from '@/components/shared/feedback/debug/DebugBanner';
import { StudyTrackerBridge } from './StudyTrackerProvider';
import { buildProfilePath } from '../app/profile/profileNavigation';
import { buildAdminPath, resolveAdminRoute } from '../app/admin/config/adminPageNavigationConfig';
import { resolveUserPaymentIssue } from '@/services/billing/paymentIssue';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

const ROUTES_WITHOUT_PLATFORM_SHELL = [
  '/auth',
  '/reset-password',
  '/confirm-email',
  '/terms',
  '/privacy',
  '/changelog',
  '/planos',
  '/elite',
  '/checkout',
  '/read',
  '/subscription',
];

const isWithoutPlatformShell = (pathname: string) => (
  ROUTES_WITHOUT_PLATFORM_SHELL.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  || pathname.startsWith('/l/')
);

const followsGlobalLoginRequirement = (pathname: string) => (
  pathname.startsWith('/concursos')
  || pathname.startsWith('/practice')
  || pathname.startsWith('/lei-comentada')
  || pathname.startsWith('/flashcards')
  || pathname.startsWith('/simulation')
  || pathname.startsWith('/x-ray')
  || pathname.startsWith('/marketplace')
  || pathname === '/ranking'
);

const alwaysRequiresAuthenticatedUser = (pathname: string) => (
  pathname.startsWith('/dashboard')
  || pathname.startsWith('/profile')
  || pathname.startsWith('/performance')
  || pathname.startsWith('/notifications')
  || pathname.startsWith('/support')
  || pathname.startsWith('/read')
);

const featureGateForPath = (pathname: string): { key: Parameters<typeof resolveSystemFeatureFlag>[1]; label: string } | null => {
  if (pathname.startsWith('/practice')) return { key: 'practiceEnabled', label: 'Questoes' };
  if (pathname.startsWith('/lei-comentada')) return { key: 'annotatedLawsEnabled', label: 'Lei comentada' };
  if (pathname.startsWith('/flashcards')) return { key: 'flashcardsEnabled', label: 'Flashcards' };
  if (pathname.startsWith('/simulation')) return { key: 'simulationsEnabled', label: 'Simulados' };
  if (pathname.startsWith('/x-ray')) return { key: 'xRayEnabled', label: 'Raio-X Banca' };
  if (pathname.startsWith('/marketplace')) return { key: 'marketplaceEnabled', label: 'Loja' };
  if (pathname === '/ranking') return { key: 'rankingsEnabled', label: 'Rankings' };
  return null;
};

// Legacy hash navigation: traduz URLs antigas com #/ para o roteamento segmentado atual sem quebrar deep link.
const resolveLegacyHashRoute = (rawHash: string): string | null => {
  if (!rawHash.startsWith('#/')) {
    return null;
  }

  const legacyRoute = rawHash.slice(1);
  if (!legacyRoute || legacyRoute === '/' || legacyRoute === '/auth') {
    return null;
  }

  if (!legacyRoute.startsWith('/admin')) {
    return legacyRoute;
  }

  const [legacyPath, legacyHash = ''] = legacyRoute.split('#');
  const [legacyPathname, legacySearch = ''] = legacyPath.split('?');
  const pathSegments = legacyPathname.split('/').filter(Boolean);
  const legacyParams = new URLSearchParams(legacySearch);
  const resolvedAdminRoute = resolveAdminRoute(
    pathSegments[1] || legacyParams.get('tab'),
    pathSegments[2] || legacyParams.get('section'),
  );

  return buildAdminPath(resolvedAdminRoute.tab, resolvedAdminRoute.section, legacyHash ? `#${legacyHash}` : '');
};

export default function NextRouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { currentUser, isLoading, logout } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const hasInMemoryAccessToken = Boolean(getAccessToken());
  const restoredLegacyHashRouteRef = React.useRef(false);
  const [showLoginBypass, setShowLoginBypass] = React.useState(false);
  const canAccessAdmin = canAccessAdminPanel(currentUser);
  const isMaintenance = resolveSystemFeatureFlag(systemSettings, 'maintenanceMode', false);
  const loginRequired = resolveSystemFeatureFlag(systemSettings, 'loginRequired', false);
  const featureGate = featureGateForPath(pathname);
  const isPastDueSubscription = currentUser?.subscription?.status === 'past_due';
  const allowAuthLoadingPassThrough = (
    pathname.startsWith('/auth')
    || pathname.startsWith('/reset-password')
    || pathname.startsWith('/confirm-email')
  );
  const paymentIssue = React.useMemo(() => resolveUserPaymentIssue(currentUser), [currentUser]);
  const hasPaymentIssue = Boolean(paymentIssue || isPastDueSubscription);
  const isBlockingPaymentIssue = Boolean(isPastDueSubscription || paymentIssue?.interactionLock);
  const isFixingPayment = pathname === buildProfilePath('billing')
    || pathname === buildProfilePath('personal')
    || pathname === buildProfilePath('billing-history')
    || pathname.startsWith('/checkout')
    || pathname.startsWith('/support');
  const shouldRedirectToAuth = alwaysRequiresAuthenticatedUser(pathname)
    || (loginRequired && followsGlobalLoginRequirement(pathname));
  const shouldGateDuringAuthBootstrap = shouldRedirectToAuth
    || pathname === '/'
    || pathname.startsWith('/admin')
    || pathname === '/partner-dashboard';
  const paymentIssueFixPath = paymentIssue?.actionTarget || `${buildProfilePath('personal')}#saved-cards-personal-section`;
  const paymentIssueMessage = isPastDueSubscription
    ? 'A renovação da sua assinatura falhou. Atualize ou troque o cartão salvo para regularizar as próximas cobranças.'
    : (paymentIssue?.message || 'Atualize seu cartão para manter o acesso e as próximas cobranças em dia.');
  const paymentIssueActionLabel = paymentIssue?.actionLabel || 'Cadastrar cartão';

  React.useEffect(() => {
    if (isLoading || restoredLegacyHashRouteRef.current || typeof window === 'undefined') {
      return;
    }

    const restoredPath = resolveLegacyHashRoute(window.location.hash || '');
    if (!restoredPath) {
      return;
    }

    restoredLegacyHashRouteRef.current = true;
    router.replace(restoredPath);
  }, [isLoading, router]);

  React.useEffect(() => {
    if (isLoading || currentUser || !shouldRedirectToAuth || hasInMemoryAccessToken) {
      return;
    }

    window.sessionStorage.setItem('redirectAfterLogin', `${pathname}${window.location.search}${window.location.hash}`);
    router.replace('/auth');
  }, [currentUser, hasInMemoryAccessToken, isLoading, pathname, router, shouldRedirectToAuth]);

  React.useEffect(() => {
    if (!pathname.startsWith('/admin') || isLoading || canAccessAdmin) {
      return;
    }

    if (!currentUser) {
      if (hasInMemoryAccessToken) {
        return;
      }
      window.sessionStorage.setItem('redirectAfterLogin', `${pathname}${window.location.search}${window.location.hash}`);
      router.replace('/auth');
      return;
    }

    router.replace('/dashboard');
  }, [canAccessAdmin, currentUser, hasInMemoryAccessToken, isLoading, pathname, router]);

  React.useEffect(() => {
    if (pathname !== '/partner-dashboard' || isLoading || currentUser) {
      return;
    }

    router.replace('/');
  }, [currentUser, isLoading, pathname, router]);

  if (isLoading && !allowAuthLoadingPassThrough && shouldGateDuringAuthBootstrap) {
    return <GlobalLoader forceVisible />;
  }

  if (isMaintenance && !canAccessAdmin && !showLoginBypass) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6 text-center transition-colors">
        <div className="max-w-md space-y-8 animate-scale-in">
          <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl shadow-amber-200/50 dark:shadow-none animate-bounce">
            <Hammer size={48} />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Manutencao</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Estamos realizando melhorias técnicas para garantir a melhor experiência. Voltaremos em alguns instantes!
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {currentUser && (
              <button
                onClick={logout}
                className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase text-slate-500 hover:text-red-500 transition-all flex items-center gap-2 mx-auto"
              >
                <LogOut size={16} /> Sair da Conta
              </button>
            )}
            <button
              onClick={() => setShowLoginBypass(true)}
              className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest hover:text-indigo-500 transition-colors"
            >
              Acesso Administrativo
            </button>
          </div>
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <ShieldAlert size={14} /> Sistema Protegido
          </div>
        </div>
      </div>
    );
  }

  if (isBlockingPaymentIssue && !isFixingPayment) {
    return (
      <>
        <div className="fixed inset-x-0 top-0 z-[9998] px-3 py-3 sm:px-4">
          <div className="mx-auto max-w-6xl">
            <GlobalPaymentIssueBanner
              message={paymentIssueMessage}
              blocking
              actionLabel={paymentIssueActionLabel}
              onAction={() => router.push(paymentIssueFixPath)}
            />
          </div>
        </div>
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-scale-in border border-rose-100 dark:border-rose-900/30">
          <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-rose-200/50 dark:shadow-none animate-pulse">
            <ShieldAlert size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isPastDueSubscription ? 'Problema no Pagamento' : 'Cartão obrigatório para continuar'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {isPastDueSubscription
                ? 'A renovacao da sua assinatura falhou e seu acesso ficou pendente. Atualize ou troque o cartao salvo para regularizar a cobranca.'
                : 'Sua assinatura ativa precisa de um cartao salvo para sustentar as proximas faturas da Stripe. Cadastre o cartao antes de continuar usando a plataforma.'}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push(paymentIssueFixPath)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20"
            >
              {paymentIssueActionLabel}
            </button>
            <button
              onClick={logout}
              className="w-full py-2 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors"
            >
              Sair da Conta
            </button>
          </div>
        </div>
        </div>
      </>
    );
  }

  if ((pathname.startsWith('/admin') && !canAccessAdmin && !hasInMemoryAccessToken) || (shouldRedirectToAuth && !currentUser && !hasInMemoryAccessToken)) {
    return <GlobalLoader forceVisible />;
  }

  let framedChildren: React.ReactNode = children;

  if (featureGate && !canAccessAdmin && !resolveSystemFeatureFlag(systemSettings, featureGate.key)) {
    framedChildren = <ModuleAccessFallback description={`O modulo ${featureGate.label} nao esta disponivel para o seu perfil.`} />;
  }

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/profile')) {
    framedChildren = <PageTransition>{framedChildren}</PageTransition>;
  }

  const shelllessPaymentIssueBanner = hasPaymentIssue && isWithoutPlatformShell(pathname) ? (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <GlobalPaymentIssueBanner
        message={paymentIssueMessage}
        blocking={Boolean(paymentIssue?.interactionLock)}
        actionLabel={paymentIssueActionLabel}
        onAction={() => router.push(paymentIssueFixPath)}
      />
    </div>
  ) : null;

  const appOverlays = (
    <>
      <GlobalLoader />
      <StudyTrackerBridge />
      {process.env.NODE_ENV === 'development' && <DebugBanner />}
    </>
  );

  if (pathname === '/') {
    return (
      <>
        {currentUser ? <Layout>{framedChildren}</Layout> : <>{framedChildren}</>}
        {appOverlays}
      </>
    );
  }

  if (pathname.startsWith('/admin') || pathname === '/partner-dashboard' || isWithoutPlatformShell(pathname)) {
    return (
      <>
        {shelllessPaymentIssueBanner}
        {framedChildren}
        {appOverlays}
      </>
    );
  }

  return (
    <>
      <Layout>{framedChildren}</Layout>
      {appOverlays}
    </>
  );
}
