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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  DollarSign,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useTheme } from '@providers/ThemeProvider';
import { useToast } from '@providers/ToastProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import {
  ADMIN_SECTION_CONFIG,
  DEFAULT_SECTION_BY_TAB,
  isAdminPageTab,
  isFinanceSection,
  isOperationSection,
  isPanelSection,
  isSettingsSection,
  isSupportSection,
  LEGACY_TAB_MAP,
  TAB_DESCRIPTIONS,
  type AdminFinanceSection,
  type AdminNavigationTab,
  type AdminPageTab,
  type AdminPanelSection,
  type AdminOperationSection,
  type AdminSettingsSection,
  type AdminSupportSection,
} from '../../config/adminPageNavigationConfig';

export type {
  AdminFinanceSection,
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
    addCoupon,
    deleteCoupon,
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<AdminPageTab>('panel');
  const [initialPanelSection, setInitialPanelSection] = useState<AdminPanelSection>('dashboard');
  const [initialOperationSection, setInitialOperationSection] = useState<AdminOperationSection>('questions');
  const [initialFinanceSection, setInitialFinanceSection] = useState<AdminFinanceSection>('subscriptions');
  const [initialSupportSection, setInitialSupportSection] = useState<AdminSupportSection>('feedback');
  const [initialSettingsSection, setInitialSettingsSection] = useState<AdminSettingsSection>('general');

  const unreadCount = (notifications || []).filter((notification) => !notification.isRead && !notification.deletedAt).length;
  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const refundRequestsCount = (transactions || []).filter((transaction: any) => transaction.status === 'refund_requested').length;
  const openReportsCount = (reports || []).filter((report: any) => !['resolved', 'ignored'].includes(String(report.status || '').toLowerCase())).length;
  const feedbackCount = Number((systemSettings as any)?.adminFeedbackCount || 0);
  const panelAlertsCount = openReportsCount + refundRequestsCount;
  const supportInboxCount = feedbackCount + openReportsCount;

  const adminTabs = useMemo<AdminNavigationTab[]>(() => ([
    { key: 'panel', label: 'Painel', icon: LayoutDashboard, badge: panelAlertsCount > 0 ? panelAlertsCount : undefined, description: 'Visao geral e saude operacional' },
    { key: 'operation', label: 'Operacao', icon: BookOpen, description: 'Questoes, usuarios e materiais' },
    { key: 'finance', label: 'Financeiro', icon: DollarSign, badge: refundRequestsCount > 0 ? refundRequestsCount : undefined, description: 'Transacoes, planos e automacao' },
    { key: 'support', label: 'Suporte', icon: MessageSquare, badge: supportInboxCount > 0 ? supportInboxCount : undefined, description: 'Feedback, denuncias e threads' },
    { key: 'settings', label: 'Configuracoes', icon: Settings, description: 'Integracoes e controles globais' },
  ]), [panelAlertsCount, refundRequestsCount, supportInboxCount]);

  const activeTabLabel = adminTabs.find((tab) => tab.key === activeTab)?.label || 'Painel';
  const activeSections = ADMIN_SECTION_CONFIG[activeTab];
  const activeSectionLabel = useMemo(() => {
    const currentKey = activeTab === 'panel'
      ? initialPanelSection
      : activeTab === 'operation'
        ? initialOperationSection
        : activeTab === 'finance'
          ? initialFinanceSection
          : activeTab === 'support'
            ? initialSupportSection
            : initialSettingsSection;

    return ADMIN_SECTION_CONFIG[activeTab].find((section) => section.key === currentKey)?.label || '';
  }, [activeTab, initialFinanceSection, initialOperationSection, initialPanelSection, initialSettingsSection, initialSupportSection]);

  const syncAdminUrl = (tab: AdminPageTab, section?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);

    const nextSection = section || DEFAULT_SECTION_BY_TAB[tab];
    if (nextSection) {
      nextParams.set('section', nextSection);
    } else {
      nextParams.delete('section');
    }

    setSearchParams(nextParams, { replace: true });
  };

  const setGroupSection = (tab: AdminPageTab, section: string) => {
    if (tab === 'panel' && isPanelSection(section)) {
      setInitialPanelSection(section);
    } else if (tab === 'operation' && isOperationSection(section)) {
      setInitialOperationSection(section);
    } else if (tab === 'finance' && isFinanceSection(section)) {
      setInitialFinanceSection(section);
    } else if (tab === 'support' && isSupportSection(section)) {
      setInitialSupportSection(section);
    } else if (tab === 'settings' && isSettingsSection(section)) {
      setInitialSettingsSection(section);
    }
  };

  const handleTabChange = (nextTab: AdminPageTab) => {
    setActiveTabState(nextTab);
    syncAdminUrl(nextTab, DEFAULT_SECTION_BY_TAB[nextTab]);
  };

  const handleSectionChange = (tab: AdminPageTab, section: string) => {
    setActiveTabState(tab);
    setGroupSection(tab, section);
    syncAdminUrl(tab, section);
  };

  /**
   * Sincroniza a URL com o dominio correto e preserva compatibilidade com links antigos.
   *
   * @since 1.0.0
   */
  useEffect(() => {
    const rawTab = String(searchParams.get('tab') || '').trim();
    const rawSection = String(searchParams.get('section') || '').trim();

    const applySectionsFromGroup = (tab: AdminPageTab, section: string) => {
      setActiveTabState(tab);

      if (tab === 'panel') {
        setInitialPanelSection(isPanelSection(section) ? section : 'dashboard');
      }
      if (tab === 'operation') {
        setInitialOperationSection(isOperationSection(section) ? section : 'questions');
      }
      if (tab === 'finance') {
        setInitialFinanceSection(isFinanceSection(section) ? section : 'subscriptions');
      }
      if (tab === 'support') {
        setInitialSupportSection(isSupportSection(section) ? section : 'feedback');
      }
      if (tab === 'settings') {
        setInitialSettingsSection(isSettingsSection(section) ? section : 'general');
      }
    };

    if (rawTab === 'operation' && rawSection === 'reports') {
      applySectionsFromGroup('support', 'reports');
    } else if (isAdminPageTab(rawTab)) {
      applySectionsFromGroup(rawTab, rawSection || DEFAULT_SECTION_BY_TAB[rawTab]);
    } else if (LEGACY_TAB_MAP[rawTab]) {
      const legacy = LEGACY_TAB_MAP[rawTab];
      applySectionsFromGroup(legacy.tab, rawSection || legacy.section || DEFAULT_SECTION_BY_TAB[legacy.tab]);
    } else {
      applySectionsFromGroup('panel', 'dashboard');
    }

    void ensureUsersLoaded();
    void ensureReportsLoaded();
    void ensureRankingsLoaded();
    void ensureTaxonomiesLoaded();
  }, [searchParams, ensureUsersLoaded, ensureReportsLoaded, ensureRankingsLoaded, ensureTaxonomiesLoaded]);

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
      initialTab: initialOperationSection,
    },
    databaseSectionKey: initialOperationSection,
    financeSectionProps: {
      allTransactions: transactions,
      allUsers: users,
      systemSettings,
      updateSystemSettings,
      addCoupon,
      deleteCoupon,
      initialSection: initialFinanceSection,
      onSectionChange: (section: AdminFinanceSection) => handleSectionChange('finance', section),
    },
    financeSectionKey: initialFinanceSection,
    supportSectionProps: {
      initialSection: initialSupportSection,
      allReports: reports,
      onOpenReportTarget: (report: any) => {
        if (report?.targetType === 'question') {
          handleSectionChange('operation', 'questions');
          addToast(`Abra a secao Questoes para revisar o alvo ID ${report.questionId || report.targetId || report.id}.`, 'info');
          return;
        }

        if (report?.targetType === 'material') {
          handleSectionChange('operation', 'materials');
          addToast(`Abra a secao Materiais para revisar o alvo ID ${report.materialId || report.targetId || report.id}.`, 'info');
          return;
        }

        handleSectionChange('support', 'threads');
        addToast('Comentarios denunciados seguem pela fila de suporte e threads.', 'info');
      },
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
