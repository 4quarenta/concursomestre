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
import Image from 'next/image';
import { LayoutDashboard, BookOpen, User, Menu, X, Trophy, LogOut, Timer, Zap, ShoppingBag, ShieldAlert, Mail, Bell, Check, ArrowRight, Info, Sun, Moon, MessageSquare, Shield, Lock, HelpCircle, Rocket, Crown, FileText, Layers, StickyNote, CreditCard, BarChart3, Package, ShieldCheck, Gift, ChevronDown, CalendarDays, Loader2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useTheme } from '@providers/ThemeProvider';
import PromoBanner from '../feedback/PromoBanner';
import { Notification, ErrorReport, SystemSettings } from '@types';
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
import { useNotificationsActions } from '@/state/notifications/useNotificationsActions';
import { useAdminDataStore } from '@/state/admin-data/adminDataStore';
import { clientLog } from '@services/monitoring/clientLog';
import UserAvatar from '../ui/UserAvatar';

interface LayoutProps {
  children: React.ReactNode;
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
  description: string;
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

type NotificationDropdownProps = {
  notifications: Notification[];
  unreadCount: number;
  onClose: () => void;
  onNotificationClick: (notification: Notification) => void;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onOpenAll: () => void;
};

const formatNotificationDateTime = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const NotificationDropdownPanel: React.FC<NotificationDropdownProps> = ({
  notifications,
  unreadCount,
  onClose,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenAll,
}) => {
  const visibleNotifications = notifications.filter((notification) => !notification.deletedAt);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social': return MessageSquare;
      case 'report': return Shield;
      case 'marketplace': return ShoppingBag;
      case 'system':
      default: return Info;
    }
  };

  return (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-scale-in">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Notificações</h3>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMarkAllAsRead();
            }}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
          >
            <Check size={10} />
            Marcar vistas
          </button>
        ) : null}
      </div>
      <div className="max-h-80 overflow-y-auto no-scrollbar">
        {visibleNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">Nenhuma notificação.</div>
        ) : (
          visibleNotifications.slice(0, 5).map((notification) => {
            const CategoryIcon = getCategoryIcon(notification.category);
            return (
              <div
                key={notification.id}
                onClick={() => {
                  if (!notification.link) {
                    onMarkAsRead(notification.id);
                  } else {
                    onNotificationClick(notification);
                  }
                }}
                className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
              >
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notification.category === 'social' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : notification.category === 'report' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : notification.category === 'marketplace' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    <CategoryIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-bold ${notification.type === 'error' ? 'text-red-600 dark:text-red-400' : notification.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>{notification.title}</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">{formatNotificationDateTime(notification.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{notification.message}</p>
                    {notification.evidenceUrl ? (
                      <div className="mt-3">
                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1"><Info size={10} /> Prova Anexada:</p>
                        <Image
                          src={notification.evidenceUrl}
                          alt="Prova"
                          width={640}
                          height={360}
                          unoptimized
                          className="rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 w-full object-contain bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                    ) : null}
                    {notification.link ? <p className="text-[9px] text-indigo-500 dark:text-indigo-400 font-bold uppercase mt-1 flex items-center gap-1">Ver <ArrowRight size={10} /></p> : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => {
            onClose();
            onOpenAll();
          }}
          className="w-full py-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          Ver Todas <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser: user, refreshUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const notifications = useNotificationsStore((state) => state.notifications);
  const { markNotificationAsRead, markAllNotificationsAsRead } = useNotificationsActions();
  const reports = useAdminDataStore((state) => state.reports);
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [locationHash, setLocationHash] = useState('');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const location = React.useMemo(() => {
    const search = searchParams?.toString();
    return {
      pathname,
      search: search ? `?${search}` : '',
      hash: locationHash,
    };
  }, [locationHash, pathname, searchParams]);
  const canOpenAdminPanel = canAccessAdminPanel(user);
  const simulationSearchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
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

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<EmailConfirmationDeliveryNotice | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncHash = () => {
      setLocationHash(window.location.hash || '');
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);

    return () => {
      window.removeEventListener('hashchange', syncHash);
    };
  }, [pathname, searchParams]);

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
      if (!profileMenuRef.current?.contains(event.target as Node)) {
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
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', enabled: !!user, benefitKey: 'module.dashboard' },
    { label: 'Quest\u00F5es', icon: BookOpen, path: '/practice', enabled: practiceEnabled, benefitKey: 'module.practice' },
    { label: 'Lei comentada', icon: FileText, path: '/lei-comentada', enabled: true, moduleEnabled: annotatedLawsEnabled, benefitKey: 'module.lei_comentada' },
    { label: 'Flashcards', icon: Layers, path: '/flashcards', enabled: true, moduleEnabled: flashcardsEnabled, benefitKey: 'module.flashcards' },
    { label: 'Simulados', icon: Timer, path: '/simulation', enabled: simulationsEnabled, benefitKey: 'module.simulations' },
    { label: 'Cronograma', icon: CalendarDays, path: '/cronograma', enabled: true, moduleEnabled: studyScheduleEnabled, benefitKey: 'module.schedule' },
    { label: 'Raio-X Banca', icon: Zap, path: '/x-ray', enabled: xRayEnabled, benefitKey: ['module.xray', 'xray_banca'] },
    { label: 'Rankings', icon: Trophy, path: '/ranking', enabled: rankingsEnabled },
    { label: 'Loja', icon: ShoppingBag, path: '/marketplace', enabled: marketplaceEnabled, benefitKey: 'module.marketplace' },
    { label: 'Perfil', icon: User, path: '/profile/personal', enabled: !!user },
  ] satisfies SidebarNavItem[]).filter((item) => {
    const isGloballyDisabled = item.enabled === false;
    const isModuleDisabled = item.moduleEnabled === false;

    if (isGloballyDisabled || isModuleDisabled) {
      return isStrictAdmin;
    }

    return true;
  });

  if (canOpenAdminPanel) {
    navItems.push({
      label: 'Painel Admin',
      icon: ShieldAlert,
      path: buildAdminPath('panel', 'dashboard'),
      enabled: true,
      badge: adminMenuBadgeCount > 0 ? adminMenuBadgeCount : undefined,
    });
  }

  const isActive = (path: string) => {
    if (path.startsWith('/profile')) return location.pathname.startsWith('/profile');
    if (path.startsWith('/admin')) return location.pathname.startsWith('/admin');
    return location.pathname === path;
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
        href: '/levels',
        label: 'Níveis XP',
        description: 'Regras de XP e ranking de estudo.',
        icon: Crown,
      },
      {
        tab: 'personal',
        label: 'Dados pessoais',
        description: 'Foto, dados da conta e cartões salvos.',
        icon: User,
      },
      {
        tab: 'billing',
        label: 'Assinatura',
        description: 'Plano ativo, renovação e cobranças.',
        icon: CreditCard,
      },
      {
        tab: 'support-history',
        label: 'Histórico de suporte',
        description: 'Chamados, sugestões e respostas.',
        icon: MessageSquare,
      },
      {
        tab: 'billing-history',
        label: 'Transações',
        description: 'Histórico financeiro e comprovantes.',
        icon: BarChart3,
      },
      {
        tab: 'materials',
        label: 'Meus materiais',
        description: 'Materiais adquiridos e downloads.',
        icon: Package,
      },
      {
        tab: 'notebook',
        label: 'Minhas anotações',
        description: 'Anotações e registros salvos.',
        icon: StickyNote,
      },
      {
        tab: 'security',
        label: 'Privacidade',
        description: 'Segurança, proteção e acesso.',
        icon: ShieldCheck,
      },
    ];

    if (referralEnabled) {
      items.splice(5, 0, {
        tab: 'referral',
        label: 'Indique e ganhe',
        description: 'Convites, benefícios e afiliação.',
        icon: Gift,
      });
    }

    return items;
  }, [referralEnabled]);

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

  const handleNotificationClick = (n: Notification) => {
    markNotificationAsRead(n.id);
    if (n.link) {
      router.push(n.link);
      if (n.link.includes('#')) {
        const id = n.link.split('#')[1];
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all');
            setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500/50'), 2000);
          }
        }, 600);
      }
    }
    setIsNotifOpen(false);
  };

  const handleNotificationsToggle = () => {
    setIsNotifOpen((current) => {
      const next = !current;
      if (next && unreadCount > 0) {
        void markAllNotificationsAsRead(user?.id ? String(user.id) : undefined).catch((error) => {
          clientLog.warn('[notifications] Nao foi possivel marcar notificacoes como vistas ao abrir o box.', error);
        });
      }
      return next;
    });
  };

  const handleProfileMenuToggle = () => {
    if (!user) {
      window.sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search + location.hash);
      router.push('/auth');
      return;
    }

    setIsProfileMenuOpen((current) => !current);
  };

  const handleProfileQuickMenuNavigate = (item: ProfileQuickMenuItem) => {
    setIsProfileMenuOpen(false);
    router.push(item.href || buildProfilePath(item.tab || 'personal'));
  };

  const isDashboardPage = location.pathname.startsWith('/admin') || location.pathname === '/partner-dashboard';
  const isSimulationFullscreenPage = location.pathname.startsWith('/simulation')
    && simulationSearchParams.get('immersive') === '1';
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

      {showEmailVerificationBanner && user && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className={`${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto flex flex-col gap-3 text-sm font-semibold md:flex-row md:items-center md:justify-between`}>
            <div className="flex items-start gap-3">
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

      <div className="min-h-0 flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Mobile Header */}
        {hasMobileTopHeader && (
          <div className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <div className="flex items-center justify-between">
            <PublicBrandLink width={190} priority />
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-black uppercase"
              >
                <span className="inline-flex" aria-hidden="true">
                  <Moon size={20} className="dark:hidden" />
                  <Sun size={20} className="hidden dark:block" />
                </span>
              </button>
              <div className="relative">
                <button onClick={handleNotificationsToggle} className="p-1 relative">
                  <Bell size={20} className="text-slate-600 dark:text-slate-400" />
                  {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
                </button>
                {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                    <NotificationDropdownPanel
                      notifications={notifications}
                      unreadCount={unreadCount}
                      onClose={() => setIsNotifOpen(false)}
                      onNotificationClick={handleNotificationClick}
                      onMarkAsRead={markNotificationAsRead}
                      onMarkAllAsRead={() => void markAllNotificationsAsRead(user?.id ? String(user.id) : undefined)}
                      onOpenAll={() => router.push('/notifications')}
                    />
                  </>
                )}
              </div>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 dark:text-slate-400">
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
            </div>
          </div>
        )}

        {/* Sidebar Navigation */}
        {!isDashboardPage && !isSimulationFullscreenPage && (
          <aside className={`
            cm-layout-sidebar fixed inset-y-0 left-0 z-30 flex h-[100dvh] w-[84vw] max-w-64 flex-col overflow-hidden border-r border-slate-200 bg-white transform transition-transform duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900
            md:w-64
            ${isMobileMenuOpen
              ? 'translate-x-0 opacity-100'
              : '-translate-x-full opacity-100 md:translate-x-0'}
          `}>
            <div className="hidden shrink-0 px-5 pb-4 pt-5 md:flex">
              <PublicBrandLink
                width={215}
                priority
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
                    {item.path === '/changelog' && unreadCount > 0 && (
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
            className="cm-layout-sidebar-spacer hidden w-64 flex-none overflow-hidden transition-[width] duration-200 md:block"
            aria-hidden
          />
        )}

        {/* Main Content Area */}
        <main className="min-h-0 flex flex-1 flex-col overflow-hidden">
          {/* Desktop Top Bar with Notifications */}
          <div className={`${isSimulationFullscreenPage ? 'hidden' : 'hidden md:flex'} z-20 items-center justify-end bg-slate-50/80 p-4 px-6 backdrop-blur transition-colors dark:bg-slate-950/80 lg:px-8`}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
                aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              >
                <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
                  <Moon size={20} className="block shrink-0 dark:hidden" />
                  <Sun size={20} className="hidden shrink-0 dark:block" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/support')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                title="Suporte e Feedback"
                aria-label="Abrir suporte e feedback"
              >
                <HelpCircle size={20} className="block shrink-0" aria-hidden="true" />
              </button>

              {/* Sempre mostrar notificações se o usuário estiver logado, independente da feature flag global, se o usuário pediu para restaurar */}
              {user && (
                <div className="relative h-9 w-9 shrink-0">
                  <button
                    type="button"
                    onClick={handleNotificationsToggle}
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                    aria-label="Abrir notificações"
                    aria-expanded={isNotifOpen}
                  >
                    <Bell size={20} className="block shrink-0" aria-hidden="true" />
                    {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />}
                  </button>
                  {isNotifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                      <NotificationDropdownPanel
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onClose={() => setIsNotifOpen(false)}
                        onNotificationClick={handleNotificationClick}
                        onMarkAsRead={markNotificationAsRead}
                        onMarkAllAsRead={() => void markAllNotificationsAsRead(user?.id ? String(user.id) : undefined)}
                        onOpenAll={() => router.push('/notifications')}
                      />
                    </>
                  )}
                </div>
              )}
              <div ref={profileMenuRef} className="relative flex items-center gap-3 border-l border-slate-200 pl-6 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleProfileMenuToggle}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-all hover:bg-white hover:shadow-sm dark:hover:bg-slate-900"
                >
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300">{userFirstName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{user ? `Nível ${userLevel}` : 'Visitante'}</p>
                  </div>
                  <UserAvatar
                    src={userPhotoUrl}
                    name={userName}
                    alt={userName || 'Foto de perfil'}
                    className="h-9 w-9 rounded-full bg-slate-900 text-sm font-bold text-white shadow-md transition-opacity group-hover:opacity-90 dark:bg-indigo-600"
                  />
                  <ChevronDown size={15} className={`text-slate-400 transition-transform dark:text-slate-500 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {user && isProfileMenuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{userFirstName}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{user.email || 'Conta conectada'}</p>
                      <div className="mt-3 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                        Nível {userLevel}
                      </div>
                    </div>

                    <div className="p-2">
                      {profileQuickMenuItems.map((item) => {
                        const itemPath = item.href || buildProfilePath(item.tab || 'personal');
                        const isCurrent = location.pathname === itemPath;

                        return (
                          <button
                            key={item.href || item.tab || item.label}
                            type="button"
                            onClick={() => handleProfileQuickMenuNavigate(item)}
                            className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                              isCurrent
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-200'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                            }`}
                          >
                            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              isCurrent
                                ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              <item.icon size={17} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black">{item.label}</span>
                              <span className="mt-1 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{item.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                      <LogoutConfirmButton>
                        {({ isLoggingOut, openConfirm }) => (
                          <button
                            type="button"
                            onClick={openConfirm}
                            disabled={isLoggingOut}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                          >
                            <LogOut size={16} />
                            {isLoggingOut ? 'Saindo...' : 'Sair'}
                          </button>
                        )}
                      </LogoutConfirmButton>
                    </div>

                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`no-scrollbar flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950 ${isSimulationFullscreenPage ? 'p-3 sm:p-4 md:p-6' : 'p-3 pt-[84px] sm:p-4 sm:pt-[88px] md:p-6 md:pt-6 lg:p-8'} ${hasMobileTopHeader ? '' : 'pt-3 sm:pt-4 md:pt-6'}`}>
            <div className={`${isSimulationFullscreenPage ? 'mx-auto w-full max-w-7xl pb-6' : `${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto pb-12`}`}>
              {!isSimulationFullscreenPage && <AdBanner type="top" className="mb-8" />}
              {children}
              {!isSimulationFullscreenPage && <AdBanner type="bottom" className="mt-8" />}
              {!isSimulationFullscreenPage && <Footer />}
            </div>
          </div>
        </main>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <style jsx global>{`
          body[data-legal-reading-focus='true'] .cm-layout-sidebar {
            transform: translateX(-100%);
            opacity: 0;
            pointer-events: none;
          }

          body[data-legal-reading-focus='true'] .cm-layout-sidebar-spacer {
            width: 0 !important;
          }
        `}</style>
      </div>
    </div>
  );
};

export default React.memo(Layout);
