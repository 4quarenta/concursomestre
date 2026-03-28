
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Ranking from './pages/Ranking';
import Simulation from './pages/Simulation';
import BankAnalysis from './pages/BankAnalysis';
import Marketplace from './pages/Marketplace';
import PartnerDashboard from './pages/PartnerDashboard';
import ReaderPage from './pages/ReaderPage';
import PromoLanding from './pages/PromoLanding';
import LandingPage from './pages/LandingPage';
import TermsOfUse from './pages/TermsOfUse';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NotificationsPage from './pages/Notifications';

import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import { ThemeProvider } from './context/ThemeContext';
import { Hammer, ShieldAlert, LogOut } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, login, logout } = useAuth();
  const { systemSettings } = useData();
  const [showLoginBypass, setShowLoginBypass] = React.useState(false);

  const isMaintenance = systemSettings.features.maintenanceMode;
  const loginRequired = systemSettings.features.loginRequired;

  // Maintenance Check (Bypass for Admins)
  if (isMaintenance && !currentUser?.isAdmin && !showLoginBypass) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6 text-center transition-colors">
        <div className="max-w-md space-y-8 animate-scale-in">
          <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl shadow-amber-200/50 dark:shadow-none animate-bounce">
            <Hammer size={48} />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Manutenção</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Estamos realizando melhorias técnicas para garantir a melhor experiência. Voltaremos em alguns instantes!
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

  return (
    <HashRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/auth" element={currentUser ? <Navigate to="/" replace /> : <Auth onLogin={login} />} />

        {/* CONDITIONAL HOME */}
        <Route path="/" element={
          currentUser ? <Layout><Dashboard /></Layout> : <LandingPage />
        } />

        {/* GUEST-FRIENDLY ROUTES (Check loginRequired) */}
        <Route path="/practice" element={
          (currentUser || !loginRequired) ? <Layout><Practice /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/simulation" element={
          (currentUser || !loginRequired) ? <Layout><Simulation /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/x-ray" element={
          (currentUser || !loginRequired) ? <Layout><BankAnalysis /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/marketplace" element={
          (currentUser || !loginRequired) ? <Layout><Marketplace /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/ranking" element={
          (currentUser || !loginRequired) ? <Layout><Ranking /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/promo/:slug" element={
          <Layout><PromoLanding /></Layout>
        } />

        {/* PRIVATE ROUTES (Auth Required) */}
        <Route path="/profile" element={
          currentUser ? <Layout><Profile /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/notifications" element={
          currentUser ? <Layout><NotificationsPage /></Layout> : <Navigate to="/auth" replace />
        } />
        <Route path="/partner-dashboard" element={
          currentUser ? <Layout><PartnerDashboard /></Layout> : <Navigate to="/" replace />
        } />

        <Route path="/read/:id" element={
          currentUser ? <ReaderPage /> : <Navigate to="/auth" replace />
        } />

        {/* ADMIN ROUTES */}
        <Route
          path="/admin"
          element={currentUser?.isAdmin ? <Layout><Admin /></Layout> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>
            <MarketplaceProvider>
              <AppContent />
            </MarketplaceProvider>
          </DataProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
