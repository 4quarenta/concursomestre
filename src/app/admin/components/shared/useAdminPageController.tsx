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

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Database,
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

export type AdminPageTab = 'dashboard' | 'database' | 'finance' | 'settings' | 'feedback';

export const ADMIN_PAGE_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'database', label: 'Base de Dados', icon: Database },
  { key: 'finance', label: 'Financeiro', icon: DollarSign },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare },
  { key: 'settings', label: 'Configuracoes', icon: Settings },
] as const;

/**
 * Controller principal da pagina administrativa.
 * Ele conecta providers globais aos shells do admin e distribui os props consumidos por dashboard, base de dados, financeiro e configuracoes.
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
  const [searchParams] = useSearchParams();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminPageTab>('dashboard');
  const [initialDbTab, setInitialDbTab] = useState('questions');
  const [initialFinanceSection, setInitialFinanceSection] = useState('balance');

  const unreadCount = (notifications || []).filter((notification) => !notification.isRead && !notification.deletedAt).length;
  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const activeTabLabel = ADMIN_PAGE_TABS.find((tab) => tab.key === activeTab)?.label;

  /**
   * Sincroniza a aba inicial com a URL e garante o preload dos datasets centrais do painel.
   * Essa preparacao faz o admin abrir com usuarios, reports, rankings e taxonomias prontos para uso.
   */
  useEffect(() => {
    const section = searchParams.get('tab');
    if (section) {
      setActiveTab(section as AdminPageTab);
    }

    ensureUsersLoaded();
    ensureReportsLoaded();
    ensureRankingsLoaded();
    ensureTaxonomiesLoaded();
  }, [searchParams, ensureUsersLoaded, ensureReportsLoaded, ensureRankingsLoaded, ensureTaxonomiesLoaded]);

  /**
   * Permite que cards do dashboard redirecionem para abas e subabas especificas do painel.
   */
  const handleDashboardNavigate = (tab: string, subTab?: string) => {
    if (tab === 'database' && subTab) setInitialDbTab(subTab);
    if (tab === 'finance' && subTab) setInitialFinanceSection(subTab);
    setActiveTab(tab as AdminPageTab);
  };

  return {
    activeTab,
    setActiveTab,
    activeTabLabel,
    adminTabs: ADMIN_PAGE_TABS,
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
    dashboardSectionProps: {
      questions,
      allMaterials: materials,
      allTransactions: transactions,
      allUsers: users,
      systemSettings,
      allReports: reports,
      allRankings: rankings,
      onNavigate: handleDashboardNavigate,
    },
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
      updateRanking,
      initialTab: initialDbTab,
    },
    databaseSectionKey: initialDbTab,
    financeSectionProps: {
      allTransactions: transactions,
      allUsers: users,
      systemSettings,
      updateSystemSettings,
      addCoupon,
      deleteCoupon,
      initialSection: initialFinanceSection,
    },
    financeSectionKey: initialFinanceSection,
    settingsSectionProps: {
      systemSettings,
      updateSystemSettings,
      addToast,
    },
  };
};
