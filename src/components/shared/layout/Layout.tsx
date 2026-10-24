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


import React, { useState } from 'react';
import { LayoutGrid, BookOpen, BookOpenText, User, X, Trophy, LogOut, Timer, Zap, ShoppingBag, ShieldAlert, Mail, Bell, Check, Sun, Moon, Lock, HelpCircle, Rocket, Crown, FileText, Bookmark, Layers, StickyNote, CreditCard, BarChart3, Package, ShieldCheck, Gift, ChevronDown, CalendarDays, Loader2, Search, MoreHorizontal, Landmark, Newspaper, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useTheme } from '@providers/ThemeProvider';
import PromoBanner from '../feedback/PromoBanner';
import { ErrorReport, SystemSettings } from '@types';
import Footer from './Footer';
import AdBanner from '../feedback/AdBanner';
import { useToast } from '@providers/ToastProvider';
import { apiClient } from '@services/api';
import { ENDPOINTS } from '@services/api';
import { readApiErrorMessage } from '@services/api';
import { getVersionedAssetUrl } from '@services/api';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';
import { canAccessAdminPanel } from '@services/auth';
import LogoutConfirmButton from './LogoutConfirmButton';
import { buildProfilePath, type ProfileTab } from '../../../app/profile/profileNavigation';
import { buildAdminPath } from '../../../app/admin/config/adminPageNavigationConfig';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import PublicBrandLink from './PublicBrandLink';
import {
  getBenefitPlanLabel,
  getAccessPlanName,
  getPlanTierFromName,
  hasPlanBenefit,
} from '@services/plans/planAccess';
import type { PlanBenefitKey } from '@types';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { useNotificationsLoader } from '@providers/NotificationsProvider';
import { useAdminDataStore } from '@/state/admin-data/adminDataStore';
import UserAvatar from '../ui/UserAvatar';
import { publicRoutes } from '@services/routes/publicRoutes';
import { isSimulationImmersivePath, SIMULATION_IMMERSIVE_EVENT } from '@services/simulations/simulationLayout';
import { isModalInteraction } from './profileMenuDismissal';

interface LayoutProps {
  children: React.ReactNode;
  includePageExtras?: boolean;
  fullWidthContent?: boolean;
  contentContainer?: 'main' | 'div';
}

type SidebarNavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  enabled: boolean;
  moduleEnabled?: boolean;
  benefitKey?: PlanBenefitKey | PlanBenefitKey[];
  badge?: number;
};

type ProfileQuickMenuItem = {
  tab?: ProfileTab;
  href?: string;
  label: string;
  icon: LucideIcon;
};

type ResendConfirmationResponse = {
  success?: boolean;
  message?: string;
  data?: ResendConfirmationResponse;
};

type EmailConfirmationDeliveryNotice = {
  email?: string;
  status?: string;
  message?: string;
};

const EMAIL_VERIFICATION_MODAL_DISMISS_PREFIX = 'emailVerificationModalClosed:';

const buildEmailVerificationDismissKey = (user: { id?: string; email?: string } | null | undefined) => (
  `${EMAIL_VERIFICATION_MODAL_DISMISS_PREFIX}${user?.id || user?.email || 'anonymous'}`
);

const clearEmailVerificationDismissals = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem('welcomeModalClosed');

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(EMAIL_VERIFICATION_MODAL_DISMISS_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  }
};

