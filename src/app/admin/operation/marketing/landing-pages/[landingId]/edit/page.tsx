'use client';

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

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import type { MarketingLandingPage } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { canAccessAdminPanel } from '@services/auth';
import AdminLandingPagesManager from '../../../../../components/marketing/AdminLandingPagesManager';
import AdminStandaloneShell from '../../../../../components/shared/AdminStandaloneShell';
import { buildAdminLandingPageEditPath, buildAdminPath } from '../../../../../config/adminPageNavigationConfig';
import { ADMIN_SURFACE_CLASS } from '../../../../../components/shared/adminPanelStyles';

const resolveLandingId = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const AdminLandingPageEditRoute = () => {
  const params = useParams<{ landingId?: string | string[] }>();
  const router = useRouter();
  const landingId = resolveLandingId(params.landingId) || 'new';
  const isNew = landingId === 'new';

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const {
    systemSettings,
    isSystemSettingsLoaded,
    updateSystemSettings,
    saveSystemSettingsNow,
  } = useData();

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  const closeEditor = React.useCallback(() => {
    router.push(buildAdminPath('marketing', 'landing-pages'));
  }, [router]);

  const handleSavedLanding = React.useCallback((landingPage: MarketingLandingPage) => {
    if (isNew && landingPage.id) {
      router.replace(buildAdminLandingPageEditPath(landingPage.id));
    }
  }, [isNew, router]);

  const renderShell = (children: React.ReactNode) => (
    <AdminStandaloneShell
      activeTab="marketing"
      activeSectionKey="landing-pages"
      pageTitle="Landing Pages"
      showPageHeader={false}
    >
      {children}
    </AdminStandaloneShell>
  );

  if (isAuthLoading || !isSystemSettingsLoaded) {
    return renderShell(
      <div className={`${ADMIN_SURFACE_CLASS} flex min-h-[360px] items-center justify-center p-12 text-slate-500 dark:text-slate-400`}>
        <Loader2 className="mr-3 animate-spin" size={18} /> Carregando editor da landing page...
      </div>,
    );
  }

  if (!canAccessAdminPanel(currentUser)) {
    return null;
  }

  return renderShell(
    <AdminLandingPagesManager
      systemSettings={systemSettings}
      updateSystemSettings={updateSystemSettings}
      saveSystemSettingsNow={saveSystemSettingsNow}
      initialScreen="editor"
      initialLandingId={landingId}
      editorOnly
      onReturnToList={closeEditor}
      onSavedLanding={handleSavedLanding}
    />,
  );
};

export default AdminLandingPageEditRoute;
