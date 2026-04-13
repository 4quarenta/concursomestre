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


import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, User, Menu, X, BrainCircuit, Trophy, LogOut, Timer, Zap, ShoppingBag, ShieldAlert, Mail, Bell, Check, ArrowRight, Info, Sun, Moon, MessageSquare, Shield, Lock, HelpCircle, Rocket, Crown, FileText, Layers } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useTheme } from '@providers/ThemeProvider';
import PromoBanner from '../feedback/PromoBanner';
import { Notification } from '@types';
import Footer from './Footer';
import AdBanner from '../feedback/AdBanner';
import { useToast } from '@providers/ToastProvider';
import { apiClient } from '@services/api';
import { ENDPOINTS } from '@services/api';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';
import { canAccessAdminPanel } from '@services/auth';
import LogoutConfirmButton from './LogoutConfirmButton';
import { buildProfilePath } from '../../../app/profile/profileNavigation';
import { buildAdminPath } from '../../../app/admin/config/adminPageNavigationConfig';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import {
  getEffectivePlanName,
  getEffectivePlanDisplayName,
  getEffectivePlanTier,
  hasActivePlanAccess,
  hasPlanBenefit,
} from '@services/plans/planAccess';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser: user, refreshUser } = useAuth();
  const { notifications, markNotificationAsRead, systemSettings } = useData();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const canOpenAdminPanel = canAccessAdminPanel(user);
  const simulationSearchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const isStrictAdmin = Boolean(user?.isAdmin || user?.role === 'admin');
  const practiceEnabled = resolveSystemFeatureFlag(systemSettings, 'practiceEnabled');
  const annotatedLawsEnabled = resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled');
  const flashcardsEnabled = resolveSystemFeatureFlag(systemSettings, 'flashcardsEnabled');
  const simulationsEnabled = resolveSystemFeatureFlag(systemSettings, 'simulationsEnabled');
  const xRayEnabled = resolveSystemFeatureFlag(systemSettings, 'xRayEnabled');
  const rankingsEnabled = resolveSystemFeatureFlag(systemSettings, 'rankingsEnabled');
  const marketplaceEnabled = resolveSystemFeatureFlag(systemSettings, 'marketplaceEnabled');

  const [showVerificationModal, setShowVerificationModal] = useState(() => {
    return !!(user && !user.emailVerified && !sessionStorage.getItem('welcomeModalClosed'));
  });

  React.useEffect(() => {
    if (user && !user.emailVerified && !sessionStorage.getItem('welcomeModalClosed')) {
      setShowVerificationModal(true);
    } else {
      setShowVerificationModal(false);
    }
  }, [user]);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const closeVerificationModal = () => {
    sessionStorage.setItem('welcomeModalClosed', 'true');
    setShowVerificationModal(false);
  };

  // if (!user) return null; // Removed to allow guest access

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(current => current - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResendConfirmation = async () => {
    if (resendTimer > 0) return;
    // emailVerified é o campo mapeado pelo backend (camelCase)
    if (!user || user.emailVerified) return;

    try {
      // O interceptor do axios (client.ts) já retorna response.data diretamente
      const response: any = await apiClient.post(ENDPOINTS.auth.resendConfirmation, { email: user.email });

      if (response && response.success) {
        setResendTimer(60);
        addToast(response.message || 'E-mail reenviado com sucesso!', 'success');

        // Se o e-mail já foi verificado (o backend retorna success com mensagem de aviso),
        // atualizamos o usuário para sumir o banner imediatamente.
        if (response.message?.includes('já foi verificado')) {
          refreshUser();
        }
      } else {
        addToast(response?.message || 'Falha ao reenviar e-mail.', 'error');
      }
    } catch (error: any) {
      addToast(error?.message || 'Erro do servidor ao reenviar e-mail.', 'error');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead && !n.deletedAt).length;

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', enabled: !!user },
    { label: 'Quest\u00F5es', icon: BookOpen, path: '/practice', enabled: practiceEnabled },
    { label: 'Lei comentada', icon: FileText, path: '/lei-comentada', enabled: true, moduleEnabled: annotatedLawsEnabled },
    { label: 'Flashcards', icon: Layers, path: '/flashcards', enabled: true, moduleEnabled: flashcardsEnabled },
    { label: 'Simulados', icon: Timer, path: '/simulation', enabled: simulationsEnabled },
    { label: 'Raio-X Banca', icon: Zap, path: '/x-ray', enabled: xRayEnabled },
    { label: 'Rankings', icon: Trophy, path: '/ranking', enabled: rankingsEnabled },
    { label: 'Loja', icon: ShoppingBag, path: '/marketplace', enabled: marketplaceEnabled },
    { label: 'Perfil', icon: User, path: '/profile/personal', enabled: !!user },
  ].filter((item) => {
    const isGloballyDisabled = item.enabled === false;
    const isModuleDisabled = item.moduleEnabled === false;

    if (isGloballyDisabled || isModuleDisabled) {
      return isStrictAdmin;
    }

    return true;
  });

  if (canOpenAdminPanel) {
    navItems.push({ label: 'Painel Admin', icon: ShieldAlert, path: buildAdminPath('panel', 'dashboard') });
  }

  const isActive = (path: string) => {
    if (path.startsWith('/profile')) return location.pathname.startsWith('/profile');
    if (path.startsWith('/admin')) return location.pathname.startsWith('/admin');
    return location.pathname === path;
  };

  // Only consider the plan active if there is a valid subscription status (active or trialing)
  // Otherwise, fallback to 'Gratuito'. This mirrors the logic in Profile.tsx
  const hasActiveSub = hasActivePlanAccess(user);
  const currentPlan = hasActiveSub ? getEffectivePlanDisplayName(user) : 'Gratuito';
  const currentCanonicalPlan = getEffectivePlanName(user);
  const currentTier = React.useMemo(() => getEffectivePlanTier(user), [user]);
  const hasXRayAccess = hasPlanBenefit(user, 'xray_banca', systemSettings.planEntitlements);

  const userName = user?.name || 'Visitante';
  const userInitials = userName.charAt(0);
  const userLevel = user?.level || 0;

  const getPlanStatusTheme = (tier: number) => {
    switch (tier) {
      case 4:
        return {
          box: 'bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg',
          icon: Crown,
          badge: 'Maximo',
        };
      case 3:
        return {
          box: 'bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-4 text-white shadow-lg',
          icon: Zap,
          badge: 'Pro',
        };
      case 2:
        return {
          box: 'bg-gradient-to-r from-sky-500 to-cyan-600 rounded-xl p-4 text-white shadow-lg',
          icon: Check,
          badge: 'Essencial',
        };
      default:
        return {
          box: 'bg-slate-100 dark:bg-slate-800/80 rounded-xl p-4 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 shadow-sm',
          icon: Lock,
          badge: 'Gratis',
        };
    }
  };
  const currentPlanTheme = getPlanStatusTheme(currentTier);

  const handleNotificationClick = (n: Notification) => {
    markNotificationAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      if (n.link.includes('#')) {
        const id = n.link.split('#')[1];
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all');
            setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500/50'), 2000);
          }
        }, 600);
      }
    }
    setIsNotifOpen(false);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social': return MessageSquare;
      case 'report': return Shield;
      case 'marketplace': return ShoppingBag;
      case 'system':
      default: return Info;
    }
  };

  const NotificationDropdown = () => (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-scale-in">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Notificações</h3>
        {unreadCount > 0 && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{unreadCount} novas</span>}
      </div>
      <div className="max-h-80 overflow-y-auto no-scrollbar">
        {notifications.filter(n => !n.deletedAt).length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">Nenhuma notificação.</div>
        ) : (
          notifications.filter(n => !n.deletedAt).slice(0, 5).map(n => {
            const CategoryIcon = getCategoryIcon(n.category);
            return (
              <div key={n.id} onClick={(e) => {
                // Se não tem link, marcamos como lida ao clicar na notificação diretamente
                if (!n.link) {
                  markNotificationAsRead(n.id);
                } else {
                  handleNotificationClick(n);
                }
              }} className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${n.category === 'social' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : n.category === 'report' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : n.category === 'marketplace' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    <CategoryIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-bold ${n.type === 'error' ? 'text-red-600 dark:text-red-400' : n.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>{n.title}</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">{new Date(n.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{n.message}</p>
                    {n.evidenceUrl && (
                      <div className="mt-3">
                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1"><Info size={10} /> Prova Anexada:</p>
                        <img src={n.evidenceUrl} alt="Prova" className="rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 object-contain bg-slate-50 dark:bg-slate-800" />
                      </div>
                    )}
                    {n.link && <p className="text-[9px] text-indigo-500 dark:text-indigo-400 font-bold uppercase mt-1 flex items-center gap-1">Ver <ArrowRight size={10} /></p>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => { setIsNotifOpen(false); navigate('/notifications'); }}
          className="w-full py-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          Ver Todas <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );

  const isDashboardPage = location.pathname.startsWith('/admin') || location.pathname === '/partner-dashboard';
  const isSimulationFullscreenPage = location.pathname.startsWith('/simulation')
    && simulationSearchParams.get('immersive') === '1';
  const hasMobileTopHeader = !isDashboardPage && !isSimulationFullscreenPage;

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark text-slate-100' : 'text-slate-900'} bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300`}>
      <PromoBanner />

      {showVerificationModal && user && !user.emailVerified && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-w-md w-full rounded-[2.5rem] p-8 shadow-2xl relative animate-scale-in border border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={closeVerificationModal}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Mail size={36} />
            </div>
            <h2 className="text-2xl font-black mb-3 text-slate-800 dark:text-slate-100 tracking-tight">Verifique seu E-mail</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium mb-8">
              Enviamos um link de confirmação para <br/><strong className="text-slate-700 dark:text-slate-200">{user.email}</strong>.
              <br/><br/>
              Acesse sua caixa de entrada e ative sua conta para liberar todas as funcionalidades e ganhar <span className="text-indigo-600 dark:text-indigo-400 font-bold">+50 XP</span>!
            </p>
            
            <button
              disabled={resendTimer > 0}
              onClick={handleResendConfirmation}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all shadow-lg flex items-center justify-center gap-3 ${resendTimer > 0 ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95'}`}
            >
              {resendTimer > 0 ? `Aguarde ${resendTimer}s` : <><Rocket size={16} /> Reenviar E-mail</>}
            </button>
            <button
              onClick={closeVerificationModal}
              className="w-full mt-4 py-3 rounded-xl text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors"
            >
              Fazer isso depois
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Mobile Header */}
        {hasMobileTopHeader && (
          <div className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl">
              <BrainCircuit />
              <span>ConcursoMestre</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-black uppercase"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <div className="relative">
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-1 relative">
                  <Bell size={20} className="text-slate-600 dark:text-slate-400" />
                  {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
                </button>
                {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                    <NotificationDropdown />
                  </>
                )}
              </div>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 dark:text-slate-400">
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
            </div>
          </div>
        )}

        {/* Sidebar Navigation */}
        {!isDashboardPage && !isSimulationFullscreenPage && (
          <aside className={`
            fixed inset-y-0 left-0 z-30 h-[100dvh] w-[84vw] max-w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out flex flex-col
            md:relative md:translate-x-0
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="p-6 hidden md:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-2xl mb-6">
              <BrainCircuit className="w-8 h-8" />
              <span>ConcursoMestre</span>
            </div>

            <div className="px-6 mb-6 md:hidden mt-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                  {userInitials}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{userName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{user ? `Nível ${userLevel}` : 'Acesse sua conta'}</p>
                </div>
              </div>
            </div>

            <nav className="px-4 space-y-2 flex-1">
              {navItems.map((item) => {
                const isAdminItem = item.path.startsWith('/admin');
                const isCurrent = isActive(item.path);
                let styles = "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium relative ";

                if (isAdminItem) {
                  styles += isCurrent
                    ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shadow-sm border border-rose-100 dark:border-rose-900/30"
                    : "text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400";
                } else {
                  styles += isCurrent
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100";
                }

                // Logic to lock/unlock features based on plan
                // Raio-X Banca is exclusive to Tier 4 (Elite)
                const isLocked = item.label === 'Raio-X Banca' && !hasXRayAccess;
                const isGloballyDisabled = item.enabled === false;
                const isModuleDisabled = item.moduleEnabled === false;
                const shouldShowDevBadge = isGloballyDisabled || isModuleDisabled;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`${styles} ${isLocked ? 'opacity-75' : ''}`}
                    title={shouldShowDevBadge ? 'Desativado no admin (visivel apenas para Admin)' : ''}
                  >
                    <item.icon size={20} />
                    {item.label}
                    {item.path === '/changelog' && unreadCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-500 absolute left-8 top-3.5 animate-pulse shadow-sm shadow-red-500/50" />
                    )}
                    {isLocked && (
                      <Lock size={14} className="absolute right-4 text-amber-500" />
                    )}
                    {shouldShowDevBadge && !isLocked && (
                      <span className="absolute right-4 px-1.5 py-0.5 text-[8px] font-black uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded">DEV</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {user && (
                <div className={currentPlanTheme.box}>
                  <Link to="/plans" className="block text-inherit hover:opacity-80 transition-opacity">
                    <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-1">Status da Conta</p>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <currentPlanTheme.icon size={14} className={currentTier === 4 ? 'fill-current' : ''} />
                      Plano {currentCanonicalPlan}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">
                      {currentPlanTheme.badge}
                    </p>
                  </Link>
                </div>
              )}
              {user ? (
                <LogoutConfirmButton>
                  {({ isLoggingOut, openConfirm }) => (
                    <button
                      onClick={openConfirm}
                      disabled={isLoggingOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <LogOut size={16} /> {isLoggingOut ? 'Saindo...' : 'Sair'}
                    </button>
                  )}
                </LogoutConfirmButton>
              ) : (
                <button
                  onClick={() => {
                    sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search + location.hash);
                    navigate('/auth');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 uppercase tracking-widest rounded-lg transition-all"
                >
                  Entrar
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="min-h-0 flex flex-1 flex-col overflow-hidden">
          {/* Desktop Top Bar with Notifications */}
          <div className={`${isSimulationFullscreenPage ? 'hidden' : 'hidden md:flex'} z-20 items-center justify-end bg-slate-50/80 p-4 px-6 backdrop-blur transition-colors dark:bg-slate-950/80 lg:px-8`}>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all"
                title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              <button
                onClick={() => navigate('/support')}
                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all"
                title="Suporte e Feedback"
              >
                <HelpCircle size={20} />
              </button>

              {/* Sempre mostrar notificações se o usuário estiver logado, independente da feature flag global, se o usuário pediu para restaurar */}
              {user && (
                <div className="relative">
                  <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all relative">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />}
                  </button>
                  {isNotifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                      <NotificationDropdown />
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{userName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user ? `Nível ${userLevel}` : 'Visitante'}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md cursor-pointer hover:opacity-80 transition-opacity" onClick={() => user ? navigate('/profile/personal') : navigate('/auth')}>
                  {userInitials}
                </div>
              </div>
            </div>
          </div>

          <div className={`no-scrollbar flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950 ${isSimulationFullscreenPage ? 'p-3 sm:p-4 md:p-6' : 'p-3 pt-[84px] sm:p-4 sm:pt-[88px] md:p-6 md:pt-6 lg:p-8'} ${hasMobileTopHeader ? '' : 'pt-3 sm:pt-4 md:pt-6'}`}>
            <div className={`${isSimulationFullscreenPage ? 'mx-auto w-full max-w-7xl pb-6' : `${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto pb-12`}`}>
              {!isSimulationFullscreenPage && <AdBanner type="top" className="mb-8" />}
              {children}
              {!isSimulationFullscreenPage && <AdBanner type="bottom" className="mt-8" />}
              {!isSimulationFullscreenPage && <Footer />}
            </div>
          </div>
        </main>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(Layout);

