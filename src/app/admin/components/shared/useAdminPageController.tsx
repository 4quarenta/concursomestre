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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  DollarSign,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useTheme } from '@providers/ThemeProvider';
import { useToast } from '@providers/ToastProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { adminService, type AdminFeedbackThread } from '@services/admin/adminService';
import {
  ADMIN_SECTION_CONFIG,
  DEFAULT_SECTION_BY_TAB,
  isFinanceSection,
  isMarketingSection,
  isOperationSection,
  isPanelSection,
  isSettingsSection,
  isSupportSection,
  TAB_DESCRIPTIONS,
  buildAdminPath,
  resolveAdminRoute,
  type AdminFinanceSection,
  type AdminMarketingSection,
  type AdminNavigationTab,
  type AdminPageTab,
  type AdminPanelSection,
  type AdminOperationSection,
  type AdminSettingsSection,
  type AdminSupportSection,
} from '../../config/adminPageNavigationConfig';

const countPendingFeedbackThreads = (threads: AdminFeedbackThread[]) =>
  threads.filter((thread) => String(thread.status || '').toLowerCase() !== 'resolved').length;

export type {
  AdminFinanceSection,
  AdminMarketingSection,
  AdminPageTab,
  AdminPanelSection,
  AdminOperationSection,
  AdminSettingsSection,
  AdminSupportSection,
} from '../../config/adminPageNavigationConfig';

/**
 * Controller principal da pagina administrativa.
 * Ele converte links legados para os cinco dominios oficiais do admin,
 * centraliza o estado de navegacao e prepara os shells menores do painel.
 *
 * @since 1.0.0
 */
