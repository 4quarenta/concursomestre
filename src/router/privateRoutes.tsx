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
import { Navigate, Route } from 'react-router-dom';
import type { SystemSettings, UserProfile } from '@types';
import Layout from '../components/shared/layout/Layout';
import ModuleAccessFallback from '../components/shared/feedback/ModuleAccessFallback';
import PageTransition from '../components/PageTransition';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { RequireAuth } from './guards';
import { LayoutContentRouteFallback } from './RouteSuspenseFallback';
import { buildProfilePath } from '../app/profile/profileNavigation';

const BankAnalysisPage = React.lazy(() => import('../app/bank-analysis/page'));
const CheckoutPage = React.lazy(() => import('../app/checkout/page'));
const ConcursosPage = React.lazy(() => import('../app/concursos/page'));
const FlashcardsPage = React.lazy(() => import('../app/flashcards/page'));
const AnnotatedLawsPage = React.lazy(() => import('../app/lei-comentada/page'));
const MarketplacePage = React.lazy(() => import('../app/marketplace/page'));
const NotificationsPage = React.lazy(() => import('../app/notifications/page'));
const PartnerDashboardPage = React.lazy(() => import('../app/partner-dashboard/page'));
const PerformanceSubjectsPage = React.lazy(() => import('../app/performance-subjects/page'));
const PracticePage = React.lazy(() => import('../app/practice/page'));
const ProfilePage = React.lazy(() => import('../app/profile/page'));
const RankingPage = React.lazy(() => import('../app/ranking/page'));
const ReaderPage = React.lazy(() => import('../app/reader/page'));
const SimulationPage = React.lazy(() => import('../app/simulation/page'));
const SupportPage = React.lazy(() => import('../app/support/page'));

interface PrivateRoutesProps {
  currentUser: UserProfile | null;
  loginRequired: boolean;
  systemSettings: SystemSettings;
}

/**
 * Agrupa as rotas autenticadas e da area principal da aplicação.
 * Esse conjunto conecta pratica, simulados, ranking, perfil e suporte ao shell autenticado e aos guards de sessão.
 */
export const PrivateRoutes: React.FC<PrivateRoutesProps> = ({ currentUser, loginRequired, systemSettings }) => {
  const isStrictAdmin = Boolean(currentUser?.isAdmin || currentUser?.role === 'admin');
  const practiceEnabled = resolveSystemFeatureFlag(systemSettings, 'practiceEnabled');
  const annotatedLawsEnabled = resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled');
  const flashcardsEnabled = resolveSystemFeatureFlag(systemSettings, 'flashcardsEnabled');
  const simulationsEnabled = resolveSystemFeatureFlag(systemSettings, 'simulationsEnabled');
  const xRayEnabled = resolveSystemFeatureFlag(systemSettings, 'xRayEnabled');
  const marketplaceEnabled = resolveSystemFeatureFlag(systemSettings, 'marketplaceEnabled');
  const rankingsEnabled = resolveSystemFeatureFlag(systemSettings, 'rankingsEnabled');

  /**
   * Mantem o Layout oficial visivel enquanto a pagina interna lazy ainda esta resolvendo.
   * Isso evita a sensacao de "quebra" visual durante a navegacao entre telas do app.
   */
  const renderLayoutPage = (page: React.ReactNode) => (
    <Layout>
      <React.Suspense fallback={<LayoutContentRouteFallback />}>
        <PageTransition>{page}</PageTransition>
      </React.Suspense>
    </Layout>
  );

  /**
   * Mantem o shell oficial sem animacao de pagina inteira.
   * Usado em superficies com subnavegacao estrutural propria, como perfil.
   */
  const renderStableLayoutPage = (page: React.ReactNode) => (
    <Layout>
      <React.Suspense fallback={<LayoutContentRouteFallback />}>
        {page}
      </React.Suspense>
    </Layout>
  );

  const renderFeatureRoute = (
    page: React.ReactNode,
    isEnabled: boolean,
    featureLabel: string,
  ) => (
    <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
      {isEnabled || isStrictAdmin
        ? renderLayoutPage(page)
        : renderLayoutPage(
          <ModuleAccessFallback description={`O modulo ${featureLabel} nao esta disponivel para o seu perfil.`} />,
        )}
    </RequireAuth>
  );

  return (
    <>
      <Route
        path="/concursos"
        element={
          <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
            {renderLayoutPage(<ConcursosPage />)}
          </RequireAuth>
        }
      />
      <Route
        path="/practice"
        element={renderFeatureRoute(<PracticePage />, practiceEnabled, 'Questoes')}
      />
      <Route
        path="/lei-comentada"
        element={renderFeatureRoute(<AnnotatedLawsPage />, annotatedLawsEnabled, 'Lei comentada')}
      />
      <Route
        path="/flashcards"
        element={renderFeatureRoute(<FlashcardsPage />, flashcardsEnabled, 'Flashcards')}
      />
      <Route
        path="/simulation"
        element={renderFeatureRoute(<SimulationPage />, simulationsEnabled, 'Simulados')}
      />
      <Route
        path="/x-ray"
        element={renderFeatureRoute(<BankAnalysisPage />, xRayEnabled, 'Raio-X Banca')}
      />
      <Route
        path="/marketplace"
        element={renderFeatureRoute(<MarketplacePage />, marketplaceEnabled, 'Loja')}
      />
      <Route
        path="/ranking"
        element={renderFeatureRoute(<RankingPage />, rankingsEnabled, 'Rankings')}
      />
      <Route path="/profile" element={currentUser ? <Navigate to={buildProfilePath('personal')} replace /> : <Navigate to="/auth" replace />} />
      <Route path="/profile/:tab" element={currentUser ? renderStableLayoutPage(<ProfilePage />) : <Navigate to="/auth" replace />} />
      <Route path="/performance/subjects" element={currentUser ? renderLayoutPage(<PerformanceSubjectsPage />) : <Navigate to="/auth" replace />} />
      <Route path="/notifications" element={currentUser ? renderLayoutPage(<NotificationsPage />) : <Navigate to="/auth" replace />} />
      <Route path="/partner-dashboard" element={currentUser ? <PageTransition><PartnerDashboardPage /></PageTransition> : <Navigate to="/" replace />} />
      <Route path="/support" element={currentUser ? renderLayoutPage(<SupportPage />) : <Navigate to="/auth" replace />} />
      <Route path="/subscription/success" element={currentUser ? <Navigate to={buildProfilePath('billing')} replace /> : <Navigate to="/auth" replace />} />
      <Route path="/subscription/failure" element={currentUser ? <Navigate to="/plans" replace /> : <Navigate to="/auth" replace />} />
      <Route path="/subscription/pending" element={currentUser ? <Navigate to={buildProfilePath('billing')} replace /> : <Navigate to="/auth" replace />} />
      <Route path="/read/:id" element={currentUser ? <PageTransition><ReaderPage /></PageTransition> : <Navigate to="/auth" replace />} />
      <Route path="/checkout/:planId" element={<PageTransition><CheckoutPage /></PageTransition>} />
    </>
  );
};

export default PrivateRoutes;
