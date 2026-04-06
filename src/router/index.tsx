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
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Hammer, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import GlobalLoader from '../components/GlobalLoader';
import DebugBanner from '../components/shared/feedback/debug/DebugBanner';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { AdminRoutes } from './adminRoutes';
import { PrivateRoutes } from './privateRoutes';
import { PublicRoutes } from './publicRoutes';
import RouteSuspenseFallback from './RouteSuspenseFallback';
import { useRoutePersistence } from './useRoutePersistence';

/**
 * Casca interna do roteamento oficial da plataforma.
 * Ela conecta autenticação, configurações globais, guardas de manutencao/pagamento e os grupos de rotas que montam o site.
 */
const RoutedAppRouter: React.FC = () => {
  const { currentUser, login, logout, isLoading } = useAuth();
  const { systemSettings } = useData();
  const [showLoginBypass, setShowLoginBypass] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useRoutePersistence(location, navigate, isLoading);

  /**
   * Guarda a rota desejada antes do login para que o usuário volte ao fluxo correto depois de autenticar.
   */
  React.useEffect(() => {
    if (!isLoading && !currentUser && location.pathname !== '/auth' && location.pathname !== '/' && location.pathname !== '/plans') {
      sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search + location.hash);
    }
  }, [isLoading, currentUser, location]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={40} className="animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest animate-pulse">Autenticando...</p>
      </div>
    );
  }

  const isMaintenance = systemSettings?.features?.maintenanceMode || false;
  const loginRequired = systemSettings?.features?.loginRequired || false;

  if (isMaintenance && !currentUser?.isAdmin && !showLoginBypass) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6 text-center transition-colors">
        <div className="max-w-md space-y-8 animate-scale-in">
          <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl shadow-amber-200/50 dark:shadow-none animate-bounce">
            <Hammer size={48} />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Manutencao</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Estamos realizando melhorias tecnicas para garantir a melhor experiencia. Voltaremos em alguns instantes!
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {currentUser && (
              <button
                onClick={logout}
                className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase text-slate-500 hover:text-red-500 transition-all flex items-center gap-2 mx-auto"
              >
                <LogOut size={16} /> Sair da Conta
              </button>
            )}
            <button
              onClick={() => setShowLoginBypass(true)}
              className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest hover:text-indigo-500 transition-colors"
            >
              Acesso Administrativo
            </button>
          </div>
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <ShieldAlert size={14} /> Sistema Protegido
          </div>
        </div>
      </div>
    );
  }

  const isPastDueSubscription = currentUser?.subscription?.status === 'past_due';
  const isPaymentIssue = (currentUser?.paymentIssue || isPastDueSubscription) && !currentUser?.isAdmin;
  const isFixingPayment = location.pathname === '/profile' || location.pathname === '/plans' || location.pathname.startsWith('/checkout');

  if (isPaymentIssue && !isFixingPayment) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-scale-in border border-rose-100 dark:border-rose-900/30">
          <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-rose-200/50 dark:shadow-none animate-pulse">
            <ShieldAlert size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Problema no Pagamento</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {isPastDueSubscription
                ? 'A renovação da sua assinatura falhou e seu acesso ficou pendente. Atualize ou troque o cartão salvo para regularizar a cobrança.'
                : 'Detectamos um problema com o metodo de pagamento da sua assinatura ativa (cartão vencido ou ausente). Atualize seus dados para continuar acessando a plataforma.'}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20"
            >
              Atualizar Cartão Agora
            </button>
            <button
              onClick={logout}
              className="w-full py-2 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalLoader />
      <React.Suspense fallback={<RouteSuspenseFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {PublicRoutes({ currentUser, login })}
            {PrivateRoutes({ currentUser, loginRequired })}
            {AdminRoutes({ currentUser })}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </React.Suspense>
      {import.meta.env.DEV && <DebugBanner />}
    </>
  );
};

/**
 * Entrada oficial do roteador da aplicação.
 * Todo o site passa por aqui antes de chegar nas rotas públicas, privadas e administrativas.
 */
export const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <RoutedAppRouter />
    </HashRouter>
  );
};

export default AppRouter;
