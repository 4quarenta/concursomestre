
import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, User, Menu, X, BrainCircuit, Trophy, LogOut, Timer, Zap, ShoppingBag, ShieldAlert, Bell, Check, ArrowRight, Info, Sun, Moon, MessageSquare, Shield, DollarSign } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import PromoBanner from './PromoBanner';
import { Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser: user, logout } = useAuth();
  const { notifications, markNotificationAsRead, systemSettings } = useData();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // if (!user) return null; // Removed to allow guest access

  const unreadCount = notifications.filter(n => !n.isRead && !n.deletedAt).length;

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Questões', icon: BookOpen, path: '/practice', enabled: systemSettings.features.practiceEnabled },
    { label: 'Simulados', icon: Timer, path: '/simulation', enabled: true },
    { label: 'Raio-X Banca', icon: Zap, path: '/x-ray', enabled: systemSettings.features.xRayEnabled },
    { label: 'Rankings', icon: Trophy, path: '/ranking', enabled: systemSettings.features.rankingsEnabled },
    { label: 'Loja', icon: ShoppingBag, path: '/marketplace', enabled: systemSettings.features.marketplaceEnabled },
    { label: 'Perfil', icon: User, path: '/profile', enabled: !!user },
  ].filter(item => item.enabled !== false);

  if (user?.isAdmin) {
    navItems.push({ label: 'Painel Admin', icon: ShieldAlert, path: '/admin' });
  }

  const isActive = (path: string) => location.pathname === path;
  const currentPlan = user?.billing?.plan || 'Gratuito';
  const userName = user?.name || 'Visitante';
  const userInitials = userName.charAt(0);
  const userLevel = user?.level || 0;

  const getPlanStyle = (plan: string) => {
    switch (plan) {
      case 'Elite': return 'from-amber-500 to-orange-600';
      case 'Pro': return 'from-indigo-500 to-purple-600';
      case 'Essencial': return 'from-blue-500 to-cyan-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

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
              <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
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

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark text-slate-100' : 'text-slate-900'} bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300`}>
      <PromoBanner />

      <div className="flex flex-1 flex-col md:flex-row h-full overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center sticky top-0 z-20">
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

        {/* Sidebar Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out flex flex-col
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
              const isAdminItem = item.path === '/admin';
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

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={styles}
                >
                  <item.icon size={20} />
                  {item.label}
                  {item.label === 'Raio-X Banca' && currentPlan !== 'Elite' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400" title="Exclusivo Elite" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            {user && (
              <div className={`bg-gradient-to-r ${getPlanStyle(currentPlan)} rounded-xl p-4 text-white shadow-lg`}>
                <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-1">Status da Conta</p>
                <p className="text-sm font-bold flex items-center gap-1">Plano {currentPlan}</p>
              </div>
            )}
            {user ? (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
              >
                <LogOut size={16} /> Sair
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 uppercase tracking-widest rounded-lg transition-all"
              >
                Entrar
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden">
          {/* Desktop Top Bar with Notifications */}
          <div className="hidden md:flex justify-end items-center p-4 px-8 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur z-20">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all"
                title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              {systemSettings.features.notificationsEnabled && (
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
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user ? `Nível ${userLevel}` : 'Online'}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {userInitials}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <div className="max-w-5xl mx-auto pb-10">
              {children}
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
