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
import type { UserProfile } from '@types';
import Layout from '../components/shared/layout/Layout';
import PageTransition from '../components/PageTransition';
import { RequireAuth } from './guards';
import { LayoutContentRouteFallback } from './RouteSuspenseFallback';

const BankAnalysisPage = React.lazy(() => import('../app/bank-analysis/page'));
const CheckoutPage = React.lazy(() => import('../app/checkout/page'));
const MarketplacePage = React.lazy(() => import('../app/marketplace/page'));
const NotificationsPage = React.lazy(() => import('../app/notifications/page'));
const PartnerDashboardPage = React.lazy(() => import('../app/partner-dashboard/page'));
const PracticePage = React.lazy(() => import('../app/practice/page'));
const ProfilePage = React.lazy(() => import('../app/profile/page'));
const RankingPage = React.lazy(() => import('../app/ranking/page'));
const ReaderPage = React.lazy(() => import('../app/reader/page'));
const SimulationPage = React.lazy(() => import('../app/simulation/page'));
const SupportPage = React.lazy(() => import('../app/support/page'));

interface PrivateRoutesProps {
  currentUser: UserProfile | null;
  loginRequired: boolean;
}

/**
 * Agrupa as rotas autenticadas e da area principal da aplicacao.
 * Esse conjunto conecta pratica, simulados, ranking, perfil e suporte ao shell autenticado e aos guards de sessao.
 */
export const PrivateRoutes: React.FC<PrivateRoutesProps> = ({ currentUser, loginRequired }) => {
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

  return (
    <>
      <Route
        path="/practice"
        element={
          <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
            {renderLayoutPage(<PracticePage />)}
          </RequireAuth>
        }
      />
      <Route
        path="/simulation"
        element={
          <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
            {renderLayoutPage(<SimulationPage />)}
          </RequireAuth>
        }
      />
      <Route
        path="/x-ray"
        element={
          <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
            {renderLayoutPage(<BankAnalysisPage />)}
          </RequireAuth>
        }
      />
      <Route
        path="/marketplace"
        element={
          <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
            {renderLayoutPage(<MarketplacePage />)}
          </RequireAuth>
        }
      />
      <Route
        path="/ranking"
        element={
          <RequireAuth currentUser={currentUser} loginRequired={loginRequired}>
            {renderLayoutPage(<RankingPage />)}
          </RequireAuth>
        }
      />
      <Route path="/profile" element={currentUser ? renderLayoutPage(<ProfilePage />) : <Navigate to="/auth" replace />} />
      <Route path="/notifications" element={currentUser ? renderLayoutPage(<NotificationsPage />) : <Navigate to="/auth" replace />} />
      <Route path="/partner-dashboard" element={currentUser ? <PageTransition><PartnerDashboardPage /></PageTransition> : <Navigate to="/" replace />} />
      <Route path="/support" element={currentUser ? renderLayoutPage(<SupportPage />) : <Navigate to="/auth" replace />} />
      <Route path="/subscription/success" element={currentUser ? <Navigate to="/profile" replace /> : <Navigate to="/auth" replace />} />
      <Route path="/subscription/failure" element={currentUser ? <Navigate to="/plans" replace /> : <Navigate to="/auth" replace />} />
      <Route path="/subscription/pending" element={currentUser ? <Navigate to="/profile" replace /> : <Navigate to="/auth" replace />} />
      <Route path="/read/:id" element={currentUser ? <PageTransition><ReaderPage /></PageTransition> : <Navigate to="/auth" replace />} />
      <Route path="/checkout/:planId" element={<PageTransition><CheckoutPage /></PageTransition>} />
    </>
  );
};

export default PrivateRoutes;
