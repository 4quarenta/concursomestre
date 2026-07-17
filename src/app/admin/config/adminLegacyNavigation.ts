import {
  isFinanceSection,
  isMarketingSection,
  isMarketplaceSection,
  isOperationSection,
  isPanelSection,
  isSettingsSection,
  isSupportSection,
  type AdminPageTab,
  type AdminSupportSection,
} from './adminPageNavigationConfig';

export type AdminLegacyDestination = {
  tab: AdminPageTab;
  section: string;
};

/**
 * Converte atalhos historicos do dashboard para a rota canonica do admin.
 *
 * @since 1.2.0
 */
export const resolveLegacyAdminDestination = (
  tab: string,
  subTab: string | undefined,
  supportLandingSection: AdminSupportSection,
): AdminLegacyDestination | null => {
  if ((tab === 'operation' || tab === 'database') && subTab && ['materials', 'blocked'].includes(subTab)) {
    return { tab: 'marketplace', section: subTab };
  }

  if ((tab === 'operation' || tab === 'database') && subTab === 'rankings') {
    return { tab: 'support', section: 'rankings' };
  }

  if (tab === 'database' && subTab === 'reports') {
    return { tab: 'support', section: 'reports' };
  }

  if (tab === 'database' && subTab && isOperationSection(subTab)) {
    return { tab: 'operation', section: subTab };
  }

  if (tab === 'finance') {
    if (subTab === 'subscriptions') return { tab: 'marketplace', section: 'vendors' };
    if (subTab === 'refunds') return { tab: 'support', section: 'refunds' };
    return { tab: 'finance', section: subTab && isFinanceSection(subTab) ? subTab : 'transactions' };
  }

  if (tab === 'marketplace') {
    return { tab: 'marketplace', section: subTab && isMarketplaceSection(subTab) ? subTab : 'vendors' };
  }

  if (tab === 'marketing') {
    return { tab: 'marketing', section: subTab && isMarketingSection(subTab) ? subTab : 'landing-pages' };
  }

  if (tab === 'settings') {
    return { tab: 'settings', section: subTab && isSettingsSection(subTab) ? subTab : 'general' };
  }

  if (tab === 'support') {
    return { tab: 'support', section: subTab && isSupportSection(subTab) ? subTab : supportLandingSection };
  }

  if (tab === 'feedback') return { tab: 'support', section: 'feedback' };
  if (tab === 'reports') return { tab: 'support', section: 'reports' };

  if (tab === 'dashboard' || tab === 'panel') {
    return { tab: 'panel', section: subTab && isPanelSection(subTab) ? subTab : 'dashboard' };
  }

  return null;
};
