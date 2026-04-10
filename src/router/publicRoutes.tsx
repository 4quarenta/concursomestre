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
import PageTransition from '../components/PageTransition';
import Layout from '../components/shared/layout/Layout';
import { LayoutContentRouteFallback } from './RouteSuspenseFallback';

const AuthPage = React.lazy(() => import('../app/auth/page'));
const ChangelogPage = React.lazy(() => import('../app/changelog/page'));
const ConfirmEmailPage = React.lazy(() => import('../app/confirm-email/page'));
const DashboardPage = React.lazy(() => import('../app/dashboard/page'));
const FaqPage = React.lazy(() => import('../app/faq/page'));
const LandingPage = React.lazy(() => import('../app/landing/page'));
const MaterialPublicPage = React.lazy(() => import('../app/material/page'));
const PlansPage = React.lazy(() => import('../app/plans/page'));
const PrivacyPage = React.lazy(() => import('../app/privacy/page'));
const PromoPage = React.lazy(() => import('../app/promo/page'));
const QuestionPublicPage = React.lazy(() => import('../app/question/page'));
const RankingDetailPage = React.lazy(() => import('../app/ranking-detail/page'));
const ResetPasswordPage = React.lazy(() => import('../app/reset-password/page'));
const TermsPage = React.lazy(() => import('../app/terms/page'));

interface PublicRoutesProps {
  currentUser: UserProfile | null;
  login: (user: UserProfile | null, token?: string | null) => Promise<void>;
}

/**
 * Agrupa as rotas públicas e semi-públicas da plataforma.
 * Esse conjunto alimenta o roteador principal e define como landing, autenticação e paginas abertas se conectam ao shell real do site.
 */
export const PublicRoutes: React.FC<PublicRoutesProps> = ({ currentUser, login }) => {
  /**
   * Mantem o Layout oficial montado enquanto a pagina lazy resolve.
   * Assim o menu lateral e o cabeçalho não desaparecem durante a transicao das rotas públicas que compartilham o shell autenticado.
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
      <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
      <Route path="/confirm-email" element={<PageTransition><ConfirmEmailPage /></PageTransition>} />
      <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
      <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
      <Route
        path="/auth"
        element={
          currentUser
            ? (() => {
                const redirect = sessionStorage.getItem('redirectAfterLogin') || '/';
                sessionStorage.removeItem('redirectAfterLogin');
                return <Navigate to={redirect} replace />;
              })()
            : <PageTransition><AuthPage onLogin={login} /></PageTransition>
        }
      />
      <Route path="/changelog" element={<PageTransition><ChangelogPage /></PageTransition>} />
      <Route path="/faq" element={renderLayoutPage(<FaqPage />)} />
      <Route path="/question/:id/:slug?" element={renderLayoutPage(<QuestionPublicPage />)} />
      <Route path="/ranking/:id/:slug?" element={renderLayoutPage(<RankingDetailPage />)} />
      <Route path="/material/:id/:slug?" element={renderLayoutPage(<MaterialPublicPage />)} />
      <Route path="/" element={currentUser ? renderLayoutPage(<DashboardPage />) : <PageTransition><LandingPage /></PageTransition>} />
      <Route path="/promo/:slug" element={renderLayoutPage(<PromoPage />)} />
      <Route path="/plans" element={renderLayoutPage(<PlansPage />)} />
    </>
  );
};

export default PublicRoutes;
