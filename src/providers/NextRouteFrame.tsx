'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Hammer, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { canAccessAdminPanel } from '@services/auth';
import { getAccessToken } from '@services/auth/session';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { getBenefitRequiredPlan, getPlanTierFromName, hasPlanBenefit, type CanonicalPlanName } from '@services/plans/planAccess';
import Layout from '@/components/shared/layout/Layout';
import PageTransition from '@/components/PageTransition';
import GlobalLoader from '@/components/GlobalLoader';
import ModuleAccessFallback from '@/components/shared/feedback/ModuleAccessFallback';
import GlobalPaymentIssueBanner from '@/components/shared/feedback/GlobalPaymentIssueBanner';
import DebugBanner from '@/components/shared/feedback/debug/DebugBanner';
import { StudyTrackerBridge } from './StudyTrackerProvider';
import { buildProfilePath } from '../app/profile/profileNavigation';
import { buildAdminPath, resolveAdminRoute } from '../app/admin/config/adminPageNavigationConfig';
import { resolvePaymentStatusIssue, resolveUserPaymentIssue } from '@/services/billing/paymentIssue';
import { paymentStatusService, type PaymentStatus } from '@/services/billing/paymentStatus';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import type { PlanBenefitKey } from '@types';

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
  '/promo',
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

type RoutePlanGate = {
  keys: PlanBenefitKey[];
  label: string;
  copyKey: PlanBenefitKey;
};

const planGateForPath = (pathname: string): RoutePlanGate | null => {
  if (pathname.startsWith('/dashboard')) return { keys: ['module.dashboard'], copyKey: 'module.dashboard', label: 'Dashboard premium' };
  if (pathname.startsWith('/practice')) return { keys: ['module.practice'], copyKey: 'module.practice', label: 'Prática de questões' };
  if (pathname.startsWith('/lei-comentada')) return { keys: ['module.lei_comentada'], copyKey: 'module.lei_comentada', label: 'Lei comentada' };
  if (pathname.startsWith('/flashcards')) return { keys: ['module.flashcards'], copyKey: 'module.flashcards', label: 'Flashcards' };
  if (pathname.startsWith('/simulation')) return { keys: ['module.simulations'], copyKey: 'module.simulations', label: 'Simulados' };
  if (pathname.startsWith('/x-ray')) return { keys: ['module.xray', 'xray_banca'], copyKey: 'module.xray', label: 'Raio-X Banca' };
  if (pathname.startsWith('/cronograma')) return { keys: ['module.schedule'], copyKey: 'module.schedule', label: 'Cronograma' };
  if (pathname.startsWith('/marketplace')) return { keys: ['module.marketplace'], copyKey: 'module.marketplace', label: 'Loja' };
  return null;
};

type ModuleUpgradeCopy = {
  title: string;
  description: string;
  benefits: string[];
};

const MODULE_UPGRADE_COPY: Partial<Record<PlanBenefitKey, ModuleUpgradeCopy>> = {
  'module.dashboard': {
    title: 'Desbloqueie o dashboard completo',
    description: 'Acompanhe seu desempenho, tempo de estudo, sequencia e evolucao por materia em um painel feito para orientar sua rotina.',
    benefits: [
      'Desempenho geral com insights',
      'Evolucao real por periodo',
      'Tempo total de estudo',
      'Top materias do recorte atual',
    ],
  },
  'module.practice': {
    title: 'Desbloqueie a prática de questões',
    description: 'Resolva questões com filtros, gabarito, estatísticas e ferramentas de estudo de acordo com o seu plano.',
    benefits: [
      'Filtros avançados de questões',
      'Gabarito e explicação no card',
      'Questões salvas e anotações',
      'Recortes de acertos e erros',
    ],
  },
  'module.lei_comentada': {
    title: 'Desbloqueie a Lei Comentada',
    description: 'Estude a lei por artigo com comentários, jurisprudência, questões relacionadas e recursos de revisão vinculados ao texto legal.',
    benefits: [
      'Comentários por artigo',
      'Jurisprudência e como cai',
      'Questões relacionadas',
      'Anotações e conexões da lei',
    ],
  },
  'module.flashcards': {
    title: 'Desbloqueie os flashcards',
    description: 'Revise pontos importantes com cartões organizados para memorização e revisão rápida.',
    benefits: [
      'Flashcards por materia',
      'Revisao guiada',
      'Memorizacao ativa',
      'Rotina de revisao mais leve',
    ],
  },
  'module.simulations': {
    title: 'Desbloqueie os simulados',
    description: 'Monte e resolva simulados com controle de tempo, desempenho e historico para treinar em ritmo de prova.',
    benefits: [
      'Simulados ativos por plano',
      'Modo lista e modo prova',
      'Resultado com desempenho',
      'Historico de tentativas',
    ],
  },
  'module.xray': {
    title: 'Desbloqueie o Raio-X Banca',
    description: 'Entenda como a banca cobra, quais temas mais aparecem e onde concentrar seus estudos com mais objetividade.',
    benefits: [
      'Concentracao por materia',
      'Topicos criticos da banca',
      'Dificuldade dominante',
      'Recomendacoes objetivas de estudo',
    ],
  },
  'module.schedule': {
    title: 'Desbloqueie o cronograma inteligente',
    description: 'Organize sua rotina com trilhas, prioridades e revisoes pensadas para manter consistencia ate a prova.',
    benefits: [
      'Plano de estudos inteligente',
      'Trilhas automaticas',
      'Revisao por prioridade',
      'Organizacao da rotina semanal',
    ],
  },
  'module.marketplace': {
    title: 'Desbloqueie a loja de materiais',
    description: 'Acesse materiais, PDFs e produtos educacionais publicados na plataforma conforme a liberacao do seu plano.',
    benefits: [
      'Materiais publicados',
      'Biblioteca de compras',
      'Downloads protegidos',
      'Acesso a produtos parceiros',
    ],
  },
};