const Layout: React.FC<LayoutProps> = ({ children, includePageExtras = true, fullWidthContent = false, contentContainer = 'main' }) => {
  const ContentContainer = contentContainer;
  const { currentUser: user, refreshUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const notifications = useNotificationsStore((state) => state.notifications);
  const { refreshNotifications } = useNotificationsLoader();
  const reports = useAdminDataStore((state) => state.reports);
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [locationHash, setLocationHash] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const pathname = usePathname();
  const showHomeVisitorActions = pathname === '/' && !user;
  const router = useRouter();
  const location = React.useMemo(() => {
    return {
      pathname,
      search: locationSearch,
      hash: locationHash,
    };
  }, [locationHash, locationSearch, pathname]);
  const canOpenAdminPanel = canAccessAdminPanel(user);
  const isStrictAdmin = Boolean(user?.isAdmin || user?.role === 'admin');
  const practiceEnabled = resolveSystemFeatureFlag(systemSettings, 'practiceEnabled');
  const annotatedLawsEnabled = resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled');
  const flashcardsEnabled = resolveSystemFeatureFlag(systemSettings, 'flashcardsEnabled');
  const simulationsEnabled = resolveSystemFeatureFlag(systemSettings, 'simulationsEnabled');
  const studyScheduleEnabled = resolveSystemFeatureFlag(systemSettings, 'studyScheduleEnabled');
  const xRayEnabled = resolveSystemFeatureFlag(systemSettings, 'xRayEnabled');
  const rankingsEnabled = resolveSystemFeatureFlag(systemSettings, 'rankingsEnabled');
  const marketplaceEnabled = resolveSystemFeatureFlag(systemSettings, 'marketplaceEnabled');
  const referralEnabled = resolveSystemFeatureFlag(systemSettings, 'referralEnabled');
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);
  const mobileProfileMenuRef = React.useRef<HTMLDivElement | null>(null);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<EmailConfirmationDeliveryNotice | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncLocation = () => {
      setLocationHash(window.location.hash || '');
      setLocationSearch(window.location.search || '');
    };

    syncLocation();
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('popstate', syncLocation);

    return () => {
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('popstate', syncLocation);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (!pathname?.startsWith('/simulation')) {
      return undefined;
    }

    const handleImmersiveChange = (event: Event) => {
      const search = (event as CustomEvent<{ search?: string }>).detail?.search;
      setLocationSearch(search || '');
    };

    window.addEventListener(SIMULATION_IMMERSIVE_EVENT, handleImmersiveChange);
    return () => window.removeEventListener(SIMULATION_IMMERSIVE_EVENT, handleImmersiveChange);
  }, [pathname]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!user) {
        clearEmailVerificationDismissals();
        setEmailDeliveryNotice(null);
        setShowVerificationModal(false);
        return;
      }

      const rawEmailDeliveryNotice = window.sessionStorage.getItem('emailConfirmationDelivery');
      let parsedEmailDeliveryNotice: EmailConfirmationDeliveryNotice | null = null;

      if (rawEmailDeliveryNotice) {
        try {
          parsedEmailDeliveryNotice = JSON.parse(rawEmailDeliveryNotice) as EmailConfirmationDeliveryNotice;
        } catch {
          window.sessionStorage.removeItem('emailConfirmationDelivery');
        }
      }

      setEmailDeliveryNotice(parsedEmailDeliveryNotice);
      const dismissKey = buildEmailVerificationDismissKey(user);
      const isDismissed = window.sessionStorage.getItem(dismissKey) === 'true';
      window.sessionStorage.removeItem('welcomeModalClosed');
      setShowVerificationModal(Boolean(!user.emailVerified && !isDismissed));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [user]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMobileMenuOpen(false);
      setIsProfileMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isProfileMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isModalInteraction(event.target)) {
        return;
      }

      if (!profileMenuRef.current?.contains(target) && !mobileProfileMenuRef.current?.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileMenuOpen]);

  const closeVerificationModal = () => {
    if (user) {
      window.sessionStorage.setItem(buildEmailVerificationDismissKey(user), 'true');
    }
    setShowVerificationModal(false);
  };

  // if (!user) return null; // Removed to allow guest access

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(current => current - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResendConfirmation = async () => {
    if (resendTimer > 0 || isResendingConfirmation) return;
    // emailVerified é o campo mapeado pelo backend (camelCase)
    if (!user || user.emailVerified) return;

    try {
      setIsResendingConfirmation(true);
      const response = await apiClient.post<ResendConfirmationResponse>(ENDPOINTS.auth.resendConfirmation, { email: user.email });
      const payload = (response && typeof response === 'object' && 'data' in response && response.data
        ? response.data
        : response) as ResendConfirmationResponse;

      if (payload && payload.success) {
        setResendTimer(60);
        window.sessionStorage.removeItem('emailConfirmationDelivery');
        setEmailDeliveryNotice(null);
        addToast(payload.message || 'E-mail reenviado com sucesso!', 'success');

        // Se o e-mail já foi verificado (o backend retorna success com mensagem de aviso),
        // atualizamos o usuário para sumir o banner imediatamente.
        if (payload.message?.includes('já foi verificado')) {
          refreshUser();
        }
      } else {
        addToast(payload?.message || 'Falha ao reenviar e-mail.', 'error');
      }
    } catch (error: unknown) {
      const errorMessage = readApiErrorMessage(error, 'Erro do servidor ao reenviar e-mail.');
      addToast(errorMessage, 'error');
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead && !n.deletedAt).length;
  const adminSettingsSnapshot = systemSettings as SystemSettings & { adminFeedbackCount?: number | string };
  const adminFeedbackCount = Math.max(0, Number(adminSettingsSnapshot.adminFeedbackCount || 0));
  const adminOpenReportsCount = React.useMemo(
    () => (reports || []).filter((report: ErrorReport) => !['resolved', 'ignored'].includes(String(report.status || '').toLowerCase())).length,
    [reports],
  );
  const adminMenuBadgeCount = adminFeedbackCount + adminOpenReportsCount;

  const navItems: SidebarNavItem[] = ([
    { label: 'Dashboard', icon: LayoutGrid, path: '/dashboard', enabled: !!user, benefitKey: 'module.dashboard' },
    { label: 'Quest\u00F5es', icon: BookOpenText, path: publicRoutes.questions.index(), enabled: practiceEnabled, benefitKey: 'module.practice' },
    { label: 'Provas', icon: FileText, path: publicRoutes.exams.index(), enabled: true },
    { label: 'Lei comentada', icon: Bookmark, path: '/lei-comentada', enabled: true, moduleEnabled: annotatedLawsEnabled, benefitKey: 'module.lei_comentada' },
    { label: 'Flashcards', icon: Layers, path: '/flashcards', enabled: true, moduleEnabled: flashcardsEnabled, benefitKey: 'module.flashcards' },
    { label: 'Simulados', icon: Timer, path: '/simulation', enabled: simulationsEnabled, benefitKey: 'module.simulations' },
    { label: 'Cronograma', icon: CalendarDays, path: '/cronograma', enabled: true, moduleEnabled: studyScheduleEnabled, benefitKey: 'module.schedule' },
    { label: 'Raio-X Banca', icon: Zap, path: '/x-ray', enabled: xRayEnabled, benefitKey: ['module.xray', 'xray_banca'] },
    { label: 'Rankings', icon: Trophy, path: '/ranking', enabled: rankingsEnabled },
    { label: 'Loja', icon: ShoppingBag, path: '/marketplace', enabled: marketplaceEnabled, benefitKey: 'module.marketplace' },
  ] satisfies SidebarNavItem[]).filter((item) => {
    const isGloballyDisabled = item.enabled === false;
    const isModuleDisabled = item.moduleEnabled === false;

    if (isGloballyDisabled || isModuleDisabled) {
      return isStrictAdmin;
    }

    return true;
  });

  const primaryNavigationPaths = [
    '/dashboard',
    publicRoutes.questions.index(),
    publicRoutes.exams.index(),
    '/simulation',
    '/lei-comentada',
    '/flashcards',
    '/cronograma',
    '/x-ray',
  ];
  const primaryNavItems = primaryNavigationPaths
    .map((path) => navItems.find((item) => item.path === path))
    .filter((item): item is SidebarNavItem => Boolean(item));
  const primaryNavPaths = new Set(primaryNavItems.map((item) => item.path));
  const moreNavItems = navItems.filter((item) => !primaryNavPaths.has(item.path));

  const isActive = (path: string) => {
    if (path.startsWith('/profile')) return location.pathname.startsWith('/profile');
    if (path.startsWith('/admin')) return location.pathname.startsWith('/admin');
    if (path === publicRoutes.exams.index()) return location.pathname.startsWith('/provas');
    return location.pathname === path;
  };

  const handleGlobalSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = globalSearch.trim();
    router.push(query ? `/busca?q=${encodeURIComponent(query)}` : '/busca');
  };

  // Only consider the plan active if there is a valid subscription status (active or trialing)
  // Otherwise, fallback to 'Gratuito'. This mirrors the logic in Profile.tsx
  const currentCanonicalPlan = getAccessPlanName(user);
  const currentTier = React.useMemo(
    () => getPlanTierFromName(getAccessPlanName(user)),
    [user],
  );
  const accountStatusHref = currentCanonicalPlan === 'Gratuito'
    ? '/plans'
    : buildProfilePath('billing');
  const resolvePlanLocked = React.useCallback((benefitKey?: PlanBenefitKey | PlanBenefitKey[]) => {
    if (!benefitKey || isStrictAdmin) {
      return false;
    }

    const benefitKeys = Array.isArray(benefitKey) ? benefitKey : [benefitKey];
    return !benefitKeys.some((key) => hasPlanBenefit(user, key, systemSettings.planEntitlements));
  }, [isStrictAdmin, systemSettings.planEntitlements, user]);

  const userName = user?.name || 'Visitante';
  const userFirstName = React.useMemo(() => {
    const normalized = String(userName).trim();
    return normalized.split(/\s+/)[0] || 'Visitante';
  }, [userName]);
  const userPhotoUrl = React.useMemo(
    () => getVersionedAssetUrl(user?.photoUrl || '', user?.photoUrl || user?.id || ''),
    [user?.id, user?.photoUrl],
  );
  const userLevel = user?.level || 0;

  const profileQuickMenuItems = React.useMemo<ProfileQuickMenuItem[]>(() => {
    const items: ProfileQuickMenuItem[] = [
      {
        tab: 'personal',
        label: 'Meu perfil',
        icon: User,
      },
      {
        href: '/notifications',
        label: 'Notificações',
        icon: Bell,
      },
      ...(canOpenAdminPanel ? [{
        href: buildAdminPath('panel', 'dashboard'),
        label: 'Painel Admin',
        icon: ShieldAlert,
      }] : []),
    ];
    return items;
  }, [canOpenAdminPanel]);

  const getPlanStatusTheme = (tier: number) => {
    switch (tier) {
      case 4:
        return {
          box: 'bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg',
          icon: Crown,
          badge: 'Máximo',
        };
      case 3:
        return {
          box: 'bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-4 text-white shadow-lg',
          icon: Zap,
          badge: 'Pro',
        };
      case 2:
        return {
          box: 'bg-gradient-to-r from-sky-500 to-cyan-600 rounded-xl p-4 text-white shadow-lg',
          icon: Check,
          badge: 'Essencial',
        };
      default:
        return {
          box: 'bg-slate-100 dark:bg-slate-800/80 rounded-xl p-4 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 shadow-sm',
          icon: Lock,
          badge: 'Grátis',
        };
    }
  };
  const currentPlanTheme = getPlanStatusTheme(currentTier);

  const renderTopNavigationItem = (item: SidebarNavItem) => {
    const isAdminItem = item.path.startsWith('/admin');
    const isCurrent = isActive(item.path);
    const isLocked = resolvePlanLocked(item.benefitKey);
    const isDisabled = item.enabled === false || item.moduleEnabled === false;
    const badgeCount = Number(item.badge || 0);
    const accessLabel = isDisabled
      ? 'Desativado no admin (visível apenas para Admin)'
      : isLocked && item.benefitKey && !Array.isArray(item.benefitKey)
        ? `Disponível no ${getBenefitPlanLabel(item.benefitKey, systemSettings.planEntitlements)}`
        : item.label;

    return (
      <Link
        key={item.path}
        href={item.path}
        prefetch={false}
        aria-current={isCurrent ? 'page' : undefined}
        title={accessLabel}
        className={`relative inline-flex h-12 shrink-0 items-center gap-[7px] border-b-2 px-0 text-[13px] font-medium transition-colors md:h-[54px] md:text-[13px] ${
          isAdminItem
            ? isCurrent ? 'border-rose-600 text-rose-700 dark:border-rose-400 dark:text-rose-300' : 'border-transparent text-slate-600 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300'
            : isCurrent ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300' : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
        } ${isLocked ? 'opacity-75' : ''}`}
      >
        <item.icon size={17} aria-hidden="true" />
        <span>
          <span className="md:hidden">{item.label === 'Perfil' && user ? userFirstName : item.label === 'Raio-X Banca' ? 'Raio-X' : item.label === 'Dashboard' ? 'Painel' : item.label}</span>
          <span className="hidden md:inline">{item.label === 'Perfil' && user ? userFirstName : item.label === 'Dashboard' ? 'Painel' : item.label}</span>
        </span>
        {item.path === '/novidades' && unreadCount > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
        {badgeCount > 0 && !isLocked && !isDisabled && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isAdminItem ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'}`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {isLocked && <Lock size={13} className="text-amber-500" aria-label="Recurso do plano" />}
        {isDisabled && !isLocked && <span className="rounded bg-red-100 px-1 text-[9px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">DEV</span>}
      </Link>
    );
  };

  const renderMoreMenuActions = () => (
    <>
      <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
        {[
          { label: 'Novidades', href: '/novidades', icon: Rocket },
          { label: 'Blog', href: '/blog', icon: Newspaper },
          { label: 'Disciplinas', href: '/disciplinas', icon: BookOpen },
          { label: 'Bancas', href: '/bancas', icon: Landmark },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
      <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
        <Link
          href="/support"
          onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
          className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <HelpCircle size={16} aria-hidden="true" />
          Suporte e feedback
        </Link>
      </div>
    </>
  );

  const handleProfileMenuToggle = () => {
    if (!user) {
      window.sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search + location.hash);
      router.push('/auth');
      return;
    }

    setIsProfileMenuOpen((current) => !current);
    if (!isProfileMenuOpen) {
      void refreshNotifications(true);
    }
  };

  const handleProfileQuickMenuNavigate = (item: ProfileQuickMenuItem) => {
    setIsProfileMenuOpen(false);
    router.push(item.href || buildProfilePath(item.tab || 'personal'));
  };

  const renderHomeVisitorActions = (compact = false) => (
    <div className={`flex shrink-0 items-center ${compact ? 'gap-1' : 'gap-2 border-l border-slate-200 pl-5 dark:border-slate-800'}`}>
      <Link
        href="/auth?mode=login"
        className={compact
          ? 'whitespace-nowrap rounded-md px-1.5 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200'
          : 'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300'}
      >
        Entrar
      </Link>
      <Link
        href="/auth?mode=signup"
        className={compact
          ? 'whitespace-nowrap rounded-md bg-indigo-600 px-2 py-2 text-[10px] font-bold text-white hover:bg-indigo-700'
          : 'whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700'}
      >
        Cadastrar grátis
      </Link>
    </div>
  );

  const renderProfileQuickMenu = () => user && isProfileMenuOpen ? (
    <div className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-md border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        {profileQuickMenuItems.map((item) => {
          const itemPath = item.href || buildProfilePath(item.tab || 'personal');
          const isCurrent = item.href?.startsWith('/admin')
            ? location.pathname.startsWith('/admin')
            : item.tab ? location.pathname === itemPath : location.pathname === itemPath;

          return (
            <button
              key={item.href || item.tab || item.label}
              type="button"
              onClick={() => handleProfileQuickMenuNavigate(item)}
              className={`flex h-9 w-full items-center gap-2 rounded px-2 text-left text-[13px] transition-colors ${
                isCurrent
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              <item.icon size={16} aria-hidden="true" />
              <span className="min-w-0 truncate">{item.label}</span>
              {item.href?.startsWith('/admin') && adminMenuBadgeCount > 0 ? (
                <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{adminMenuBadgeCount > 99 ? '99+' : adminMenuBadgeCount}</span>
              ) : null}
              {item.href === '/notifications' && unreadCount > 0 ? (
                <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{unreadCount > 99 ? '99+' : unreadCount}</span>
              ) : null}
            </button>
          );
        })}
      <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
        <LogoutConfirmButton>
          {({ isLoggingOut, openConfirm }) => (
            <button
              type="button"
              onClick={openConfirm}
              disabled={isLoggingOut}
              className="flex h-9 w-full items-center gap-2 rounded px-2 text-[13px] text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-300 dark:hover:bg-red-900/20 dark:hover:text-red-300"
            >
              <LogOut size={16} aria-hidden="true" />
              {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
            </button>
          )}
        </LogoutConfirmButton>
      </div>
    </div>
  ) : null;

  const isDashboardPage = location.pathname.startsWith('/admin') || location.pathname === '/partner-dashboard';
  const isSimulationFullscreenPage = isSimulationImmersivePath(location.pathname, location.search);
  const hasMobileTopHeader = !isDashboardPage && !isSimulationFullscreenPage;
  const hasFailedEmailDeliveryNotice = Boolean(
    user
    && emailDeliveryNotice
    && emailDeliveryNotice.email === user.email
    && ['failed', 'disabled'].includes(String(emailDeliveryNotice.status || '')),
  );
  const showEmailVerificationBanner = Boolean(user && !user.emailVerified && !showVerificationModal);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      <PromoBanner />

      {showVerificationModal && user && !user.emailVerified && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-w-md w-full rounded-2xl p-8 shadow-2xl relative animate-scale-in border border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={closeVerificationModal}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Mail size={36} />
            </div>
            <h2 className="text-2xl font-black mb-3 text-slate-800 dark:text-slate-100 tracking-tight">Verifique seu E-mail</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium mb-8">
              {hasFailedEmailDeliveryNotice ? (
                <>
                  Sua conta foi criada, mas o envio automático do e-mail de confirmação ainda não está configurado.
                  <br/><br/>
                  Use o botão abaixo para tentar novamente após a configuração do SMTP.
                </>
              ) : (
                <>
                  Enviamos um link de confirmação para <br/><strong className="text-slate-700 dark:text-slate-200">{user.email}</strong>.
                  <br/><br/>
                  Acesse sua caixa de entrada e ative sua conta para liberar todas as funcionalidades e ganhar <span className="text-indigo-600 dark:text-indigo-400 font-bold">+50 XP</span>!
                </>
              )}
            </p>
            
            <button
              disabled={resendTimer > 0 || isResendingConfirmation}
              onClick={handleResendConfirmation}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all shadow-lg flex items-center justify-center gap-3 ${resendTimer > 0 ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95'}`}
            >
              {isResendingConfirmation ? <><Loader2 size={16} className="animate-spin" /> Reenviando</> : resendTimer > 0 ? `Aguarde ${resendTimer}s` : <><Rocket size={16} /> Reenviar E-mail</>}
            </button>
            <button
              onClick={closeVerificationModal}
              className="w-full mt-4 py-3 rounded-xl text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors"
            >
              Fazer isso depois
            </button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        {hasMobileTopHeader && (
          <div className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <div className="flex items-center justify-between">
            <PublicBrandLink width={showHomeVisitorActions ? 96 : 160} />
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-black uppercase"
              >
                <span className="inline-flex" aria-hidden="true">
                  <Moon size={20} className="dark:hidden" />
                  <Sun size={20} className="hidden dark:block" />
                </span>
              </button>
              {showHomeVisitorActions ? renderHomeVisitorActions(true) : (
                <div ref={mobileProfileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={handleProfileMenuToggle}
                    aria-label={user ? `Abrir menu da conta de ${userName}` : 'Entrar ou acessar perfil'}
                    aria-haspopup={user ? 'menu' : undefined}
                    aria-expanded={user ? isProfileMenuOpen : undefined}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <UserAvatar
                      src={userPhotoUrl}
                      name={userName}
                      alt=""
                      aria-hidden="true"
                      className="h-8 w-8 rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-indigo-600"
                    />
                  </button>
                  {renderProfileQuickMenu()}
                </div>
              )}
              <button onClick={() => router.push('/busca')} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Buscar questões">
                <Search size={19} />
              </button>
            </div>
            </div>
          </div>
        )}

        {!isDashboardPage && !isSimulationFullscreenPage && (
          <>
            <div className="hidden border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 md:block md:px-6 lg:px-8">
              <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-8">
                <PublicBrandLink width={194} />
                <form onSubmit={handleGlobalSearch} role="search" className="hidden h-10 min-w-0 max-w-[420px] flex-1 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-500 focus-within:border-indigo-400 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus-within:bg-slate-950 min-[851px]:flex">
                  <Search size={18} aria-hidden="true" />
                  <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} aria-label="Buscar questões, provas e materiais" placeholder="Buscar questões, provas e materiais" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
                  <button type="submit" aria-label="Pesquisar" className="rounded p-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30"><Search size={17} /></button>
                </form>
              </div>
            </div>
            <nav aria-label="Navegação principal" className="fixed inset-x-0 top-[68px] z-20 h-12 overflow-x-auto border-b border-slate-200 bg-white no-scrollbar dark:border-slate-800 dark:bg-slate-900 md:static md:z-auto md:h-auto md:overflow-visible md:px-6 lg:px-8">
              <div className="relative mx-auto flex h-12 w-max min-w-full items-center gap-5 px-5 md:h-[54px] md:w-full md:min-w-0 md:max-w-7xl md:gap-6 md:border-t md:border-slate-100 md:px-0 dark:md:border-slate-800">
                <div className="flex shrink-0 items-center gap-5 min-[851px]:hidden">
                  {navItems.map((item) => (
                    <div key={`mobile-${item.path}`}>{renderTopNavigationItem(item)}</div>
                  ))}
                </div>
                {primaryNavItems.map((item) => (
                  <div key={`desktop-${item.path}`} className="hidden min-[851px]:block">{renderTopNavigationItem(item)}</div>
                ))}
                <details className="group relative ml-auto hidden shrink-0 min-[851px]:block">
                  <summary className="inline-flex h-[54px] list-none items-center gap-2 border-b-2 border-transparent px-0 text-[13px] font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                    <MoreHorizontal size={18} aria-hidden="true" /> Mais <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-md border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {moreNavItems.map((item) => (
                      <div key={item.path} className="[&>a]:h-9 [&>a]:w-full [&>a]:justify-start [&>a]:rounded [&>a]:px-2 [&>a]:text-[13px]">
                        {renderTopNavigationItem(item)}
                      </div>
                    ))}
                    {renderMoreMenuActions()}
                  </div>
                </details>
              </div>
            </nav>
          </>
        )}

        {/* Sidebar Navigation */}
        {!isDashboardPage && !isSimulationFullscreenPage && (
          <aside aria-hidden="true" className="hidden">
            <div className="hidden shrink-0 px-5 pb-4 pt-5 md:flex">
              <PublicBrandLink
                width={215}
                className="inline-flex items-center transition-opacity hover:opacity-90"
              />
            </div>

            <div className="mb-3 mt-4 shrink-0 px-4 md:hidden">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <UserAvatar
                  src={userPhotoUrl}
                  name={userName}
                  alt={userName || 'Foto de perfil'}
                  className="h-10 w-10 shrink-0 rounded-full bg-indigo-100 font-bold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{userName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{user ? `Nível ${userLevel}` : 'Acesse sua conta'}</p>
                </div>
              </div>
            </div>

            <nav className="no-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3.5 py-3">
              {navItems.map((item) => {
                const isAdminItem = item.path.startsWith('/admin');
                const isCurrent = isActive(item.path);
                let styles = "flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-[15px] font-semibold relative ";

                if (isAdminItem) {
                  styles += isCurrent
                    ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shadow-sm border border-rose-100 dark:border-rose-900/30"
                    : "text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400";
                } else {
                  styles += isCurrent
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100";
                }

                const isLocked = resolvePlanLocked(item.benefitKey);
                const isGloballyDisabled = item.enabled === false;
                const isModuleDisabled = item.moduleEnabled === false;
                const shouldShowDevBadge = isGloballyDisabled || isModuleDisabled;
                const badgeCount = Number(item.badge || 0);
                const hasBadge = badgeCount > 0;
                const hasRightAccessory = isLocked || shouldShowDevBadge || hasBadge;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    prefetch={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`${styles} ${isLocked ? 'opacity-75' : ''}`}
                    title={
                      shouldShowDevBadge
                        ? 'Desativado no admin (visível apenas para Admin)'
                        : isLocked && item.benefitKey && !Array.isArray(item.benefitKey)
                          ? `Disponível no ${getBenefitPlanLabel(item.benefitKey, systemSettings.planEntitlements)}`
                          : ''
                    }
                  >
                    <item.icon size={19} className="shrink-0" />
                    <span className={`min-w-0 truncate ${hasRightAccessory ? 'pr-8' : ''}`}>{item.label}</span>
                    {item.path === '/novidades' && unreadCount > 0 && (
                      <span className="absolute left-7 top-2.5 h-2 w-2 rounded-full bg-red-500 shadow-sm shadow-red-500/50 animate-pulse" />
                    )}
                    {hasBadge && !isLocked && !shouldShowDevBadge && (
                      <span className={`absolute right-3 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                        isAdminItem
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      }`}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                    {isLocked && (
                      <Lock size={14} className="absolute right-3 text-amber-500" />
                    )}
                    {shouldShowDevBadge && !isLocked && (
                      <span className="absolute right-3 rounded bg-red-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-red-600 dark:bg-red-900/30 dark:text-red-400">DEV</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 space-y-3 border-t border-slate-100 p-3 dark:border-slate-800">
              {user && (
                <div className={currentPlanTheme.box}>
                <Link href={accountStatusHref} prefetch={false} className="block text-inherit hover:opacity-80 transition-opacity">
                    <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-1">Status da Conta</p>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <currentPlanTheme.icon size={14} className={currentTier === 4 ? 'fill-current' : ''} />
                      Plano {currentCanonicalPlan}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">
                      {currentPlanTheme.badge}
                    </p>
                  </Link>
                </div>
              )}
              {user ? (
                <LogoutConfirmButton>
                  {({ isLoggingOut, openConfirm }) => (
                    <button
                      onClick={openConfirm}
                      disabled={isLoggingOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <LogOut size={16} /> {isLoggingOut ? 'Saindo...' : 'Sair'}
                    </button>
                  )}
                </LogoutConfirmButton>
              ) : (
                <button
                  onClick={() => {
                    window.sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search + location.hash);
                    router.push('/auth');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 uppercase tracking-widest rounded-lg transition-all"
                >
                  Entrar
                </button>
              )}
            </div>
          </aside>
        )}

        {!isDashboardPage && !isSimulationFullscreenPage && (
          <div
            className="cm-layout-sidebar-spacer hidden w-64 flex-none overflow-hidden transition-[width] duration-200"
            aria-hidden
          />
        )}

        {/* Main Content Area */}
        <ContentContainer className="min-h-0 flex flex-1 flex-col overflow-hidden">
          {showEmailVerificationBanner && user && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              <div className={`${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto flex w-full flex-col gap-3 text-sm font-semibold md:flex-row md:items-center md:justify-between`}>
                <div className="flex min-w-0 items-start gap-3">
                  <Mail size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <p className="leading-relaxed">
                    Confirme o e-mail <strong>{user.email}</strong> para liberar todos os recursos e receber +50 XP.
                    {hasFailedEmailDeliveryNotice ? ' O envio automático ainda precisa ser refeito.' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resendTimer > 0 || isResendingConfirmation}
                  onClick={handleResendConfirmation}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/30 dark:bg-slate-950/40 dark:text-amber-100 dark:hover:bg-amber-500/10"
                >
                  {isResendingConfirmation ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  {resendTimer > 0 ? `Aguarde ${resendTimer}s` : 'Reenviar e-mail'}
                </button>
              </div>
            </div>
          )}

          {/* Desktop Top Bar with Notifications */}
          <div className={`${isSimulationFullscreenPage ? 'hidden' : 'pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-20 w-full px-3 md:flex md:px-6 lg:px-8'} z-30 items-center bg-transparent transition-colors`}>
            <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-end">
            <div className="pointer-events-auto flex items-center gap-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
                aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              >
                {theme === 'light' ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
              </button>

              {showHomeVisitorActions ? renderHomeVisitorActions() : (
                <div ref={profileMenuRef} className="relative ml-1 flex items-center gap-[18px]">
                  <button
                    type="button"
                    onClick={handleProfileMenuToggle}
                    aria-label={user ? `Abrir menu da conta de ${userName}` : 'Entrar ou acessar perfil'}
                    aria-haspopup={user ? 'menu' : undefined}
                    aria-expanded={user ? isProfileMenuOpen : undefined}
                    className="group flex items-center gap-[18px] rounded-md p-0 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <UserAvatar
                      src={userPhotoUrl}
                      name={userName}
                      alt={userName || 'Foto de perfil'}
                      className="h-9 w-9 rounded-full bg-slate-900 text-sm font-bold text-white transition-opacity group-hover:opacity-90 dark:bg-indigo-600"
                    />
                    <span className="hidden min-w-0 max-w-[170px] text-left min-[851px]:block">
                      <span className="block truncate text-[14px] font-semibold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300">{userName}</span>
                      <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">Plano {currentCanonicalPlan}</span>
                    </span>
                  </button>

                  {renderProfileQuickMenu()}
                </div>
              )}
            </div>
            </div>
          </div>

          <div className={`no-scrollbar flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950 ${isSimulationFullscreenPage ? 'p-3 sm:p-4 md:p-6' : fullWidthContent ? 'p-0 pt-[124px] sm:pt-[128px] md:pt-0' : 'p-3 pt-[124px] sm:p-4 sm:pt-[128px] md:p-6 md:pt-3 lg:p-8'} ${hasMobileTopHeader || fullWidthContent ? '' : 'pt-3 sm:pt-4 md:pt-6'}`}>
            <div className={`${isSimulationFullscreenPage ? 'mx-auto w-full max-w-7xl pb-6' : fullWidthContent ? 'w-full' : `${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto pb-12`}`}>
              {includePageExtras && !isSimulationFullscreenPage && <AdBanner type="top" className="mb-8" />}
              {children}
              {includePageExtras && !isSimulationFullscreenPage && <AdBanner type="bottom" className="mt-8" />}
              {includePageExtras && !isSimulationFullscreenPage && <Footer />}
            </div>
          </div>
        </ContentContainer>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <style jsx global>{`
          body[data-legal-reading-focus='true'] nav[aria-label='Navegação principal'] {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default React.memo(Layout);
