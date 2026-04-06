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
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Database,
    DollarSign,
    Megaphone,
    MessageSquare,
    Settings,
    Shield,
    Store,
    ArrowLeft,
    ChevronRight,
    User,
    Package,
    FileText,
    Home,
    LogOut
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';

interface SidebarItemProps {
    label: string;
    icon: any;
    active: boolean;
    onClick: () => void;
    badge?: string | number;
}

const SidebarItem = ({ label, icon: Icon, active, onClick, badge }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${active
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
    >
        <div className="flex items-center gap-3">
            <Icon size={18} className={active ? 'text-white' : 'group-hover:text-indigo-600 transition-colors'} />
            <span className="text-xs font-black uppercase tracking-widest">{label}</span>
        </div>
        {badge !== undefined && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                {badge}
            </span>
        )}
    </button>
);

interface DashboardSidebarProps {
    type: 'admin' | 'partner';
    activeTab: string;
    onTabChange: (tab: any) => void;
    tabs: { key: string; label: string; icon: any; badge?: number }[];
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ type, activeTab, onTabChange, tabs }) => {
    const { currentUser, logout } = useAuth();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        window.location.href = '/#/auth'; // Força redirecionamento via URL para garantir limpeza total
    };

    return (
        <aside className="fixed md:sticky top-0 left-0 w-64 h-screen flex-none bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-6">
                    <div className={`p-2 rounded-xl ${type === 'admin' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {type === 'admin' ? <Shield size={20} /> : <Store size={20} />}
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            {type === 'admin' ? 'Painel Admin' : 'Painel Parceiro'}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de Sistema</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-2 overflow-y-auto no-scrollbar">
                {tabs.map((tab) => (
                    <SidebarItem
                        key={tab.key}
                        label={tab.label}
                        icon={tab.icon}
                        active={activeTab === tab.key}
                        onClick={() => onTabChange(tab.key)}
                        badge={tab.badge}
                    />
                ))}
            </nav>

            {/* Footer / User */}
            <div className="p-4 border-t border-slate-50 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                        {currentUser?.name?.charAt(0) || 'A'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{currentUser?.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{currentUser?.email}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Link
                        to="/"
                        className="flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 transition-all group"
                    >
                        <Home size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Início
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 hover:bg-red-50 dark:hover:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                        <LogOut size={14} /> Sair
                    </button>
                </div>
            </div>
        </aside>
    );
};