const getRouteRequiredPlan = (
  benefitKeys: PlanBenefitKey[],
  configuredEntitlements: Parameters<typeof getBenefitRequiredPlan>[1],
): CanonicalPlanName => {
  return benefitKeys
    .map((benefitKey) => getBenefitRequiredPlan(benefitKey, configuredEntitlements))
    .sort((left, right) => getPlanTierFromName(left) - getPlanTierFromName(right))[0] || 'Elite';
};

const formatRequiredPlanLabel = (requiredPlan: CanonicalPlanName): string => {
  if (requiredPlan === 'Gratuito') {
    return 'Plano Gratuito';
  }

  if (requiredPlan === 'Elite') {
    return 'Plano Elite';
  }

  return `Plano ${requiredPlan} ou superior`;
};

const formatAvailabilityLabel = (requiredPlan: CanonicalPlanName): string => (
  requiredPlan === 'Elite'
    ? 'Disponivel no Plano Elite'
    : `Disponivel a partir do Plano ${requiredPlan}`
);

const getPlanUpgradePath = (requiredPlan: CanonicalPlanName): string => (
  requiredPlan === 'Elite' ? '/elite' : `/plans?plan=${requiredPlan.toLowerCase()}`
);

const buildModuleUpgradeCopy = (planGate: RoutePlanGate, requiredPlan: CanonicalPlanName) => {
  const baseCopy = MODULE_UPGRADE_COPY[planGate.copyKey] || {
    title: `Desbloqueie ${planGate.label}`,
    description: `Libere ${planGate.label} e continue estudando com os recursos disponiveis para o seu plano.`,
    benefits: [
      `${planGate.label} completo`,
      'Recursos liberados pelo seu plano',
      'Experiencia sem bloqueios artificiais',
      'Upgrade aplicado automaticamente',
    ],
  };
  const planLabel = formatRequiredPlanLabel(requiredPlan);

  return {
    eyebrow: formatAvailabilityLabel(requiredPlan),
    title: baseCopy.title,
    description: `${baseCopy.description} Este modulo esta disponivel no ${planLabel}.`,
    benefits: baseCopy.benefits,
    ctaTo: getPlanUpgradePath(requiredPlan),
    ctaLabel: requiredPlan === 'Elite' ? 'Assinar Elite' : `Ver ${requiredPlan}`,
  };
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
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus | null>(null);
  const canAccessAdmin = canAccessAdminPanel(currentUser);
  const isMaintenance = resolveSystemFeatureFlag(systemSettings, 'maintenanceMode', false);
  const loginRequired = resolveSystemFeatureFlag(systemSettings, 'loginRequired', false);
  const featureGate = featureGateForPath(pathname);
  const planGate = planGateForPath(pathname);
  const isBillingRoute = pathname.startsWith('/profile') || pathname.startsWith('/checkout');
  const isPastDueSubscription = paymentStatus?.subscriptionStatus === 'past_due';
  const allowAuthLoadingPassThrough = (
    pathname.startsWith('/auth')
    || pathname.startsWith('/reset-password')
    || pathname.startsWith('/confirm-email')
  );
  const paymentIssue = React.useMemo(
    () => resolvePaymentStatusIssue(paymentStatus) || resolveUserPaymentIssue(currentUser),
    [currentUser, paymentStatus],
  );
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
    if (!currentUser || !isBillingRoute) {
      setPaymentStatus(null);
      return;
    }

    const controller = new AbortController();
    void paymentStatusService.getCurrentUserStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) {
          setPaymentStatus(status);
        }
      })
      .catch(() => {
        // A falha de rede não pode ser exibida como cartão ausente.
        if (!controller.signal.aborted) {
          setPaymentStatus(null);
        }
      });

    return () => controller.abort();
  }, [currentUser?.id, isBillingRoute]);

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
                ? 'A renovação da sua assinatura falhou e seu acesso ficou pendente. Atualize ou troque o cartão salvo para regularizar a cobrança.'
                : 'Sua assinatura ativa precisa de um cartão salvo para sustentar as próximas faturas da Stripe. Cadastre o cartão antes de continuar usando a plataforma.'}
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
    framedChildren = (
      <ModuleAccessFallback
        tone="disabled"
        eyebrow="Modulo indisponivel"
        title={`${featureGate.label} indisponivel`}
        description={`O modulo ${featureGate.label} nao esta disponivel no momento.`}
        ctaTo="/"
        ctaLabel="Voltar ao inicio"
      />
    );
  }

  if (
    planGate
    && !canAccessAdmin
    && !planGate.keys.some((benefitKey) => hasPlanBenefit(currentUser, benefitKey, systemSettings.planEntitlements))
  ) {
    const requiredPlan = getRouteRequiredPlan(planGate.keys, systemSettings.planEntitlements);
    const upgradeCopy = buildModuleUpgradeCopy(planGate, requiredPlan);

    framedChildren = (
      <ModuleAccessFallback
        eyebrow={upgradeCopy.eyebrow}
        title={upgradeCopy.title}
        description={upgradeCopy.description}
        ctaTo={upgradeCopy.ctaTo}
        ctaLabel={upgradeCopy.ctaLabel}
        benefits={upgradeCopy.benefits}
      />
    );
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