export const useAdminPageController = () => {
  const {
    questions,
    users,
    systemSettings,
    reports,
    rankings,
    addQuestion,
    addQuestions,
    updateQuestion,
    deleteQuestion,
    resolveReport,
    updateSystemSettings,
    saveSystemSettingsNow,
    updateRanking,
    notifications,
    markNotificationAsRead,
    ensureUsersLoaded,
    ensureReportsLoaded,
    ensureRankingsLoaded,
    ensureTaxonomiesLoaded,
  } = useData();
  const { materials, transactions, moderateMaterial, deleteMaterial } = useMarketplace();
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const router = useRouter();
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

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<AdminPageTab>('panel');
  const [initialPanelSection, setInitialPanelSection] = useState<AdminPanelSection>('dashboard');
  const [initialOperationSection, setInitialOperationSection] = useState<AdminOperationSection>('questions');
  const [initialFinanceSection, setInitialFinanceSection] = useState<AdminFinanceSection>('subscriptions');
  const [initialMarketingSection, setInitialMarketingSection] = useState<AdminMarketingSection>('landing-pages');
  const [initialSupportSection, setInitialSupportSection] = useState<AdminSupportSection>('feedback');
  const [initialSettingsSection, setInitialSettingsSection] = useState<AdminSettingsSection>('general');

  const unreadCount = (notifications || []).filter((notification) => !notification.isRead && !notification.deletedAt).length;
  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const refundRequestsCount = (transactions || []).filter((transaction: any) => transaction.status === 'refund_requested').length;
  const openReportsCount = (reports || []).filter((report: any) => !['resolved', 'ignored'].includes(String(report.status || '').toLowerCase())).length;
  const settingsFeedbackCount = Math.max(0, Number((systemSettings as any)?.adminFeedbackCount || 0));
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(settingsFeedbackCount);
  const feedbackCount = pendingFeedbackCount;
  const panelAlertsCount = openReportsCount + refundRequestsCount;
  const supportInboxCount = feedbackCount + openReportsCount;

  useEffect(() => {
    setPendingFeedbackCount(settingsFeedbackCount);
  }, [settingsFeedbackCount]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    let isCurrent = true;

    adminService.getFeedbackThreads()
      .then((threads) => {
        if (isCurrent) {
          setPendingFeedbackCount(countPendingFeedbackThreads(threads));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setPendingFeedbackCount(settingsFeedbackCount);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [currentUser?.id, settingsFeedbackCount]);

  const adminTabs = useMemo<AdminNavigationTab[]>(() => ([
    { key: 'panel', label: 'Painel', icon: LayoutDashboard, badge: panelAlertsCount > 0 ? panelAlertsCount : undefined, description: 'Visao geral e saude operacional' },
    { key: 'operation', label: 'Operacao', icon: BookOpen, description: 'Questoes, usuarios e materiais' },
    { key: 'finance', label: 'Financeiro', icon: DollarSign, badge: refundRequestsCount > 0 ? refundRequestsCount : undefined, description: 'Transacoes, planos e automacao' },
    { key: 'marketing', label: 'Marketing', icon: Megaphone, description: 'Landing pages e ativos de aquisicao' },
    { key: 'support', label: 'Suporte', icon: MessageSquare, badge: supportInboxCount > 0 ? supportInboxCount : undefined, description: 'Feedback, denuncias e threads' },
    { key: 'settings', label: 'Configuracoes', icon: Settings, description: 'Integracoes e controles globais' },
  ]), [panelAlertsCount, refundRequestsCount, supportInboxCount]);

  const activeTabLabel = adminTabs.find((tab) => tab.key === activeTab)?.label || 'Painel';
  const activeSections = ADMIN_SECTION_CONFIG[activeTab];
  const legacySearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeSectionLabel = useMemo(() => {
    const currentKey = activeTab === 'panel'
      ? initialPanelSection
      : activeTab === 'operation'
        ? initialOperationSection
        : activeTab === 'finance'
          ? initialFinanceSection
          : activeTab === 'marketing'
            ? initialMarketingSection
          : activeTab === 'support'
            ? initialSupportSection
            : initialSettingsSection;

    return ADMIN_SECTION_CONFIG[activeTab].find((section) => section.key === currentKey)?.label || '';
  }, [activeTab, initialFinanceSection, initialMarketingSection, initialOperationSection, initialPanelSection, initialSettingsSection, initialSupportSection]);

  const syncAdminUrl = (tab: AdminPageTab, section?: string, options?: { replace?: boolean; hash?: string }) => {
    const nextPath = buildAdminPath(tab, section, options?.hash);
    if (options?.replace ?? true) {
      router.replace(nextPath);
    } else {
      router.push(nextPath);
    }
  };

  const setGroupSection = (tab: AdminPageTab, section: string) => {
    if (tab === 'panel' && isPanelSection(section)) {
      setInitialPanelSection(section);
    } else if (tab === 'operation' && isOperationSection(section)) {
      setInitialOperationSection(section);
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
    syncAdminUrl(nextTab, DEFAULT_SECTION_BY_TAB[nextTab]);
  };

  const handleSectionChange = (tab: AdminPageTab, section: string) => {
    syncAdminUrl(tab, section);
  };

  /**
   * Sincroniza a URL com o dominio correto e preserva compatibilidade com links antigos.
   *
   * @since 1.0.0
   */
  useEffect(() => {
    const route = resolveAdminRoute(
      routeTab || legacySearchParams.get('tab'),
      routeSection || legacySearchParams.get('section'),
    );

    setActiveTabState(route.tab);
    setGroupSection(route.tab, route.section);

    const canonicalAdminPath = buildAdminPath(route.tab, route.section, location.hash);
    const currentAdminPath = `${location.pathname}${location.hash}`;

    if (location.search || canonicalAdminPath !== currentAdminPath) {
      router.replace(canonicalAdminPath);
      return;
    }

    void ensureUsersLoaded();
    void ensureReportsLoaded();
    void ensureRankingsLoaded();
    void ensureTaxonomiesLoaded();
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
  ]);

  /**
   * Permite que atalhos internos apontem para grupos novos sem quebrar a assinatura antiga.
   *
   * @since 1.0.0
   */
  const handleDashboardNavigate = (tab: string, subTab?: string) => {
    if (tab === 'database' && subTab === 'reports') {
      handleSectionChange('support', 'reports');
      return;
    }

    if (tab === 'database' && subTab && isOperationSection(subTab)) {
      handleSectionChange('operation', subTab);
      return;
    }

    if (tab === 'finance') {
      handleSectionChange('finance', subTab && isFinanceSection(subTab) ? subTab : 'subscriptions');
      return;
    }

    if (tab === 'marketing') {
      handleSectionChange('marketing', subTab && isMarketingSection(subTab) ? subTab : 'landing-pages');
      return;
    }

    if (tab === 'settings') {
      handleSectionChange('settings', subTab && isSettingsSection(subTab) ? subTab : 'general');
      return;
    }

    if (tab === 'feedback') {
      handleSectionChange('support', 'feedback');
      return;
    }

    if (tab === 'reports') {
      handleSectionChange('support', 'reports');
      return;
    }

    if (tab === 'dashboard' || tab === 'panel') {
      handleSectionChange('panel', subTab && isPanelSection(subTab) ? subTab : 'dashboard');
    }
  };

  const navigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  return {
    activeTab,
    setActiveTab: handleTabChange,
    handleSectionChange,
    activeSections,
    activeTabLabel,
    activeTabDescription: TAB_DESCRIPTIONS[activeTab],
    activeSectionLabel,
    adminTabs,
    theme,
    toggleTheme,
    isNotifOpen,
    setIsNotifOpen,
    notifications,
    markNotificationAsRead,
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
      unreadCount,
      navigate,
      currentUserName: currentUser?.name,
      userInitials,
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
      resolveReport,
      moderateMaterial,
      onDeleteMaterial: deleteMaterial,
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      updateRanking,
      ensureUsersLoaded,
      initialTab: initialOperationSection,
    },
    databaseSectionKey: initialOperationSection,
    financeSectionProps: {
      allTransactions: transactions,
      allUsers: users,
      systemSettings,
      updateSystemSettings,
      initialSection: initialFinanceSection,
      onSectionChange: (section: AdminFinanceSection) => handleSectionChange('finance', section),
    },
    financeSectionKey: initialFinanceSection,
    marketingSectionProps: {
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      initialSection: initialMarketingSection,
      onSectionChange: (section: AdminMarketingSection) => handleSectionChange('marketing', section),
    },
    marketingSectionKey: initialMarketingSection,
    supportSectionProps: {
      initialSection: initialSupportSection,
      allReports: reports,
      pendingFeedbackCount: feedbackCount,
      onPendingFeedbackCountChange: setPendingFeedbackCount,
      onResolveReport: (report: any) => resolveReport(report.id, 'resolved', report.resolution || report.reason || 'Denuncia tratada pela equipe administrativa.'),
      onSectionChange: (section: AdminSupportSection) => handleSectionChange('support', section),
    },
    supportSectionKey: initialSupportSection,
    settingsSectionProps: {
      systemSettings,
      updateSystemSettings,
      saveSystemSettingsNow,
      addToast,
      initialSection: initialSettingsSection,
      onSectionChange: (section: AdminSettingsSection) => handleSectionChange('settings', section),
    },
    settingsSectionKey: initialSettingsSection,
  };
};
