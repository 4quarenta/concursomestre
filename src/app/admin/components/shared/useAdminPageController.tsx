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

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, DollarSign, LayoutDashboard, Megaphone, MessageSquare, Settings, ShoppingBag } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useTheme } from '@providers/ThemeProvider';
import { useToast } from '@providers/ToastProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { adminService } from '@services/admin/adminService';
import { questionService } from '@services/questions';
import type { ErrorReport, Question, Transaction } from '@types';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { useSystemSettingsActions } from '@/state/app-config/useSystemSettingsActions';
import { useAdminDataActions } from '@/state/admin-data/useAdminDataActions';
import { useAdminDataStore } from '@/state/admin-data/adminDataStore';
import { useQuestionBankStore } from '@/state/question-bank/questionBankStore';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { useNotificationsActions } from '@/state/notifications/useNotificationsActions';
import {
  ADMIN_SECTION_CONFIG,
  DEFAULT_SECTION_BY_TAB,
  isFinanceSection,
  isMarketingSection,
  isMarketplaceSection,
  isOperationSection,
  isPanelSection,
  isSettingsSection,
  isSupportSection,
  filterAdminTabsForRole,
  filterAdminSectionsForRole,
  normalizeAdminUserRole,
  resolveSupportLandingSection,
  TAB_DESCRIPTIONS,
  buildAdminPath,
  resolveAdminRouteForRole,
  type AdminFinanceSection,
  type AdminMarketingSection,
  type AdminMarketplaceSection,
  type AdminNavigationTab,
  type AdminPageTab,
  type AdminPanelSection,
  type AdminOperationSection,
  type AdminSettingsSection,
  type AdminSupportSection,
} from '../../config/adminPageNavigationConfig';
import { resolveLegacyAdminDestination } from '../../config/adminLegacyNavigation';

type AdminNotificationSummary = {
  deletedAt?: number | string | null;
  isRead?: boolean;
};

type AdminSettingsWithFeedbackCount = {
  adminFeedbackCount?: number | string | null;
};

export type { AdminFinanceSection, AdminMarketingSection, AdminMarketplaceSection, AdminPageTab, AdminPanelSection, AdminOperationSection, AdminSettingsSection, AdminSupportSection } from '../../config/adminPageNavigationConfig';

/**
 * Controller principal da pagina administrativa.
 * Ele converte links legados para os cinco dominios oficiais do admin,
 * centraliza o estado de navegação e prepara os shells menores do painel.
 *
 * @since 1.0.0
 */
export const useAdminPageController = () => {
  const questions = useQuestionBankStore((store) => store.questions);
  const prependQuestion = useQuestionBankStore((store) => store.prependQuestion);
  const upsertQuestion = useQuestionBankStore((store) => store.upsertQuestion);
  const removeQuestionFromBank = useQuestionBankStore((store) => store.removeQuestion);
  const users = useAdminDataStore((store) => store.users);
  const reports = useAdminDataStore((store) => store.reports);
  const rankings = useAdminDataStore((store) => store.rankings);
  const notifications = useNotificationsStore((store) => store.notifications);
  const systemSettings = useAppConfigStore((store) => store.systemSettings);
  const { updateSystemSettings, saveSystemSettingsNow } = useSystemSettingsActions();
  const { ensureUsersLoaded, ensureReportsLoaded, ensureRankingsLoaded, resolveReport, updateRanking } = useAdminDataActions();
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();
  const { markNotificationAsRead, markAllNotificationsAsRead } = useNotificationsActions();
  const { materials, transactions, isLoadingTransactions, moderateMaterial, deleteMaterial } = useMarketplace();
  const { currentUser } = useAuth();
  const adminUserRole = useMemo(() => normalizeAdminUserRole(
    currentUser?.role || (currentUser?.isAdmin ? 'admin' : currentUser?.isStaff ? 'staff' : ''),
  ), [currentUser?.isAdmin, currentUser?.isStaff, currentUser?.role]);
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const router = useRouter();
  const [, startNavigationTransition] = useTransition();
  const pathname = usePathname() || '/admin';
  const searchParams = useSearchParams();
  const location = useMemo(() => {
    const search = searchParams?.toString();
    return {
      pathname,
      search: search ? `?${search}` : '',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
    };
  }, [pathname, searchParams]);
  const params = useParams<{ tab?: string | string[]; section?: string | string[] }>();
  const routeTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const routeSection = Array.isArray(params.section) ? params.section.join('/') : params.section;
  const initialResolvedRoute = useMemo(() => (
    resolveAdminRouteForRole(
      routeTab || searchParams?.get('tab'),
      routeSection || searchParams?.get('section'),
      adminUserRole,
    )
  ), [adminUserRole, routeSection, routeTab, searchParams]);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<AdminPageTab>(initialResolvedRoute.tab);
  const [initialPanelSection, setInitialPanelSection] = useState<AdminPanelSection>(() => (
    initialResolvedRoute.tab === 'panel' && isPanelSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'dashboard'
  ));
  const [initialOperationSection, setInitialOperationSection] = useState<AdminOperationSection>(() => (
    initialResolvedRoute.tab === 'operation' && isOperationSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'questions'
  ));
  const [initialMarketplaceSection, setInitialMarketplaceSection] = useState<AdminMarketplaceSection>(() => (
    initialResolvedRoute.tab === 'marketplace' && isMarketplaceSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'vendors'
  ));
  const [initialFinanceSection, setInitialFinanceSection] = useState<AdminFinanceSection>(() => (
    initialResolvedRoute.tab === 'finance' && isFinanceSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'transactions'
  ));
  const [initialMarketingSection, setInitialMarketingSection] = useState<AdminMarketingSection>(() => (
    initialResolvedRoute.tab === 'marketing' && isMarketingSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'landing-pages'
  ));
  const [initialSupportSection, setInitialSupportSection] = useState<AdminSupportSection>(() => (
    initialResolvedRoute.tab === 'support' && isSupportSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'feedback'
  ));
  const [initialSettingsSection, setInitialSettingsSection] = useState<AdminSettingsSection>(() => (
    initialResolvedRoute.tab === 'settings' && isSettingsSection(initialResolvedRoute.section)
      ? initialResolvedRoute.section
      : 'general'
  ));

  const addQuestion = useCallback(async (payload: Question) => {
    const response = await questionService.createQuestions([payload]);
    if (!response.success) {
      throw new Error('Falha ao criar a questao.');
    }

    const createdQuestion = response.created?.[0] || payload;
    prependQuestion(createdQuestion);
    addToast('Questão adicionada!', 'success');
    return response;
  }, [addToast, prependQuestion]);

  const addQuestions = useCallback(async (payload: Question[]) => {
    const response = await questionService.createQuestions(payload);
    if (!response.success) {
      throw new Error('Falha ao salvar questões.');
    }

    const createdQuestions = response.created && response.created.length > 0
      ? response.created
      : payload;

    createdQuestions.forEach((question) => {
      upsertQuestion(question);
    });
    addToast(`${createdQuestions.length} questões salvas!`, 'success');
    return response;
  }, [addToast, upsertQuestion]);

  const updateQuestion = useCallback(async (payload: Question) => {
    const response = await questionService.updateQuestion(String(payload.id), payload);
    if (!response.success) {
      throw new Error('Falha ao atualizar a questao.');
    }

    upsertQuestion(payload);
    addToast('Questão atualizada!', 'success');
    return response;
  }, [addToast, upsertQuestion]);

  const deleteQuestion = useCallback(async (questionId: number | string) => {
    const response = await questionService.deleteQuestion(questionId);
    if (!response.success) {
      throw new Error(response.message || 'Falha ao remover a questao.');
    }

    removeQuestionFromBank(questionId);
    addToast('Questão removida.', 'info');
    return response;
  }, [addToast, removeQuestionFromBank]);

  const unreadCount = ((notifications || []) as AdminNotificationSummary[])
    .filter((notification) => !notification.isRead && !notification.deletedAt).length;
  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const [pendingRefundRequestsCount, setPendingRefundRequestsCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [pendingMaterialsModerationCount, setPendingMaterialsModerationCount] = useState(0);
  const refundRequestsCountFromTransactions = ((transactions || []) as Transaction[])
    .filter((transaction) => transaction.status === 'refund_requested').length;
  const isViewingRefundQueue = activeTab === 'support' && initialSupportSection === 'refunds';
  const refundRequestsCount = isViewingRefundQueue && !isLoadingTransactions
    ? refundRequestsCountFromTransactions
    : Math.max(refundRequestsCountFromTransactions, pendingRefundRequestsCount);
  const openReportsCountFromList = ((reports || []) as ErrorReport[])
    .filter((report) => !['resolved', 'ignored'].includes(String(report.status || '').toLowerCase())).length;
  const openReportsCount = Math.max(openReportsCountFromList, pendingReportsCount);
  const settingsFeedbackCount = Math.max(0, Number((systemSettings as AdminSettingsWithFeedbackCount | undefined)?.adminFeedbackCount || 0));
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(settingsFeedbackCount);
  const [pendingSupportThreadsCount, setPendingSupportThreadsCount] = useState(0);
  const [pendingCommentsCount, setPendingCommentsCount] = useState(0);
  const lastSupportCountersSyncRef = useRef<{ userId: string; timestamp: number } | null>(null);
  const feedbackCount = pendingFeedbackCount;
  const pendingMaterialsCountFromList = ((materials || []) as Array<{ status?: string | null }>)
    .filter((material) => String(material.status || '').toLowerCase() === 'pending').length;
  const pendingMarketplaceMaterialsCount = Math.max(pendingMaterialsModerationCount, pendingMaterialsCountFromList);
  const supportInboxCount = feedbackCount + pendingSupportThreadsCount + openReportsCount + refundRequestsCount + pendingCommentsCount;
  const panelAlertsCount = supportInboxCount + pendingMarketplaceMaterialsCount;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setPendingFeedbackCount(settingsFeedbackCount);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [settingsFeedbackCount]);

  useEffect(() => {
    if (!currentUser?.id || adminUserRole !== 'admin') {
      lastSupportCountersSyncRef.current = null;
      const frameId = window.requestAnimationFrame(() => {
        setPendingFeedbackCount(settingsFeedbackCount);
        setPendingSupportThreadsCount(0);
        setPendingCommentsCount(0);
        setPendingRefundRequestsCount(0);
        setPendingReportsCount(0);
        setPendingMaterialsModerationCount(0);
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    const shouldSyncSupportCounters = Boolean(activeTab);

    if (!shouldSyncSupportCounters) {
      return undefined;
    }

    const lastSync = lastSupportCountersSyncRef.current;
    if (
      lastSync
      && lastSync.userId === currentUser.id
      && (Date.now() - lastSync.timestamp) < 60_000
    ) {
      return undefined;
    }

    let isCurrent = true;
    const frameId = window.requestAnimationFrame(() => {
      adminService.getStats({ period: 'all' })
        .then((stats) => {
          if (isCurrent) {
            lastSupportCountersSyncRef.current = {
              userId: currentUser.id,
              timestamp: Date.now(),
            };
            setPendingFeedbackCount(Number(stats.feedback_count || settingsFeedbackCount || 0));
            setPendingSupportThreadsCount(Number((stats as { support_threads_count?: number }).support_threads_count || 0));
            setPendingCommentsCount(Number(stats.pending_comments_count || 0));
            setPendingRefundRequestsCount(Number(stats.refund_requests_count || 0));
            setPendingReportsCount(Number((stats as { reports_count?: number }).reports_count || 0));
            setPendingMaterialsModerationCount(Number((stats as { pending_materials_count?: number }).pending_materials_count || 0));
          }
        })
        .catch(() => {
          if (isCurrent) {
            setPendingFeedbackCount(settingsFeedbackCount);
            setPendingSupportThreadsCount(0);
            setPendingCommentsCount(0);
            setPendingRefundRequestsCount(0);
            setPendingReportsCount(0);
            setPendingMaterialsModerationCount(0);
          }
        });
    });

    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [activeTab, adminUserRole, currentUser?.id, settingsFeedbackCount]);
  const sectionBadges = useMemo(() => ({
    support: {
      feedback: feedbackCount,
      threads: pendingSupportThreadsCount,
      reports: openReportsCount,
      comments: pendingCommentsCount,
      refunds: refundRequestsCount,
    },
    marketplace: {
      materials: pendingMarketplaceMaterialsCount,
    },
  }), [feedbackCount, openReportsCount, pendingCommentsCount, pendingMarketplaceMaterialsCount, pendingSupportThreadsCount, refundRequestsCount]);
  const supportLandingSection = useMemo(() => resolveSupportLandingSection(sectionBadges.support), [sectionBadges]);

  const adminTabs = useMemo<AdminNavigationTab[]>(() => filterAdminTabsForRole([
    { key: 'panel', label: 'Dashboard', icon: LayoutDashboard, badge: panelAlertsCount > 0 ? panelAlertsCount : undefined, group: 'Conteúdo', description: 'Visão geral e saúde operacional' },
    { key: 'operation', label: 'Conteúdo', icon: BookOpen, group: 'Conteúdo', description: 'Questões, provas, blog, importação, taxonomias, lei comentada e usuários' },
    { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, group: 'Comercial', description: 'Vendedores, materiais publicados e revisão bloqueada' },
    { key: 'finance', label: 'Financeiro', icon: DollarSign, group: 'Comercial', description: 'Transações, planos, cupons, analytics e automação' },
    { key: 'marketing', label: 'Marketing', icon: Megaphone, group: 'Comercial', description: 'Landing pages, campanhas, temas visuais e redes sociais' },
    { key: 'support', label: 'Solicitações', icon: MessageSquare, badge: supportInboxCount > 0 ? supportInboxCount : undefined, group: 'Relacionamento', description: 'Solicitações, feedbacks, avaliações, denúncias e comentários moderados' },
    { key: 'settings', label: 'Configurações', icon: Settings, group: 'Sistema', description: 'Integrações e controles globais' },
  ], adminUserRole), [adminUserRole, panelAlertsCount, supportInboxCount]);

  const activeTabLabel = adminTabs.find((tab) => tab.key === activeTab)?.label || 'Painel';
  const activeSections = filterAdminSectionsForRole(activeTab, ADMIN_SECTION_CONFIG[activeTab], adminUserRole);
  const searchTargets = useMemo(() => {
    const tabTargets = adminTabs.map((tab) => ({
      label: tab.label,
      description: tab.description,
      path: buildAdminPath(tab.key, DEFAULT_SECTION_BY_TAB[tab.key]),
      group: tab.group || 'Admin',
    }));

    const allowedTabKeys = new Set(adminTabs.map((tab) => tab.key));
    const sectionTargets = (Object.entries(ADMIN_SECTION_CONFIG) as [AdminPageTab, { key: string; label: string }[]][])
      .filter(([tabKey]) => allowedTabKeys.has(tabKey))
      .flatMap(([tabKey, sections]) => (
        filterAdminSectionsForRole(tabKey, sections, adminUserRole).map((section) => ({
          label: section.label,
          description: `${adminTabs.find((tab) => tab.key === tabKey)?.label || tabKey} - ${TAB_DESCRIPTIONS[tabKey]}`,
          path: buildAdminPath(tabKey, section.key),
          group: adminTabs.find((tab) => tab.key === tabKey)?.group || 'Admin',
        }))
      ));

    return [...tabTargets, ...sectionTargets];
  }, [adminTabs, adminUserRole]);
  const legacySearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeSectionLabel = useMemo(() => {
    const currentKey = activeTab === 'panel'
      ? initialPanelSection
      : activeTab === 'operation'
        ? initialOperationSection
        : activeTab === 'marketplace'
          ? initialMarketplaceSection
        : activeTab === 'finance'
          ? initialFinanceSection
          : activeTab === 'marketing'
            ? initialMarketingSection
          : activeTab === 'support'
            ? initialSupportSection
            : initialSettingsSection;

    return ADMIN_SECTION_CONFIG[activeTab].find((section) => section.key === currentKey)?.label || '';
  }, [activeTab, initialFinanceSection, initialMarketingSection, initialMarketplaceSection, initialOperationSection, initialPanelSection, initialSettingsSection, initialSupportSection]);

  const activeSectionKey = useMemo(() => (
    activeTab === 'panel'
      ? initialPanelSection
      : activeTab === 'operation'
        ? initialOperationSection
        : activeTab === 'marketplace'
          ? initialMarketplaceSection
        : activeTab === 'finance'
          ? initialFinanceSection
          : activeTab === 'marketing'
            ? initialMarketingSection
            : activeTab === 'support'
              ? initialSupportSection
              : initialSettingsSection
  ), [activeTab, initialFinanceSection, initialMarketingSection, initialMarketplaceSection, initialOperationSection, initialPanelSection, initialSettingsSection, initialSupportSection]);

  const syncAdminUrl = (tab: AdminPageTab, section?: string, options?: { replace?: boolean; hash?: string }) => {
    const resolved = resolveAdminRouteForRole(tab, section, adminUserRole);
    const nextPath = buildAdminPath(resolved.tab, resolved.section, options?.hash);
    setActiveTabState(resolved.tab);
    setGroupSection(resolved.tab, resolved.section);

    startNavigationTransition(() => {
      if (options?.replace ?? true) {
        router.replace(nextPath, { scroll: false });
      } else {
        router.push(nextPath, { scroll: false });
      }
    });
  };

  const setGroupSection = (tab: AdminPageTab, section: string) => {
    if (tab === 'panel' && isPanelSection(section)) {
      setInitialPanelSection(section);
    } else if (tab === 'operation' && isOperationSection(section)) {
      setInitialOperationSection(section);
    } else if (tab === 'marketplace' && isMarketplaceSection(section)) {
      setInitialMarketplaceSection(section);
    } else if (tab === 'finance' && isFinanceSection(section)) {
      setInitialFinanceSection(section);
    } else if (tab === 'marketing' && isMarketingSection(section)) {
      setInitialMarketingSection(section);
    } else if (tab === 'support' && isSupportSection(section)) {
      setInitialSupportSection(section);
    } else if (tab === 'settings' && isSettingsSection(section)) {
      setInitialSettingsSection(section);
    }
  };

  const handleTabChange = (nextTab: AdminPageTab) => {
    syncAdminUrl(nextTab, nextTab === 'support' ? supportLandingSection : DEFAULT_SECTION_BY_TAB[nextTab]);
  };

  const handleSectionChange = (tab: AdminPageTab, section: string) => {
    syncAdminUrl(tab, section);
  };

  const navigateAdminDestination = (tab: AdminPageTab, section?: string) => {
    if (section) {
      handleSectionChange(tab, section);
      return;
    }

    handleTabChange(tab);
  };

  /**
   * Sincroniza a URL com o dominio correto e preserva compatibilidade com links antigos.
   *
   * @since 1.0.0
   */
  useEffect(() => {
    const route = resolveAdminRouteForRole(
      routeTab || legacySearchParams.get('tab'),
      routeSection || legacySearchParams.get('section'),
      adminUserRole,
    );
    const shouldPrefetchUsers = (
      route.tab === 'finance'
      || route.tab === 'marketplace'
      || (route.tab === 'operation' && route.section === 'users')
    );
    const shouldPrefetchTaxonomies = (
      route.tab === 'operation'
      && !['users', 'files', 'blog', 'novidades'].includes(route.section)
    );
    const shouldPrefetchRankings = route.tab === 'support' && route.section === 'rankings';
    const shouldPrefetchReports = (
      (route.tab === 'support' && route.section === 'reports')
      || (route.tab === 'panel' && route.section === 'alerts')
    );

    const frameId = window.requestAnimationFrame(() => {
      setActiveTabState(route.tab);
      setGroupSection(route.tab, route.section);

      const canonicalAdminPath = buildAdminPath(route.tab, route.section, location.hash);
      const currentAdminPath = `${location.pathname}${location.hash}`;

      if (location.search || canonicalAdminPath !== currentAdminPath) {
        router.replace(canonicalAdminPath);
        return;
      }

      if (shouldPrefetchReports) {
        void ensureReportsLoaded();
      }

      if (shouldPrefetchUsers) {
        void ensureUsersLoaded();
      }

      if (shouldPrefetchRankings) {
        void ensureRankingsLoaded();
      }

      if (shouldPrefetchTaxonomies) {
        void ensureTaxonomiesLoaded();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    routeSection,
    routeTab,
    legacySearchParams,
    location.hash,
    location.pathname,
    location.search,
    router,
    ensureUsersLoaded,
    ensureReportsLoaded,
    ensureRankingsLoaded,
    ensureTaxonomiesLoaded,
    adminUserRole,
  ]);

  /**
   * Permite que atalhos internos apontem para grupos novos sem quebrar a assinatura antiga.
   *
   * @since 1.0.0
   */
  const handleDashboardNavigate = (tab: string, subTab?: string) => {
    const destination = resolveLegacyAdminDestination(tab, subTab, supportLandingSection);
    if (destination) handleSectionChange(destination.tab, destination.section);
  };

  const navigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const databaseBackedSection = activeTab === 'marketplace' && ['materials', 'blocked'].includes(initialMarketplaceSection)
    ? initialMarketplaceSection
    : activeTab === 'support' && ['rankings'].includes(initialSupportSection)
      ? initialSupportSection
      : initialOperationSection;

  return {
    activeTab,
    setActiveTab: handleTabChange,
    handleSectionChange,
    activeSections,
    activeTabLabel,
    activeTabDescription: TAB_DESCRIPTIONS[activeTab],
    activeSectionLabel,
    adminTabs,
    sectionBadges,
    theme,
    toggleTheme,
    isNotifOpen,
    setIsNotifOpen,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    unreadCount,
    navigate,
    currentUser,
    userInitials,
    systemSettings,
    topBarProps: {
      theme,
      onToggleTheme: toggleTheme,
      notificationsEnabled: Boolean(systemSettings?.features?.notificationsEnabled),
      isNotifOpen,
      setIsNotifOpen,
      onCloseNotifications: () => setIsNotifOpen(false),
      notifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      unreadCount,
      navigate,
      currentUserName: currentUser?.name,
      currentUserFirstName: currentUser?.name?.trim().split(/\s+/)[0] || undefined,
      currentTabLabel: activeTabLabel,
      currentSectionLabel: activeSectionLabel,
      userInitials,
      searchTargets,
      primaryActionLabel: null,
    },
    panelSectionProps: {
      questions,
      allMaterials: materials,
      allTransactions: transactions,
      allUsers: users,
      systemSettings,
      allReports: reports,
      allRankings: rankings,
      onNavigate: handleDashboardNavigate,
      initialSection: initialPanelSection,
      onSectionChange: (section: AdminPanelSection) => handleSectionChange('panel', section),
      standaloneSection: true,
    },
    panelSectionKey: initialPanelSection,
    databaseSectionProps: {
      questions,
      allUsers: users,
      allMaterials: materials,
      allReports: reports,
      rankings,
      onDeleteQuestion: deleteQuestion,
      onAddQuestion: addQuestion,
      onAddQuestions: addQuestions,
      onUpdateQuestion: updateQuestion,
      resolveReport: (reportId: string | number, status: string, reason?: string) => resolveReport(
        String(reportId),
        status === 'ignored' ? 'ignored' : 'resolved',
        reason || 'Denúncia tratada pela equipe administrativa.',
      ),
      moderateMaterial,
      onDeleteMaterial: deleteMaterial,
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      updateRanking,
      ensureUsersLoaded,
      initialTab: databaseBackedSection,
      standaloneSection: true,
    },
    databaseSectionKey: initialOperationSection,
    marketplaceSectionKey: initialMarketplaceSection,
    financeSectionProps: {
      allTransactions: transactions,
      allMaterials: materials,
      allUsers: users,
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      initialSection: initialFinanceSection,
      onSectionChange: (section: 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics') => (
        handleSectionChange('finance', section as AdminFinanceSection)
      ),
      standaloneSection: true,
    },
    financeSectionKey: initialFinanceSection,
    marketingSectionProps: {
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      initialSection: initialMarketingSection,
      onSectionChange: (section: AdminMarketingSection) => handleSectionChange('marketing', section),
      standaloneSection: true,
    },
    marketingSectionKey: initialMarketingSection,
    supportSectionProps: {
      initialSection: initialSupportSection,
      allReports: reports,
      pendingFeedbackCount: feedbackCount,
      pendingSupportThreadsCount,
      onPendingFeedbackCountChange: setPendingFeedbackCount,
      onPendingSupportThreadsCountChange: setPendingSupportThreadsCount,
      onPendingCommentsCountChange: setPendingCommentsCount,
      onResolveReport: (report: ErrorReport) => {
        const moderationPayload = report as ErrorReport & {
          moderationAction?: 'resolved' | 'ignored';
          userResponse?: string;
          internalNote?: string;
          moderationActionApplied?: string;
        };
        const moderationAction = moderationPayload.moderationAction;
        return resolveReport(
          report.id,
          moderationAction === 'ignored' ? 'ignored' : 'resolved',
          report.resolution || report.reason || 'Denúncia tratada pela equipe administrativa.',
          report.evidenceUrl,
          {
            userResponse: moderationPayload.userResponse,
            internalNote: moderationPayload.internalNote,
            moderationAction: moderationPayload.moderationActionApplied,
          },
        );
      },
      onSectionChange: (section: AdminSupportSection) => handleSectionChange('support', section),
      standaloneSection: true,
    },
    supportSectionKey: initialSupportSection,
    settingsSectionProps: {
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      addToast,
      initialSection: initialSettingsSection,
      onSectionChange: (section: AdminSettingsSection) => handleSectionChange('settings', section),
      standaloneSection: true,
    },
    settingsSectionKey: initialSettingsSection,
    activeSectionKey,
    navigateAdminDestination,
  };
};
