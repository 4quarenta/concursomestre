import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { Difficulty, Subject, Question, ErrorReport, Material, UserProfile, SystemSettings, DiscountCode, AppPromotionTheme, GlobalTaxonomies } from '../types';
import {
  Search, Trash2, Plus, Edit3, X, XCircle, Flag, AlertTriangle, CheckCircle2, ShoppingBag, LayoutDashboard,
  DollarSign, Users, TrendingUp, Filter, Image as ImageIcon, FileCheck, Ban, MessageSquare, Clock, Eye,
  Settings, User, CreditCard, Megaphone, Palette, Lock, Download, Tag, Mail, Percent, BookOpen, Terminal,
  PlusCircle, Check, AlertCircle, Layers, Save, Database, UploadCloud, FileText, Loader2, PlayCircle,
  Copy, Edit2, Briefcase, ShieldCheck, RefreshCcw, LifeBuoy, Trophy, Link as LinkIcon, Globe,
  Calendar, Sparkles, Shield, GraduationCap, ShieldAlert, ShoppingCart, Upload, Bell, ChevronUp, ChevronDown, Zap, Crown,
  Repeat, Flame, Music, Gift, Star, Info, ChevronLeft, ChevronRight, UserPlus, BarChart3, Home, Activity, MapPin, MessageCircle, ArrowUpCircle, Sun, Moon, HelpCircle, ArrowRight, QrCode, Cpu
} from 'lucide-react';
import { aiService } from '@features/questions';
import { getAssetUrl } from '../src/core/api/client';
import * as pdfjs from 'pdfjs-dist';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { reputationService } from '@features/auth';
import { themeConfig } from '../ui/temas';
import { apiClient, ENDPOINTS } from '@core/api';
import { AdminFeedback } from '../src/features/admin/components/AdminFeedback';
import { DashboardSidebar } from '../src/components/layout/DashboardSidebar';
import Footer from '../src/components/layout/Footer';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const api = apiClient;

pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

// --- COMPONENTE DE SELEÇÃO INTELIGENTE (TAGS) ---

interface SmartTagSelectorProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

// NotificationDropdown component moved outside SmartTagSelector
const NotificationDropdown = ({ notifications, markNotificationAsRead, unreadCount, setIsNotifOpen, navigate }: any) => (
  <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-scale-in text-left">
    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
      <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Notificações</h3>
      {unreadCount > 0 && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{unreadCount} novas</span>}
    </div>
    <div className="max-h-80 overflow-y-auto no-scrollbar">
      {notifications.filter(n => !n.deletedAt).length === 0 ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">Nenhuma notificação.</div>
      ) : (
        notifications.filter(n => !n.deletedAt).slice(0, 5).map(n => (
          <div key={n.id} onClick={() => { markNotificationAsRead(n.id); if (n.link) navigate(n.link); setIsNotifOpen(false); }} className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-bold ${n.type === 'error' ? 'text-red-600 dark:text-red-400' : n.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>{n.title}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">{new Date(n.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{n.message}</p>
              </div>
            </div>
          </div>
        ))
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

const SmartTagSelector: React.FC<SmartTagSelectorProps> = ({ label, options, selected, onChange, placeholder, multiple = true }) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, markNotificationAsRead, systemSettings: dataSettings } = useData();
  const { currentUser } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = (notifications || []).filter(n => !n.isRead && !n.deletedAt).length;
  const navigate = useNavigate(); // Added useNavigate hook here

  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const userLevel = currentUser?.level || 0;

  const handleNotificationClick = (n: any) => {
    markNotificationAsRead(n.id);
    if (n.link) navigate(n.link);
    setIsNotifOpen(false);
  };


  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(inputValue.toLowerCase()) && !selected.includes(opt)
  );

  const handleAdd = (val: string) => {
    if (!val.trim()) return;
    if (multiple) {
      if (!selected.includes(val)) onChange([...selected, val]);
    } else {
      onChange([val]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleRemove = (val: string) => {
    onChange(selected.filter(s => s !== val));
  };

  return (
    <div className="space-y-1.5 flex-1" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <div className="min-h-[44px] p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          {selected.map((s, i) => (
            <span key={`${s}-${i}`} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100 dark:border-indigo-900/50">
              {s}
              <button onClick={() => handleRemove(s)} className="hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors"><X size={12} /></button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputValue) {
                e.preventDefault();
                handleAdd(inputValue);
              }
            }}
            placeholder={selected.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[80px] px-2"
          />
        </div>

        {isOpen && (inputValue || filteredOptions.length > 0) && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto no-scrollbar py-2">
            {filteredOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleAdd(opt)}
                className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {opt}
              </button>
            ))}
            {inputValue && !options.includes(inputValue) && (
              <button
                onClick={() => handleAdd(inputValue)}
                className="w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={14} /> Adicionar "{inputValue}"
                </div>
                <div className="text-[10px] text-slate-400 font-normal ml-6 italic">
                  Slug: {inputValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ questions, allMaterials, allTransactions, allUsers, systemSettings, allReports, allRankings, onNavigate }: any) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const filterByPeriod = (items: any[], dateField: string = 'createdAt') => {
    if (!items || selectedPeriod === 'all') return items;

    if (selectedPeriod === 'custom') {
      if (!customStartDate || !customEndDate) return items;
      const start = new Date(customStartDate).getTime();
      const end = new Date(customEndDate + "T23:59:59").getTime();
      return items.filter((item: any) => {
        const itemDate = new Date(item[dateField] || item.timestamp).getTime();
        return itemDate >= start && itemDate <= end;
      });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return items.filter((item: any) => {
      const itemDate = new Date(item[dateField] || item.timestamp).getTime();
      switch (selectedPeriod) {
        case 'today': return itemDate >= startOfDay;
        case 'week': return itemDate >= startOfWeek;
        case 'month': return itemDate >= startOfMonth;
        case 'year': return itemDate >= startOfYear;
        default: return true;
      }
    });
  };

  const filteredTransactions = filterByPeriod(allTransactions, 'timestamp');
  const filteredUsers = filterByPeriod(allUsers, 'createdAt'); // Assuming users have createdAt
  const filteredMaterials = filterByPeriod(allMaterials, 'createdAt'); // Assuming materials have createdAt
  const filteredQuestions = filterByPeriod(questions, 'createdAt'); // Assuming questions have createdAt

  // --- STATE FOR AVAILABLE VALUES TOGGLE ---
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);


  const calculateMaterialMetrics = () => {
    const metrics = {
      totalSales: 0,
      platformRevenue: 0, // 20%
      sellerPayout: 0,    // 80%
      heldBalance: 0,     // < 7 days
      availablePayout: 0  // >= 7 days
    };

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (filteredTransactions) {
      filteredTransactions.forEach((t: any) => {
        if (t.status !== 'completed') return;

        metrics.totalSales += t.amount;
        metrics.platformRevenue += t.amount * 0.20;

        const sellerShare = t.amount * 0.80;
        metrics.sellerPayout += sellerShare;

        const isHeld = (now - t.timestamp) < SEVEN_DAYS_MS;
        if (isHeld) {
          metrics.heldBalance += sellerShare;
        } else {
          metrics.availablePayout += sellerShare;
        }
      });
    }

    return metrics;
  };

  const [stats, setStats] = useState({
    total_revenue: 0,
    platform_revenue: 0,
    subscription_revenue: 0,
    marketplace_revenue: 0,
    active_subscriptions: 0,
    cancelled_subscriptions: 0,
    mrr: 0,
    new_users: 0,
    seller_payout: 0,
    total_refunded: 0,
    held_balance: 0,
    transactions_count: 0,
    questions_count: 0,
    users_count: 0,
    materials_count: 0,
    rankings_count: 0,
    available_subscription_revenue: 0,
    available_platform_revenue: 0,
    available_seller_payout: 0,
    total_paid: 0,
    feedback_count: 0
  });

  useEffect(() => {
    // Fetch stats from server with period parameter
    setLoading(true);
    let url = `admin/stats.php?period=${selectedPeriod}`;
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
    }

    apiClient.get(url)
      .then((res: any) => {
        if (res.success || (res.data && res.data.success)) {
          const data = res.data?.data || res.data || res;
          setStats(data);
        }
      })
      .catch(err => console.error('Error fetching admin stats:', err))
      .finally(() => setLoading(false));
  }, [selectedPeriod, customStartDate, customEndDate]);




  // --- CALCULATE FINANCE OVERVIEW ---
  // We keep this for the "Available Only" filter logic if needed, but primarily use server stats for the cards
  const financeOverview = useMemo(() => {
    // Combine server stats with local filter logic if necessary
    // For now, we use server stats for the main cards but calculate the breakdown locally where stats.php doesn't cover yet
    let refundRequestsCount = 0;
    let heldBalance = 0;
    let availablePayout = 0;

    if (filteredTransactions) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      filteredTransactions.forEach((t: any) => {
        if (t.status === 'refund_requested') {
          refundRequestsCount++;
        } else if (t.status === 'completed' || t.status === 'approved') {
          const isHeld = (now - t.timestamp) < SEVEN_DAYS_MS;
          const sellerShare = t.amount * 0.80;
          if (isHeld) heldBalance += sellerShare;
          else availablePayout += sellerShare;
        }
      });
    }

    return {
      totalRevenue: stats.total_revenue,
      platformTotalRevenue: stats.platform_revenue,
      sellerPayout: stats.seller_payout,
      activeSubscriptions: stats.active_subscriptions,
      subscriptionRevenue: stats.mrr, // Using MRR for the estimate display
      platformFees: stats.platform_revenue - stats.subscription_revenue,
      refundRequestsCount,
      heldBalance,
      availablePayout
    };
  }, [stats, filteredTransactions]);

  const matMetrics = calculateMaterialMetrics(); // Keep specifically for material breakdown if needed


  const filteredReports = filterByPeriod(allReports, 'createdAt');

  return (
    <div className="space-y-8 animate-slide-up">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Visão Geral</h2>
          <p className="text-xs text-slate-500 font-medium">Resumo estratégico da plataforma.</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['all', 'today', 'week', 'month', 'year', 'custom'] as const).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${selectedPeriod === period ? 'bg-white dark:bg-slate-700 text-slate-900 dark:white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                {period === 'all' ? 'Tudo' : period === 'today' ? 'Hoje' : period === 'week' ? 'Semana' : period === 'month' ? 'Mês' : period === 'year' ? 'Ano' : 'Custom'}
              </button>
            ))}
          </div>
          {selectedPeriod === 'custom' && (
            <div className="flex gap-2 items-center animate-fade-in">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-[10px] font-black text-slate-400">ATÉ</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}
        </div>
      </div>

      {/* 1. VISÃO GERAL (ALERTS & QUICK STATS) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Assinaturas Ativas */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assinaturas Ativas</p>
              <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.active_subscriptions || 0}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600"><CheckCircle2 size={20} /></div>
          </div>
          <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
            <TrendingUp size={10} className="text-emerald-500" /> MRR: R$ {stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </div>
        </div>

        {/* Assinaturas Canceladas */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assinaturas Canceladas</p>
              <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats.cancelled_subscriptions || 0}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-rose-600"><XCircle size={20} /></div>
          </div>
          <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Taxa de Churn Analisada</div>
        </div>

        {/* Novos Usuários */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novos Usuários</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.new_users || 0}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600"><UserPlus size={20} /></div>
          </div>
          <div className="mt-4 text-[10px] text-slate-400 font-bold flex justify-between items-center">
            <span>Período Selecionado</span>
            <button onClick={() => onNavigate && onNavigate('database', 'users')} className="text-indigo-600 hover:text-indigo-700 transition-colors">Ver &rarr;</button>
          </div>
        </div>

        {/* Vendas Realizadas */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendas Realizadas</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.transactions_count || 0}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600"><ShoppingBag size={20} /></div>
          </div>
          <div className="mt-4 text-[10px] text-slate-400 font-bold flex justify-between items-center">
            <span>Total de Itens</span>
            <button onClick={() => onNavigate && onNavigate('finance', 'transactions')} className="text-indigo-600 hover:text-indigo-700 transition-colors">Ver &rarr;</button>
          </div>
        </div>

        {/* Solicitações Pendentes */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendentes</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{financeOverview.refundRequestsCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600"><AlertCircle size={20} /></div>
          </div>
          <div className="mt-4 text-[10px] text-slate-400 font-bold flex justify-between items-center">
            <span>Reembolsos</span>
            <button onClick={() => onNavigate && onNavigate('finance', 'refunds')} className="text-amber-600 hover:text-amber-700 transition-colors">Resolver &rarr;</button>
          </div>
        </div>
      </section>

      {/* 2. FINANCEIRO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-500" /> Financeiro
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAuditModalOpen(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest transition-all"
            >
              <Terminal size={14} className="text-indigo-500" /> Auditar Lógica
            </button>
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-600 transition-colors">Apenas Disponível</span>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${showAvailableOnly ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${showAvailableOnly ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <input type="checkbox" checked={showAvailableOnly} onChange={e => setShowAvailableOnly(e.target.checked)} className="hidden" />
            </label>
          </div>
        </div>
        {/* ENTRADAS E VOLUME */}
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Entradas e Volume</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Revenue */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full opacity-50 pointer-events-none" />
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 relative z-10">
              {showAvailableOnly ? 'Volume Disponível' : 'Receita Total Bruta (Assinatura e Materiais)'}
            </p>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 relative z-10">
              R$ {(showAvailableOnly ? stats.total_revenue - stats.held_balance : stats.total_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
          </div>

          {/* Marketplace Revenue */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ganho com Vendas de Material (Total)</p>
            <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {stats.marketplace_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="mt-2 text-[9px] text-slate-400 font-bold uppercase">Total Bruto</div>
          </div>

          {/* Subscription Revenue */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              {showAvailableOnly ? 'R. Assinaturas Disponível' : 'Receita com Assinaturas (Total)'}
            </p>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              R$ {(showAvailableOnly ? stats.available_subscription_revenue : stats.subscription_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-2 text-[9px] text-slate-400 font-bold uppercase">Planos Ativos</div>
          </div>
        </div>

        {/* REPASSES E SAÍDAS */}
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Repasses e Saídas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Platform Net Revenue - NOW GREEN (EMERALD) */}
          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">
              {showAvailableOnly ? 'R. Líquida Disponível' : 'Receita Líquida da Plataforma (Assinaturas e Taxa Materiais)'}
            </p>
            <h3 className="text-xl font-black text-emerald-700 dark:text-emerald-300">
              R$ {(showAvailableOnly ? stats.available_platform_revenue : stats.platform_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-2 text-[9px] text-emerald-400 font-bold uppercase">Comissões + Planos</div>
          </div>

          {/* Paid Value - NOW BLUE */}
          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30">
            <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Valor Pago</p>
            <h3 className="text-xl font-black text-blue-700 dark:text-blue-300">
              R$ {(stats.total_paid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-2 text-[9px] text-blue-400 font-bold uppercase">Repasses Realizados</div>
          </div>

          {/* Seller Payout */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full opacity-30 pointer-events-none" />
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 relative z-10">
              {showAvailableOnly ? 'A Repassar Disponível' : 'Valor para Repassar aos Vendedores'}
            </p>
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 relative z-10">
              R$ {(showAvailableOnly ? stats.available_seller_payout : stats.seller_payout).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-2 text-[9px] text-slate-400 font-bold uppercase relative z-10">Venda de Materiais</div>
          </div>

          {/* Held Balance */}
          <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30">
            <p className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-1">Valor Retido (7 dias Reembolso)</p>
            <h3 className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {stats.held_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="mt-2 text-[9px] text-amber-400 font-bold uppercase">Garantia Reembolso</div>
          </div>

          {/* Total Refunded */}
          <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/30">
            <p className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">Devoluções</p>
            <h3 className="text-xl font-black text-rose-700 dark:text-rose-300">R$ {stats.total_refunded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div className="mt-2 text-[9px] text-rose-400 font-bold uppercase">Reembolsado</div>
          </div>
        </div>

      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 3. ESTATÍSTICAS */}
        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" /> Estatísticas
          </h3>
          <div className="space-y-2">
            <div onClick={() => onNavigate && onNavigate('database', 'users')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:text-indigo-600 transition-colors"><Users size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total Usuários</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.users_count ?? allUsers?.length ?? 0}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div onClick={() => onNavigate && onNavigate('database', 'users')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600"><Briefcase size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Vendedores</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {allUsers?.filter((u: any) => u.role === 'partner' || u.isPartner).length || 0}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div onClick={() => onNavigate && onNavigate('database', 'questions')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:text-indigo-600 transition-colors"><BookOpen size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Questões Cadastradas</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.questions_count ?? questions?.length ?? 0}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div onClick={() => onNavigate && onNavigate('database', 'materials')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:text-indigo-600 transition-colors"><FileText size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Materiais na Loja</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.materials_count ?? allMaterials?.length ?? 0}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div onClick={() => onNavigate && onNavigate('database', 'questions')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:text-indigo-600 transition-colors"><MessageSquare size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total Comentários</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {(questions?.reduce((acc: number, q: any) => acc + (q.commentsCount || q.comments?.length || 0), 0) || 0) +
                      (allMaterials?.reduce((acc: number, m: any) => acc + (m.comments?.length || 0), 0) || 0)}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div onClick={() => onNavigate && onNavigate('database', 'rankings')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:text-indigo-600 transition-colors"><Trophy size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Rankings Ativos</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.rankings_count ?? allRankings?.length ?? 0}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
          </div>
        </section>

        {/* 4. SUPORTE & MARKETING */}
        <section className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
              <LifeBuoy size={16} className="text-rose-500" /> Suporte & Moderação
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <div onClick={() => onNavigate && onNavigate('database', 'reports')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600"><AlertTriangle size={16} /></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Denúncias em Aberto</p>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">{filteredReports?.filter((r: any) => r.status === 'pending').length || 0}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
              </div>

              <div onClick={() => onNavigate && onNavigate('support', 'feedback')} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600"><MessageSquare size={16} /></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Feedbacks Recebidos</p>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">{stats.feedback_count || 0}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
              <Megaphone size={16} className="text-amber-500" /> Marketing
            </h3>
            <div onClick={() => onNavigate && onNavigate('marketing')} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all group">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cupons Ativos</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{systemSettings.coupons?.length || 0}</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600"><Tag size={20} /></div>
                <ChevronRight size={20} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* --- FINANCIAL AUDIT MODAL (FULL SCREEN PORTAL) --- */}
      {isAuditModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-white dark:bg-slate-950 overflow-hidden flex flex-col animate-fade-in">
          {/* Modal Header */}
          <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm relative z-20">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="text-indigo-500" size={28} /> Auditoria de Lógica Financeira
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                Detalhamento técnico dos algoritmos de cálculo e métricas da plataforma
              </p>
            </div>
            <button
              onClick={() => setIsAuditModalOpen(false)}
              className="p-3 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-900/20 rounded-2xl text-slate-400 hover:text-rose-500 transition-all active:scale-90"
            >
              <X size={28} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-8 bg-slate-50/30 dark:bg-slate-950/30">
            <div className="max-w-7xl mx-auto space-y-12 pb-20 mt-4">

              {/* 1. Logic Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                    <Layers className="text-indigo-500" size={20} /> Regras de Negócio
                  </h3>
                  <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    <p>O sistema processa transações automatizadas seguindo as leis de proteção ao consumidor e políticas de repasse:</p>
                    <ul className="space-y-4">
                      <li className="flex gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/5 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20"><Check size={14} /></div>
                        <div>
                          <p className="font-black text-emerald-900 dark:text-emerald-300">Venda de Materiais (Marketplace)</p>
                          <p className="text-xs text-emerald-700/70">80% Líquido Vendedor | 20% Taxa Plataforma</p>
                        </div>
                      </li>
                      <li className="flex gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20"><Zap size={14} /></div>
                        <div>
                          <p className="font-black text-indigo-900 dark:text-indigo-300">Planos e Assinaturas (Recorrência)</p>
                          <p className="text-xs text-indigo-700/70">100% Taxa Plataforma (Infraestrutura e Suporte)</p>
                        </div>
                      </li>
                      <li className="flex gap-3 p-4 bg-amber-50/50 dark:bg-amber-900/5 rounded-2xl border border-amber-100/50 dark:border-amber-900/20">
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/20"><Clock size={14} /></div>
                        <div>
                          <p className="font-black text-amber-900 dark:text-amber-300">Pagamentos Todo Dia 01</p>
                          <p className="text-xs text-amber-700/70">O repasse é liberado apenas no dia 1º do mês seguinte, respeitando os 7 dias de retenção legal (válido para assinaturas e materiais).</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 h-full">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-2 tracking-widest">Assinaturas Pro (Acumulado)</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100">R$ {stats.subscription_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase">
                      <ShieldCheck size={12} /> Auditado 100%
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-black text-rose-500 uppercase mb-2 tracking-widest">Total Devoluções</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100">R$ {(stats.total_refunded || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-1.5 text-[9px] font-bold text-rose-500 uppercase">
                      <RefreshCcw size={12} /> Somente Reembolsos
                    </div>
                  </div>
                  <div className="col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[40px] shadow-2xl shadow-indigo-500/30 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700"><DollarSign size={120} /></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Receita Líquida (Pronto para Repasse)</p>
                    <p className="text-5xl font-black tracking-tighter">R$ {(stats.available_platform_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-6 flex gap-2">
                      <span className="bg-white/10 px-3 py-1.5 rounded-xl text-[10px] font-black backdrop-blur-md uppercase tracking-widest">Saldo Auditado</span>
                      <span className="bg-emerald-400/20 text-emerald-100 px-3 py-1.5 rounded-xl text-[10px] font-black backdrop-blur-md uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={12} /> Fora da Retenção
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Transaction Logs */}
              <div className="space-y-6">
                <div className="flex justify-between items-end px-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                    <Search className="text-slate-400" /> Histórico de Transações do Período
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    Total Liquidadas: {filteredTransactions?.filter((t: any) => t.status !== 'pending').length}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[48px] overflow-hidden shadow-2xl shadow-slate-200/30 dark:shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
                          <th className="pl-10 pr-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">IDENTIFICAÇÃO</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TIPO</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">VALOR BRUTO</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">PLATAFORMA</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">VENDEDOR</th>
                          <th className="pr-10 pl-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(filteredTransactions || []).filter((t: any) => t.status !== 'pending' && t.status !== 'cancelled').sort((a: any, b: any) => b.timestamp - a.timestamp).map((t: any) => {
                          const isRefunded = t.status === 'refunded';
                          const isSub = t.type === 'plan' || (!t.material_id && !t.type);
                          const fee = isSub ? t.amount : (t.amount * 0.2);
                          const seller = isSub ? 0 : (t.amount - fee);

                          // --- MATCH BACKEND LOGIC (7 DAYS + DAY 1 OF NEXT MONTH) ---
                          const now = new Date();
                          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
                          const transDate = new Date(t.timestamp);

                          const passedWarranty = (now.getTime() - t.timestamp) >= SEVEN_DAYS_MS;
                          const isPastDay1OfNextMonth =
                            (now.getFullYear() > transDate.getFullYear()) ||
                            (now.getFullYear() === transDate.getFullYear() && now.getMonth() > transDate.getMonth());

                          const isHeld = !isRefunded && !(passedWarranty && isPastDay1OfNextMonth);

                          return (
                            <tr key={t.id} className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-300 ${isRefunded ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                              <td className="pl-10 pr-6 py-6">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all transform group-hover:rotate-6 ${isRefunded ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-500 group-hover:text-white'}`}>
                                    {isRefunded ? <RefreshCcw size={18} /> : <Home size={18} />}
                                  </div>
                                  <div>
                                    <p className={`text-[11px] font-black ${isRefunded ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>#TR-{t.id}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(t.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6 text-center">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isRefunded ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : isSub ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                  {isSub ? 'Assinatura' : 'Material'}
                                </span>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <span className={`text-[13px] font-black ${isRefunded ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <span className={`text-[12px] font-bold ${isRefunded ? 'text-slate-400 line-through' : isSub ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 font-medium'}`}>
                                  R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="px-6 py-6 text-right font-bold">
                                <span className={`${isRefunded ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {seller > 0 ? `R$ ${seller.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                </span>
                              </td>
                              <td className="pr-10 pl-6 py-6">
                                <div className="flex justify-center">
                                  {t.status === 'refunded' ? (
                                    <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-900/30 flex items-center gap-2">
                                      <XCircle size={12} /> Estornado
                                    </div>
                                  ) : isHeld ? (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                                      <Clock size={12} className="animate-pulse" /> Retido (Dia 01)
                                    </div>
                                  ) : (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
                                      <CheckCircle2 size={12} /> Confirmado
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {(!filteredTransactions || filteredTransactions.length === 0) && (
                    <div className="p-32 text-center">
                      <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 mb-4 mb-4"><Search size={40} /></div>
                      <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-sm">Sem movimentações registradas</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// --- LOG VIEWER COMPONENT ---

const LogViewer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(ENDPOINTS.system.logs);
      if (response.data?.success) {
        setLogs(response.data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: any;
    if (isOpen && autoRefresh) {
      interval = setInterval(fetchLogs, 5000);
    }
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-full max-h-[85vh] rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Terminal size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Visualizador de Logs</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">C:\xampp\apache\logs\error.log</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${autoRefresh ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
            >
              <RefreshCcw size={12} className={autoRefresh ? 'animate-spin-slow' : ''} />
              {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </button>
            <button onClick={fetchLogs} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Console Area */}
        <div
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-[11px] leading-relaxed selection:bg-indigo-500/30 selection:text-white scroll-smooth"
        >
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 italic">
              Nenhum log encontrado ou carregando...
            </div>
          ) : (
            logs.map((line, idx) => (
              <div key={idx} className="mb-1 text-slate-300 hover:text-white transition-colors border-l border-transparent hover:border-indigo-500/50 pl-3">
                <span className="text-slate-600 mr-2 tabular-nums">[{idx + 1}]</span>
                <span className={line.includes('[error]') ? 'text-red-400' : line.includes('[warn]') ? 'text-amber-400' : 'text-slate-300'}>
                  {line}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} /> Exibindo as últimas 100 linhas
          </span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Erros
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Alertas
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};



const AdminSettings = ({ systemSettings, updateSystemSettings, addToast }: any) => {
  const { currentUser, refreshUser } = useAuth();
  const [settingActiveTab, setSettingActiveTab] = useState<'general' | 'modules' | 'security' | 'integrations' | 'email' | 'ads' | 'performance'>('general');

  // API Keys
  const [localApiKey, setLocalApiKey] = useState(systemSettings.geminiApiKey || '');
  const [localStripeKey, setLocalStripeKey] = useState(systemSettings.stripeKey || '');
  const [localMercadoPagoKey, setLocalMercadoPagoKey] = useState(systemSettings.mercadoPagoKey || '');
  const [localRecaptchaSiteKey, setLocalRecaptchaSiteKey] = useState(systemSettings.recaptchaSiteKey || '');
  const [localRecaptchaSecretKey, setLocalRecaptchaSecretKey] = useState(systemSettings.recaptchaSecretKey || '');
  const [localFirebaseKey, setLocalFirebaseKey] = useState(systemSettings.firebaseConfig?.apiKey || '');
  const [localGaId, setLocalGaId] = useState(systemSettings.googleAnalyticsId || '');
  const [localPixelId, setLocalPixelId] = useState(systemSettings.metaPixelId || '');
  const [localPhone, setLocalPhone] = useState(systemSettings.supportPhone || '');
  const [localPixKey, setLocalPixKey] = useState(systemSettings.pixKey || '');
  const [localSiteName, setLocalSiteName] = useState(systemSettings.siteName || 'ConcursoMestre');
  const [localPlatformFee, setLocalPlatformFee] = useState(String(systemSettings.platformFeePercent ?? 20));
  // SMTP e modo de app
  const [localAppMode, setLocalAppMode] = useState<'development' | 'production'>(systemSettings.appMode || 'development');
  const [localSmtpHost, setLocalSmtpHost] = useState(systemSettings.smtpHost || '');
  const [localSmtpPort, setLocalSmtpPort] = useState(String(systemSettings.smtpPort || 587));
  const [localSmtpSecure, setLocalSmtpSecure] = useState<'tls' | 'ssl'>(systemSettings.smtpSecure || 'tls');
  const [localSmtpUser, setLocalSmtpUser] = useState(systemSettings.smtpUser || '');
  const [localSmtpPass, setLocalSmtpPass] = useState(systemSettings.smtpPass || '');
  const [localMailFrom, setLocalMailFrom] = useState(systemSettings.mailFromAddress || '');
  const [localMailFromName, setLocalMailFromName] = useState(systemSettings.mailFromName || 'ConcursoMestre');

  // Funcionalidades (Módulos e Recursos) - Gerenciado localmente antes de salvar
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>(systemSettings.features || {});

  // Ad-related states
  const [localAdsEnabled, setLocalAdsEnabled] = useState(!!systemSettings.adsEnabled);
  const [localAdsenseId, setLocalAdsenseId] = useState(systemSettings.adsenseClientId || '');
  const [localFacebookAdsId, setLocalFacebookAdsId] = useState(systemSettings.facebookAdsId || '');
  const [localAdTop, setLocalAdTop] = useState(systemSettings.adBannerTop || '');
  const [localAdSidebar, setLocalAdSidebar] = useState(systemSettings.adBannerSidebar || '');
  const [localAdBottom, setLocalAdBottom] = useState(systemSettings.adBannerBottom || '');

  const handleToggleFeature = (feature: string, value: boolean) => {
    setLocalFeatures(prev => ({ ...prev, [feature]: value }));
  };

  // 2FA States
  const [twoFactorStep, setTwoFactorStep] = useState<'status' | 'setup' | 'verify'>('status');
  const [twoFactorData, setTwoFactorData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [reset2FACode, setReset2FACode] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isFetchingTables, setIsFetchingTables] = useState(false);

  useEffect(() => {
    if (isResetModalOpen) {
      setIsFetchingTables(true);
      apiClient.get('admin/list_tables.php')
        .then((res: any) => {
           if (res.success || res.data?.success) {
               const tb = res.data?.data?.tables || res.data?.tables || [];
               setDbTables(tb);
               setSelectedTables(new Set(tb));
           }
        })
        .finally(() => setIsFetchingTables(false));
    }
  }, [isResetModalOpen]);

  const initiate2FASetup = async () => {
    try {
      const res: any = await apiClient.get('auth/setup_2fa.php');
      if (res.success || res.data?.success) {
        setTwoFactorData(res.data?.data || res.data);
        setTwoFactorStep('setup');
      }
    } catch (err) {
      addToast('Erro ao iniciar setup de 2FA', 'error');
    }
  };

  const verifyAndEnable2FA = async () => {
    try {
      const res: any = await apiClient.post('auth/enable_2fa.php', {
        secret: twoFactorData?.secret,
        code: twoFactorCode
      });
      if (res.success || res.data?.success) {
        addToast('2FA ativado com sucesso!', 'success');
        setTwoFactorStep('status');
        if (refreshUser) refreshUser();
      } else {
        addToast(res.data?.message || res.message || 'Código inválido', 'error');
      }
    } catch (err) {
      addToast('Erro ao validar 2FA', 'error');
    }
  };

  const handleSystemReset = async () => {
    if (resetConfirmText !== 'RESETAR') {
      setResetError('Digite RESETAR para confirmar');
      return;
    }
    setIsResetting(true);
    setResetError(null);
    try {
      const res: any = await apiClient.post('admin/reset_db.php', {
        password: resetPassword,
        twoFactorCode: reset2FACode,
        tables: Array.from(selectedTables)
      });
      if (res.success || res.data?.success) {
        addToast('Sistema resetado com sucesso! Redirecionando...', 'success');
        setTimeout(() => window.location.href = '/auth', 2000);
      } else {
        const msg = res.data?.message || res.message || 'Falha no reset';
        setResetError(msg);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro crítico no reset. Verifique as credenciais.';
      setResetError(msg);
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    setLocalApiKey(systemSettings.geminiApiKey || '');
    setLocalStripeKey(systemSettings.stripeKey || '');
    setLocalMercadoPagoKey(systemSettings.mercadoPagoKey || '');
    setLocalRecaptchaSiteKey(systemSettings.recaptchaSiteKey || '');
    setLocalRecaptchaSecretKey(systemSettings.recaptchaSecretKey || '');
    setLocalFirebaseKey(systemSettings.firebaseConfig?.apiKey || '');
    setLocalGaId(systemSettings.googleAnalyticsId || '');
    setLocalPixelId(systemSettings.metaPixelId || '');
    setLocalPhone(systemSettings.supportPhone || '');
    setLocalPixKey(systemSettings.pixKey || '');
    setLocalSiteName(systemSettings.siteName || 'ConcursoMestre');
    setLocalPlatformFee(String(systemSettings.platformFeePercent ?? 20));
    setLocalAppMode(systemSettings.appMode || 'development');
    setLocalSmtpHost(systemSettings.smtpHost || '');
    setLocalSmtpPort(String(systemSettings.smtpPort || 587));
    setLocalSmtpSecure(systemSettings.smtpSecure || 'tls');
    setLocalSmtpUser(systemSettings.smtpUser || '');
    setLocalSmtpPass(systemSettings.smtpPass || '');
    setLocalMailFrom(systemSettings.mailFromAddress || '');
    setLocalMailFromName(systemSettings.mailFromName || 'ConcursoMestre');
    setLocalFeatures(systemSettings.features || {});
    setLocalAdsEnabled(!!systemSettings.adsEnabled);
    setLocalAdsenseId(systemSettings.adsenseClientId || '');
    setLocalFacebookAdsId(systemSettings.facebookAdsId || '');
    setLocalAdTop(systemSettings.adBannerTop || '');
    setLocalAdSidebar(systemSettings.adBannerSidebar || '');
    setLocalAdBottom(systemSettings.adBannerBottom || '');
  }, [systemSettings]);

  const handleSaveSettings = () => {
    updateSystemSettings({
      ...systemSettings,
      siteName: localSiteName,
      supportPhone: localPhone,
      platformFeePercent: Number(localPlatformFee),
      pixKey: localPixKey,
      appMode: localAppMode,
      geminiApiKey: localApiKey,
      recaptchaSiteKey: localRecaptchaSiteKey,
      recaptchaSecretKey: localRecaptchaSecretKey,
      stripeKey: localStripeKey,
      mercadoPagoKey: localMercadoPagoKey,
      firebaseConfig: { ...systemSettings.firebaseConfig, apiKey: localFirebaseKey },
      googleAnalyticsId: localGaId,
      metaPixelId: localPixelId,
      smtpHost: localSmtpHost,
      smtpPort: Number(localSmtpPort),
      smtpUser: localSmtpUser,
      smtpPass: localSmtpPass,
      smtpSecure: localSmtpSecure,
      mailFromAddress: localMailFrom,
      mailFromName: localMailFromName,

      adBannerTop: localAdTop,
      adBannerSidebar: localAdSidebar,
      adBannerBottom: localAdBottom,
      adsEnabled: localAdsEnabled,
      adsenseClientId: localAdsenseId,
      facebookAdsId: localFacebookAdsId,
      features: localFeatures
    });
    addToast('Configurações salvas com sucesso!', 'success');
  };

  const settingTabs = [
    { id: 'general', label: 'Geral', icon: Settings },
    { id: 'modules', label: 'Módulos', icon: LayoutDashboard },
    { id: 'security', label: 'Segurança', icon: ShieldAlert },
    { id: 'integrations', label: 'Integrações', icon: Cpu },
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'ads', label: 'Anúncios', icon: Megaphone },
    { id: 'performance', label: 'Performance', icon: Database },
  ];

  const pageToggles = [
    // Módulos Originais
    { id: 'practiceEnabled', label: 'Página de Prática', description: 'Ativa o sistema de resolução de questões', icon: BookOpen },
    { id: 'simulationsEnabled', label: 'Página de Simulados', description: 'Módulo de provas cronometradas e simulados', icon: Clock },
    { id: 'marketplaceEnabled', label: 'Marketplace', description: 'Plataforma de compra e venda de materiais', icon: ShoppingCart },
    { id: 'rankingsEnabled', label: 'Rankings', description: 'Exibe classificações e desempenho de inscritos', icon: Trophy },
    { id: 'xRayEnabled', label: 'Raio-X da Banca', description: 'Análise estatística e perfil de bancas examinadoras', icon: Zap },
    { id: 'landingPagePromoEnabled', label: 'Promoção na Home', description: 'Exibe banner de campanha na landing page principal', icon: Megaphone },
    // Recursos
    { id: 'communityEnabled', label: 'Comentários da Comunidade', description: 'Interação e fórum de debate em questões', icon: MessageSquare },
    { id: 'aiCommentsEnabled', label: 'Comentários com IA', description: 'Geração de análises via Gemini Pro 1.5/2.0', icon: Sparkles },
    { id: 'bulkImportEnabled', label: 'Importador em Massa', description: 'Ferramenta de processamento de PDFs/Imagens', icon: Upload },
    { id: 'reportsEnabled', label: 'Sistema de Denúncias', description: 'Ouvidoria e moderação de conteúdo', icon: Flag },
    { id: 'notificationsEnabled', label: 'Notificações Push', description: 'Alertas globais e interações sociais', icon: Bell },
    // Configurações e Bloqueios Críticos
    { id: 'maintenanceMode', label: 'Aviso de Manutenção', description: 'Bloqueia o acesso ao site para manutenção técnica', icon: ShieldAlert },
    { id: 'registrationEnabled', label: 'Novos Cadastros', description: 'Controla a entrada de novos usuários na plataforma', icon: Users },
    { id: 'loginRequired', label: 'Login Obrigatório', description: 'Exige login para acessar qualquer conteúdo interno', icon: Lock },
    { id: 'partnerRegistrationEnabled', label: 'Cadastro de Vendedor', description: 'Permite que usuários se tornem colaboradores e vendam materiais', icon: ShoppingBag },
    { id: 'recurringEnabled', label: 'Cobranças Recorrentes (Beta)', description: 'Ativa a opção de assinatura recorrente mensal via plataforma para planos anuais/trimestrais sem comprometer o limite do cartão', icon: Repeat },
    { id: 'autoRefundEnabled', label: 'Aprovação Automática de Reembolso', description: 'Ativa o processamento instantâneo de reembolsos solicitados por usuários dentro do prazo legal', icon: RefreshCcw },
  ];

  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  const SettingRow = ({ keyName, label, description, icon: Icon }: any) => (
    <div
      key={keyName}
      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 transition-colors">
          <Icon size={18} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">{label}</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{description}</p>
        </div>
      </div>
      <button
        onClick={() => handleToggleFeature(keyName, !localFeatures[keyName])}
        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${localFeatures[keyName]
          ? keyName === 'maintenanceMode' ? 'bg-red-600' : 'bg-indigo-600 dark:bg-indigo-500'
          : 'bg-slate-300 dark:bg-slate-700'
          }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${localFeatures[keyName] ? 'right-1' : 'left-1'
            }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-up">
      <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex flex-wrap gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
          {settingTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingActiveTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSaveSettings}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20 active:scale-95"
        >
          <Save size={18} /> Salvar Alterações
        </button>
      </div>

      <div className="min-h-[400px]">
        {settingActiveTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Terminal size={20} className="text-indigo-600 dark:text-indigo-400" />
                    Ambiente da Plataforma
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Modo de operação, logs e acessos de desenvolvimento</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLogViewerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                  >
                    <FileText size={14} /> Visualizar Logs
                  </button>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${localAppMode === 'development' ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {localAppMode === 'development' ? 'DEV' : 'PRODUÇÃO'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLocalAppMode(localAppMode === 'development' ? 'production' : 'development')}
                      className={`relative w-12 h-6 rounded-full transition-colors ${localAppMode === 'production' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${localAppMode === 'production' ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4">Identidade</h4>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome do Site</label>
                      <input type="text" value={localSiteName} onChange={e => setLocalSiteName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4">Suporte e Taxas</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                        <input type="text" value={localPhone} onChange={e => setLocalPhone(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Taxa (%)</label>
                        <input type="number" value={localPlatformFee} onChange={e => setLocalPlatformFee(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-[2.5rem] border border-emerald-100/50 dark:border-emerald-900/30">
              <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-4">
                <QrCode size={20} /> Financeiro
              </h3>
              <div className="max-w-md space-y-1.5">
                <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest ml-1">Chave PIX Global</label>
                <input type="text" value={localPixKey} onChange={e => setLocalPixKey(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/50 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'modules' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <LayoutDashboard size={20} className="text-indigo-600 dark:text-indigo-400" />
              Páginas e Módulos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pageToggles.map(f => <SettingRow key={f.id} keyName={f.id} {...f} />)}
            </div>
          </div>
        )}

        {settingActiveTab === 'security' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 mb-6">
              <ShieldAlert size={20} />
              Segurança e Acesso
            </h3>
            <div className="space-y-6">
              
              {/* 2FA Management */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                       <ShieldCheck size={18} className="text-indigo-500" /> Autenticação de Dois Fatores (2FA)
                    </h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Reforce a segurança da sua conta de administrador exigindo um código gerado pelo Google Authenticator ou similar a cada login e ações sensíveis.
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${currentUser?.twoFactorEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        Status: {currentUser?.twoFactorEnabled ? 'Ativo' : 'Inativo'}
                      </div>
                      
                      {twoFactorStep === 'status' && !currentUser?.twoFactorEnabled && (
                        <button 
                          onClick={initiate2FASetup}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                          Configurar 2FA agora
                        </button>
                      )}
                    </div>
                  </div>

                  {twoFactorStep === 'setup' && twoFactorData && (
                    <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-xl animate-scale-in">
                       <div className="flex flex-col items-center gap-4 text-center">
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Passo 1: Escaneie o QR Code</p>
                          <div className="p-4 bg-white rounded-2xl border-4 border-slate-100">
                             <img src={twoFactorData.qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400">Ou use a chave manual:</p>
                             <code className="text-sm font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">{twoFactorData.secret}</code>
                          </div>
                          <button 
                             onClick={() => setTwoFactorStep('verify')}
                             className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                          >
                             Já escaneei, próximo passo
                          </button>
                       </div>
                    </div>
                  )}

                  {twoFactorStep === 'verify' && (
                     <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 shadow-xl animate-scale-in">
                        <div className="flex flex-col gap-4">
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Passo 2: Verifique o código</p>
                           <input 
                             type="text" 
                             maxLength={6}
                             placeholder="000 000"
                             value={twoFactorCode}
                             onChange={e => setTwoFactorCode(e.target.value)}
                             className="w-full text-center text-3xl font-black tracking-widest bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 outline-none focus:ring-2 focus:ring-emerald-500/20"
                           />
                           <div className="flex gap-2">
                              <button onClick={() => setTwoFactorStep('setup')} className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase">Voltar</button>
                              <button onClick={verifyAndEnable2FA} className="flex-[2] py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Ativar 2FA</button>
                           </div>
                        </div>
                     </div>
                  )}
                </div>
              </div>

              {/* System Reset Section */}
              <div className="p-8 bg-rose-50/50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/30">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-2">
                       <h4 className="text-sm font-black text-rose-800 dark:text-rose-400 flex items-center gap-2">
                          <Trash2 size={18} /> Reset Geral de Sistema
                       </h4>
                       <p className="text-[10px] text-rose-700/60 dark:text-rose-500/60 font-medium max-w-md">
                          Esta ação apagará permanentemente TODAS as questões, usuários, simulados e transações. Seu usuário administrador será preservado. Esta ação é irreversível.
                       </p>
                    </div>
                    <button 
                       onClick={() => setIsResetModalOpen(true)}
                       className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-rose-200 dark:shadow-none"
                    >
                       Resetar Todo Conteúdo
                    </button>
                 </div>
              </div>

              {/* Reset Confirmation Modal */}
              {isResetModalOpen && createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
                     <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scale-in border border-rose-100 dark:border-rose-900/30">
                        <div className="text-center space-y-4 mb-8">
                           <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto text-rose-600">
                              <ShieldAlert size={32} />
                           </div>
                           <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Confirmação de Reset</h3>
                           <p className="text-xs text-slate-500 font-medium">Para prosseguir, você deve autenticar esta ação destrutiva.</p>
                        </div>

                        {resetError && (
                          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 animate-head-shake">
                            <XCircle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-rose-800 dark:text-rose-400">{resetError}</p>
                          </div>
                        )}

                        <div className="space-y-4">
                           {/* Tables Selection */}
                           {isFetchingTables ? (
                              <div className="flex items-center justify-center p-4">
                                <Loader2 className="animate-spin text-slate-400" />
                              </div>
                           ) : (
                              <div className="mb-4 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                                  <span>Tabelas para Limpar</span>
                                  <button onClick={() => setSelectedTables(selectedTables.size === dbTables.length ? new Set() : new Set(dbTables))} className="text-indigo-500 hover:text-indigo-600">
                                    {selectedTables.size === dbTables.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                                  </button>
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 custom-scrollbar">
                                  {dbTables.map(table => (
                                    <label key={table} className="flex items-center gap-2 cursor-pointer group">
                                      <div className={`w-3 h-3 rounded-md border flex items-center justify-center transition-colors ${selectedTables.has(table) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-600'}`}>
                                        {selectedTables.has(table) && <span className="text-[8px] font-black">✓</span>}
                                      </div>
                                      <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold font-mono group-hover:text-slate-900 truncate">{table}</span>
                                      <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={selectedTables.has(table)}
                                        onChange={() => {
                                          setSelectedTables(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(table)) newSet.delete(table);
                                            else newSet.add(table);
                                            return newSet;
                                          });
                                        }}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                           )}

                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha do Administrador</label>
                              <input 
                                 type="password" 
                                 value={resetPassword}
                                 onChange={e => setResetPassword(e.target.value)}
                                 className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/10" 
                              />
                           </div>
                           {localAppMode !== 'development' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                             <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código 2FA</label>
                                <input 
                                   type="text" 
                                   value={reset2FACode}
                                   onChange={e => setReset2FACode(e.target.value)}
                                   placeholder="000000"
                                   className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/10" 
                                />
                             </div>
                           )}
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Digite RESETAR para confirmar</label>
                              <input 
                                 type="text" 
                                 value={resetConfirmText}
                                 onChange={e => setResetConfirmText(e.target.value)}
                                 placeholder="RESETAR"
                                 className="w-full bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-100 dark:border-rose-900/20 rounded-xl py-3 px-4 text-sm font-black text-rose-600 placeholder:text-rose-200 outline-none" 
                              />
                           </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                           <button 
                             onClick={() => { setIsResetModalOpen(false); setResetError(null); }} 
                             disabled={isResetting}
                             className="flex-1 py-4 text-slate-400 font-extrabold text-[10px] uppercase disabled:opacity-50"
                           >
                             Cancelar
                           </button>
                           <button 
                              onClick={handleSystemReset}
                              disabled={resetConfirmText !== 'RESETAR' || isResetting}
                              className={`flex-[2] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${resetConfirmText === 'RESETAR' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none' : 'bg-slate-100 text-slate-300'}`}
                           >
                              {isResetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              {isResetting ? 'Resetando...' : 'Executar Reset'}
                           </button>
                        </div>
                     </div>
                  </div>,
                  document.body
               )}

              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Lock size={16} className="text-rose-500" /> Restrições de IP e Sessão
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500 font-medium">
                  <p>Configurações avançadas de Firewall e SSL são gerenciadas via Servidor (Apache/Nginx).</p>
                  <p>Log de auditoria interna disponível na aba Geral &gt; Visualizar Logs.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'integrations' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Cpu size={20} className="text-indigo-600 dark:text-indigo-400" />
              Integrações e Chaves de API
            </h3>
            <div className="space-y-8">
              {/* IA e Dados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Gemini AI Key</label>
                  <input type="password" value={localApiKey} onChange={e => setLocalApiKey(e.target.value)} placeholder="AIzaSy..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Firebase API Key</label>
                  <input type="password" value={localFirebaseKey} onChange={e => setLocalFirebaseKey(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
              </div>

              {/* reCAPTCHA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google reCAPTCHA Site Key (Frontend)</label>
                  <input type="text" value={localRecaptchaSiteKey} onChange={e => setLocalRecaptchaSiteKey(e.target.value)} placeholder="6LeI..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google reCAPTCHA Secret Key (Backend)</label>
                  <input type="password" value={localRecaptchaSecretKey} onChange={e => setLocalRecaptchaSecretKey(e.target.value)} placeholder="6LeI..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>

              {/* Pagamentos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Stripe Secret Key</label>
                  <input type="password" value={localStripeKey} onChange={e => setLocalStripeKey(e.target.value)} placeholder="sk_live_..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Mercado Pago Access Token</label>
                  <input type="password" value={localMercadoPagoKey} onChange={e => setLocalMercadoPagoKey(e.target.value)} placeholder="APP_USR-..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>

              {/* Analytics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google Analytics ID</label>
                  <input type="text" value={localGaId} onChange={e => setLocalGaId(e.target.value)} placeholder="G-XXXXXXXXXX"
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Meta Pixel ID</label>
                  <input type="text" value={localPixelId} onChange={e => setLocalPixelId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'email' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Mail size={20} className="text-indigo-600 dark:text-indigo-400" />
              Servidor de E-mail (SMTP)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Host SMTP</label>
                  <input type="text" value={localSmtpHost} onChange={e => setLocalSmtpHost(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Porta</label>
                    <input type="number" value={localSmtpPort} onChange={e => setLocalSmtpPort(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Segurança</label>
                    <select value={localSmtpSecure} onChange={e => setLocalSmtpSecure(e.target.value as 'tls' | 'ssl')}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4">
                      <option value="tls">TLS</option>
                      <option value="ssl">SSL</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Usuário / E-mail</label>
                  <input type="text" value={localSmtpUser} onChange={e => setLocalSmtpUser(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                  <input type="password" value={localSmtpPass} onChange={e => setLocalSmtpPass(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'ads' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Megaphone size={20} />
                  Gestão de Anúncios
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Configure AdSense, Facebook Ads e banners</p>
              </div>
              <button
                onClick={() => setLocalAdsEnabled(!localAdsEnabled)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${localAdsEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${localAdsEnabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">AdSense Client ID</label>
                  <input type="text" value={localAdsenseId} onChange={e => setLocalAdsenseId(e.target.value)} placeholder="ca-pub-..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Facebook Ads ID</label>
                  <input type="text" value={localFacebookAdsId} onChange={e => setLocalFacebookAdsId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banner Topo (HTML)</label>
                  <textarea value={localAdTop} onChange={e => setLocalAdTop(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] font-mono rounded-xl py-3 px-4 h-20 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banner Lateral (Sidebar)</label>
                  <textarea value={localAdSidebar} onChange={e => setLocalAdSidebar(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] font-mono rounded-xl py-3 px-4 h-20 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banner Rodapé (Bottom)</label>
                  <textarea value={localAdBottom} onChange={e => setLocalAdBottom(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] font-mono rounded-xl py-3 px-4 h-20 resize-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'performance' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Database size={20} className="text-indigo-600 dark:text-indigo-400" />
              Otimização e Cache
            </h3>
            <CacheManagement />
          </div>
        )}
      </div>
    </div>
  );
};

// Cache Management Component
const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCacheStats = async () => {
    try {
      const response = await fetch(`${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/'}cache/manage.php?action=stats`);
      const data = await response.json();
      if (data.success) {
        setCacheStats(data.data);
      } else {
        // Se API retornar erro, exibe estado vazio sem travar
        setCacheStats({ total_files: 0, valid_entries: 0, expired_entries: 0, total_size_mb: 0, enabled: true });
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas de cache:', error);
      setCacheStats({ total_files: 0, valid_entries: 0, expired_entries: 0, total_size_mb: 0, enabled: true });
    }
  };

  useEffect(() => {
    fetchCacheStats();
  }, []);

  const handleToggleCache = async () => {
    setLoading(true);
    const cacheApiBase = `${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/'}cache/manage.php`;
    try {
      const response = await fetch(`${cacheApiBase}?action=settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !cacheStats?.enabled })
      });
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchCacheStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Erro ao atualizar configurações');
    }
    setLoading(false);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Tem certeza que deseja limpar todo o cache?')) return;
    setLoading(true);
    const cacheApiBase = `${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/'}cache/manage.php`;
    try {
      const response = await fetch(`${cacheApiBase}?action=clear`);
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchCacheStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Erro ao limpar cache');
    }
    setLoading(false);
  };

  const handleCleanExpired = async () => {
    setLoading(true);
    const cacheApiBase = `${(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/'}cache/manage.php`;
    try {
      const response = await fetch(`${cacheApiBase}?action=clean`);
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchCacheStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Erro ao limpar cache expirado');
    }
    setLoading(false);
  };

  if (!cacheStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium animate-slide-up">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total de Arquivos</p>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.total_files || 0}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Entradas Válidas</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{cacheStats.valid_entries || 0}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Entradas Expiradas</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{cacheStats.expired_entries || 0}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Tamanho Total</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{cacheStats.total_size_mb || 0} MB</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enable/Disable */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">Status do Cache</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {cacheStats.enabled ? 'Cache ativo - Respostas em cache' : 'Cache desativado - Sem otimização'}
            </p>
          </div>
          <button
            onClick={handleToggleCache}
            disabled={loading}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${cacheStats.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${cacheStats.enabled ? 'right-1' : 'left-1'
                }`}
            />
          </button>
        </div>

        {/* TTL Setting */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">Tempo de Vida (TTL)</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Duração padrão do cache</p>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{cacheStats.default_ttl || 300} segundos</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCleanExpired}
          disabled={loading}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-200 dark:shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          Limpar Expirados
        </button>
        <button
          onClick={handleClearCache}
          disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 dark:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={16} />
          Limpar Todo Cache
        </button>
        <button
          onClick={fetchCacheStats}
          disabled={loading}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
          Atualizar
        </button>
      </div>
    </div>
  );
};

const AdminMarketing = ({ systemSettings, updateSystemSettings, addCoupon, deleteCoupon }: any) => {
  const { addToast } = useToast();
  const [activeSection, setActiveSection] = useState<'coupons' | 'promo' | 'themes'>('coupons');
  const [newCoupon, setNewCoupon] = useState({ code: '', discountPercentage: 10, maxUses: 100 });

  const themes: { value: AppPromotionTheme; label: string }[] = [
    { value: 'default', label: 'Padrão (Azul/Slate)' },
    { value: 'black-friday', label: 'Black Friday (Preto/Roxo)' },
    { value: 'black-november', label: 'Black November' },
    { value: 'estudante', label: 'Dia do Estudante' },
    { value: 'sao-joao', label: 'São João' },
    { value: 'carnaval', label: 'Carnaval' },
    { value: 'ano-novo', label: 'Ano Novo' },
    { value: 'pascoa', label: 'Páscoa' },
    { value: 'consumidor', label: 'Semana do Consumidor' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl w-fit border border-slate-200 dark:border-slate-800 shadow-sm transition-all overflow-hidden no-scrollbar">
        <button
          onClick={() => setActiveSection('coupons')}
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSection === 'coupons' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Percent size={14} /> Cupons de Desconto
        </button>
        <button
          onClick={() => setActiveSection('promo')}
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSection === 'promo' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Megaphone size={14} /> Campanhas
        </button>
        <button
          onClick={() => setActiveSection('themes')}
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSection === 'themes' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Palette size={14} /> Temas Visuais
        </button>
      </div>

      {activeSection === 'coupons' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-end gap-4 transition-colors">
            <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Código</label><input type="text" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-black uppercase bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 transition-colors" placeholder="EX: APROVADO20" /></div>
            <div className="w-32 space-y-1"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Desconto (%)</label><input type="number" value={newCoupon.discountPercentage} onChange={e => setNewCoupon({ ...newCoupon, discountPercentage: Number(e.target.value) })} className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 transition-colors" /></div>
            <button onClick={() => { addCoupon(newCoupon); setNewCoupon({ code: '', discountPercentage: 10, maxUses: 100 }); }} className="h-10 px-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all">Criar Cupom</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemSettings.coupons.map((coupon: any) => (
              <div key={coupon.code} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                <div><h4 className="font-black text-slate-900 dark:text-slate-100">{coupon.code}</h4><p className="text-xs text-slate-500 dark:text-slate-400">{coupon.discountPercentage}% OFF • {coupon.uses} usos</p></div>
                <button onClick={() => deleteCoupon(coupon.code)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'promo' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Megaphone size={20} className="text-indigo-600 dark:text-indigo-400" /> Campanha Ativa
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configure a campanha promocional global da plataforma.</p>
              </div>
              <button
                onClick={() => updateSystemSettings({
                  ...systemSettings,
                  activePromotion: { ...systemSettings.activePromotion, isActive: !systemSettings.activePromotion.isActive }
                })}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${systemSettings.activePromotion.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}
              >
                {systemSettings.activePromotion.isActive ? 'Ativada' : 'Desativada'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Campanha</label>
                <input
                  type="text"
                  value={systemSettings.activePromotion.name}
                  onChange={e => updateSystemSettings({
                    ...systemSettings,
                    activePromotion: { ...systemSettings.activePromotion, name: e.target.value }
                  })}
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Texto do Banner</label>
                <input
                  type="text"
                  value={systemSettings.activePromotion.bannerText}
                  onChange={e => updateSystemSettings({
                    ...systemSettings,
                    activePromotion: { ...systemSettings.activePromotion, bannerText: e.target.value }
                  })}
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl space-y-4">
              <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} /> Preview da Notificação
              </h4>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{systemSettings.activePromotion.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{systemSettings.activePromotion.bannerText}</p>
              </div>
              <button
                onClick={() => addToast("`Notificação enviada!", "error")}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
              >
                Disparar para todos os usuários
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'themes' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Palette size={20} className="text-indigo-600 dark:text-indigo-400" /> Temas Promocionais
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Personalize a identidade visual da plataforma para eventos especiais.</p>
            </div>
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
              Ativo: {systemSettings.activeTheme || 'default'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(themeConfig).map(([id, theme]) => (
              <button
                key={id}
                onClick={() => updateSystemSettings({ ...systemSettings, activeTheme: id as any })}
                className={`flex flex-col items-center gap-4 p-6 rounded-3xl border transition-all relative overflow-hidden group ${systemSettings.activeTheme === id
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800'
                  : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700 hover:scale-[1.02]'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${id === 'default' ? 'text-slate-600 bg-slate-100 dark:bg-slate-800' : id === 'black-friday' ? 'text-white bg-black dark:bg-zinc-950' : id === 'black-november' ? 'text-amber-500 bg-zinc-900' : id === 'estudante' ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/30' : id === 'sao-joao' ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' : id === 'carnaval' ? 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/30' : id === 'ano-novo' ? 'text-amber-500 bg-indigo-950' : id === 'pascoa' ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30' : 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'}`}>
                  <theme.icon size={32} />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    {id === 'default' ? 'Padrão (Modern)' : id === 'black-friday' ? 'Black Friday' : id === 'black-november' ? 'Black November' : id === 'estudante' ? 'Dia do Estudante' : id === 'sao-joao' ? 'São João' : id === 'carnaval' ? 'Carnaval' : id === 'ano-novo' ? 'Ano Novo' : id === 'pascoa' ? 'Páscoa' : 'Semana do Consumidor'}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{id}</p>
                </div>
                {systemSettings.activeTheme === id && (
                  <div className="absolute top-4 right-4 text-indigo-600">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl flex items-start gap-4">
            <div className="p-2 bg-white dark:bg-amber-900/50 rounded-xl text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase">Impacto Visual Global</h4>
              <p className="text-xs text-amber-700 dark:text-amber-500/80 font-medium leading-relaxed mt-1">
                A alteração do tema impacta imediatamente a Landing Page e elementos decorativos em toda a plataforma (banners, badges e destaques). O sistema de cores light/dark continua funcionando de forma complementar ao tema selecionado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminFinance = ({ systemSettings, updateSystemSettings, allTransactions, allUsers, initialSection = 'balance', addCoupon, deleteCoupon }: any) => {
  const { addToast } = useToast();
  const loadTransactions = () => { /* Stub to satisfy compiler, data comes from props */ };
  const [activeSection, setActiveSection] = useState<'balance' | 'transactions' | 'refunds' | 'prices' | 'marketing' | 'automation'>(initialSection as any);
  const [financeFilters, setFinanceFilters] = useState({ search: '', status: 'all', dateRange: 'all' });
  const [statusOptions] = useState(['completed', 'pending', 'scheduled', 'refunded', 'refund_requested']);
  const [currentPage, setCurrentPage] = useState(1);
  const refundRequests = useMemo(() => allTransactions?.filter((t: any) => t.status === 'refund_requested') || [], [allTransactions]);

  const totalInDispute = useMemo(() => refundRequests.reduce((acc: number, t: any) => acc + t.amount, 0), [refundRequests]);
  const totalRefunded = useMemo(() => allTransactions?.filter((t: any) => t.status === 'refunded').reduce((acc: number, t: any) => acc + t.amount, 0) || 0, [allTransactions]);

  // --- NOVOS CALCULOS POR VENDEDOR ---
  const [sellersMetrics, setSellersMetrics] = useState<any[]>([]);
  const [viewingSellerDetails, setViewingSellerDetails] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'available_desc' | 'available_asc' | 'date_asc' | 'date_desc'>('available_desc');

  useEffect(() => {
    if (!allTransactions || !allUsers) return;

    const metricsBySeller: Record<string, any> = {};
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. Identificar todos os vendedores que têm transações
    allTransactions.forEach((t: any) => {
      if (!metricsBySeller[t.sellerId]) {
        const seller = allUsers.find((u: any) => u.id === t.sellerId);
        metricsBySeller[t.sellerId] = {
          id: t.sellerId,
          name: seller?.name || 'Desconhecido',
          email: seller?.email || '-',
          paymentDay: seller?.billing?.paymentDay || Math.floor(Math.random() * 28) + 1, // Mock se não existir
          totalSales: 0,
          heldBalance: 0,
          availablePayout: 0,
          transactions: []
        };
      }

      if (t.status === 'completed') {
        const sellerShare = t.amount * 0.80;
        metricsBySeller[t.sellerId].totalSales += t.amount;
        metricsBySeller[t.sellerId].transactions.push(t);

        const isHeld = (now - t.timestamp) < SEVEN_DAYS_MS;
        if (isHeld) {
          metricsBySeller[t.sellerId].heldBalance += sellerShare;
        } else {
          metricsBySeller[t.sellerId].availablePayout += sellerShare;
        }
      }
    });

    const metricsArray = Object.values(metricsBySeller);
    setSellersMetrics(metricsArray);
  }, [allTransactions, allUsers]);

  const sortedSellers = useMemo(() => {
    return [...sellersMetrics].sort((a, b) => {
      if (sortBy === 'available_desc') return b.availablePayout - a.availablePayout;
      if (sortBy === 'available_asc') return a.availablePayout - b.availablePayout;
      if (sortBy === 'date_asc') return a.paymentDay - b.paymentDay;
      if (sortBy === 'date_desc') return b.paymentDay - a.paymentDay;
      return 0;
    });
  }, [sellersMetrics, sortBy]);

  // --- HANDLERS EXISTENTES ---
  const handleDescriptionChange = (plan: string, description: string) => {
    const updatedPricing = { ...systemSettings.pricing };
    const planConfig = updatedPricing[plan];
    planConfig.description = description;
    updateSystemSettings({ ...systemSettings, pricing: updatedPricing });
  };

  const handlePriceChange = (plan: string, monthlyValue: number) => {
    const updatedPricing = { ...systemSettings.pricing };
    const planConfig = updatedPricing[plan];
    planConfig.monthly = monthlyValue;
    const qDesc = planConfig.quarterlyDiscountPercent || 10;
    const aDesc = planConfig.annualDiscountPercent || 30;
    planConfig.quarterly = (monthlyValue * 3) * (1 - qDesc / 100);
    planConfig.annual = (monthlyValue * 12) * (1 - aDesc / 100);
    updateSystemSettings({ ...systemSettings, pricing: updatedPricing });
  };

  const handleDiscountPercentChange = (plan: string, type: 'quarterly' | 'annual', percent: number) => {
    const updatedPricing = { ...systemSettings.pricing };
    const planConfig = updatedPricing[plan];
    if (type === 'quarterly') planConfig.quarterlyDiscountPercent = percent;
    else planConfig.annualDiscountPercent = percent;
    planConfig.quarterly = (planConfig.monthly * 3) * (1 - (planConfig.quarterlyDiscountPercent || 0) / 100);
    planConfig.annual = (planConfig.monthly * 12) * (1 - (planConfig.annualDiscountPercent || 0) / 100);
    updateSystemSettings({ ...systemSettings, pricing: updatedPricing });
  };

  const handleTogglePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;
    const planIndex = plans.indexOf(plan as any);
    const newValue = !updatedPlanDetails[plan as keyof typeof updatedPlanDetails].features[featureIndex].included;

    plans.forEach((p, i) => {
      // If turning ON: also turn ON for all planes above
      if (newValue && i >= planIndex) {
        updatedPlanDetails[p] = {
          ...updatedPlanDetails[p],
          features: updatedPlanDetails[p].features.map((f: any, fi: number) =>
            fi === featureIndex ? { ...f, included: true } : f
          )
        };
      }
      // If turning OFF: also turn OFF for all planes below
      if (!newValue && i <= planIndex) {
        updatedPlanDetails[p] = {
          ...updatedPlanDetails[p],
          features: updatedPlanDetails[p].features.map((f: any, fi: number) =>
            fi === featureIndex ? { ...f, included: false } : f
          )
        };
      }
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleUpdatePlanFeatureText = (plan: string, featureIndex: number, text: string) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

    plans.forEach(p => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: updatedPlanDetails[p].features.map((f: any, i: number) =>
          i === featureIndex ? { ...f, text } : f
        )
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleAddPlanFeature = (plan: string) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;
    const planIndex = plans.indexOf(plan as any);
    const featureName = 'Novo Recurso';

    plans.forEach((p, i) => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: [...updatedPlanDetails[p].features, { text: featureName, included: i >= planIndex }]
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleRemovePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

    plans.forEach(p => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: updatedPlanDetails[p].features.filter((_: any, i: number) => i !== featureIndex)
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleMovePlanFeature = (direction: 'up' | 'down', featureIndex: number) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

    const firstPlan = plans[0];
    const features = [...updatedPlanDetails[firstPlan].features];

    if (direction === 'up' && featureIndex > 0) {
      [features[featureIndex], features[featureIndex - 1]] = [features[featureIndex - 1], features[featureIndex]];
    } else if (direction === 'down' && featureIndex < features.length - 1) {
      [features[featureIndex], features[featureIndex + 1]] = [features[featureIndex + 1], features[featureIndex]];
    } else {
      return;
    }

    // Apply the new order to ALL plans
    plans.forEach(p => {
      // Re-map features to maintain 'included' state for each plan
      const currentPlanFeatures = updatedPlanDetails[p].features;
      const newPlanFeatures = features.map(f => {
        // Find the matching feature in the current plan to get its 'included' status
        const originalFeature = currentPlanFeatures.find((orig: any) => orig.text === f.text);
        return {
          text: f.text,
          included: originalFeature ? originalFeature.included : f.included
        };
      });

      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: newPlanFeatures
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  // --- REEMBOLSOS ---
  const { resolveRefund } = useMarketplace();
  const handleResolveRefund = (transactionId: string, resolution: 'approved' | 'rejected') => {
    if (window.confirm(`Tem certeza que deseja ${resolution === 'approved' ? 'APROVAR' : 'REJEITAR'} este reembolso?`)) {
      resolveRefund(transactionId, resolution);
    }
  };

  const selectedSeller = viewingSellerDetails ? sellersMetrics.find(s => s.id === viewingSellerDetails) : null;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl w-fit border border-slate-200 dark:border-slate-800 shadow-sm transition-all overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSection('balance')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'balance' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><Users size={14} /> Vendedores</div>
        </button>
        <button
          onClick={() => setActiveSection('refunds')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'refunds' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><ShieldAlert size={14} /> Reembolsos {refundRequests.length > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{refundRequests.length}</span>}</div>
        </button>
        <button
          onClick={() => setActiveSection('transactions')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'transactions' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><FileText size={14} /> Transações</div>
        </button>
        <button
          onClick={() => setActiveSection('prices')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'prices' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><Tag size={14} /> Preços & Planos</div>
        </button>
        <button
          onClick={() => setActiveSection('marketing')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'marketing' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><Megaphone size={14} /> Marketing</div>
        </button>
        <button
          onClick={() => setActiveSection('automation')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'automation' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><Terminal size={14} /> Automação</div>
        </button>
      </div>



      {activeSection === 'balance' && (
        <div className="space-y-6 animate-fade-in">
          {/* LISTA DE REPASSES A VENDEDORES - Agora foco principal da aba "Vendedores" */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><Users size={20} className="text-indigo-500" /> Repasses a Vendedores</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="available_desc">Maior Valor a Repassar</option>
                  <option value="available_asc">Menor Valor a Repassar</option>
                  <option value="date_asc">Data Próxima</option>
                  <option value="date_desc">Data Distante</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-6 pl-8">Vendedor</th>
                    <th className="p-6 text-right">Saldo Preso</th>
                    <th className="p-6 text-right">Disponível</th>
                    <th className="p-6 text-center">Dia Pagamento</th>
                    <th className="p-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {sortedSellers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhum vendedor com saldo encontrado.</td></tr>
                  ) : (
                    sortedSellers.map((seller: any) => (
                      <tr key={seller.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="p-6 pl-8">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{seller.name}</div>
                          <div className="text-[10px] text-slate-400">{seller.email}</div>
                        </td>
                        <td className="p-6 text-right font-medium text-amber-600 dark:text-amber-500">
                          R$ {seller.heldBalance.toFixed(2)}
                        </td>
                        <td className="p-6 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          R$ {seller.availablePayout.toFixed(2)}
                        </td>
                        <td className="p-6 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            <Calendar size={12} /> Dia {seller.paymentDay}
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <button
                            onClick={() => setViewingSellerDetails(seller.id)}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 transition-all shadow-sm"
                          >
                            Ver Extrato Detalhado
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO VENDEDOR */}
      {viewingSellerDetails && selectedSeller && createPortal(
        <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-t-[2.4rem] border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded mb-2 block w-fit">Extrato do Vendedor</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{selectedSeller.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedSeller.email}</p>
              </div>
              <button onClick={() => setViewingSellerDetails(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-400"><X size={24} /></button>
            </div>
            <div className="p-8 grid grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-800">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">Disponível para Saque</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">R$ {selectedSeller.availablePayout.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-1">Saldo Preso</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {selectedSeller.heldBalance.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">Próximo Pagamento</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-200">Dia {selectedSeller.paymentDay}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-6">Data</th>
                    <th className="p-6">Protocolo</th>
                    <th className="p-6">Material</th>
                    <th className="p-6 text-right">Valor Venda</th>
                    <th className="p-6 text-right">Parte Vendedor (80%)</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedSeller.transactions.map((t: any) => {
                    const isHeld = (Date.now() - t.timestamp) < (7 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-6">{new Date(t.timestamp).toLocaleDateString()} <span className="text-[10px] text-slate-400 block">{new Date(t.timestamp).toLocaleTimeString()}</span></td>
                        <td className="p-6 font-mono text-[10px] text-slate-500">{t.id.substring(0, 12).toUpperCase()}...</td>
                        <td className="p-6 font-bold text-slate-800 dark:text-slate-200">{t.materialTitle}</td>
                        <td className="p-6 text-right">R$ {t.amount.toFixed(2)}</td>
                        <td className="p-6 text-right font-bold text-slate-900 dark:text-slate-100">R$ {(t.amount * 0.80).toFixed(2)}</td>
                        <td className="p-6 text-center">
                          {t.status === 'refunded' ? (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700">Reembolsado</span>
                          ) : isHeld ? (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded text-[10px] font-black uppercase">Preso (7d)</span>
                          ) : (
                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase">Liberado</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button onClick={() => setViewingSellerDetails(null)} className="px-8 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeSection === 'refunds' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30">
              <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Em Disputa (Solicitados)</p>
              <h3 className="text-2xl font-black text-red-700 dark:text-red-300">R$ {totalInDispute.toFixed(2)}</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Devolvido</p>
              <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300">R$ {totalRefunded.toFixed(2)}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-500" /> Solicitações Pendentes
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-6 pl-8">Comprador</th>
                  <th className="p-6">Material / Produto</th>
                  <th className="p-6">Motivo</th>
                  <th className="p-6 text-right">Valor</th>
                  <th className="p-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {refundRequests.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma solicitação de reembolso pendente.</td></tr>
                ) : (
                  refundRequests.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-6 pl-8 font-bold">{t.buyerName}</td>
                      <td className="p-6">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{t.materialTitle || 'Plano de Assinatura'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{String(t.id).substring(0, 8)}...</div>
                      </td>
                      <td className="p-6">
                        <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded text-[10px] font-bold">
                          {t.refundReason || 'Não informado'}
                        </span>
                      </td>
                      <td className="p-6 text-right font-black">R$ {t.amount.toFixed(2)}</td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleResolveRefund(t.id, 'approved')}
                            className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                            title="Aprovar Devolução"
                          >
                            <Check size={16} strokeWidth={3} />
                          </button>
                          <button
                            onClick={() => handleResolveRefund(t.id, 'rejected')}
                            className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                            title="Rejeitar (Manter Venda)"
                          >
                            <X size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'transactions' && (() => {
        // --- LOGICA DE FILTRO E PAGINAÇÃO LOCAL PARA TRANSAÇÕES ---
        const getFilteredTransactions = () => {
          if (!allTransactions) return [];
          return allTransactions.filter((t: any) => {
            // Filter by search
            if (financeFilters.search) {
              const searchLower = financeFilters.search.toLowerCase();
              const amountStr = t.amount.toString();
              const idStr = t.id.toString().toLowerCase();
              const buyer = allUsers.find((u: any) => u.id === t.buyerId);
              const seller = allUsers.find((u: any) => u.id === t.sellerId);
              const buyerName = buyer?.name?.toLowerCase() || '';
              const sellerName = seller?.name?.toLowerCase() || '';
              const materialTitle = t.materialTitle?.toLowerCase() || '';

              if (!idStr.includes(searchLower) &&
                !amountStr.includes(searchLower) &&
                !buyerName.includes(searchLower) &&
                !sellerName.includes(searchLower) &&
                !materialTitle.includes(searchLower)) {
                return false;
              }
            }

            // Filter by status
            if (financeFilters.status !== 'all' && t.status !== financeFilters.status) {
              return false;
            }

            // Filter by date
            if (financeFilters.dateRange !== 'all') {
              const now = new Date();
              const tDate = new Date(t.timestamp);
              if (financeFilters.dateRange === 'today') {
                if (tDate.getDate() !== now.getDate() || tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return false;
              } else if (financeFilters.dateRange === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (tDate < oneWeekAgo) return false;
              } else if (financeFilters.dateRange === 'month') {
                const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                if (tDate < oneMonthAgo) return false;
              }
            }

            return true;
          });
        };

        const filteredTransactions = getFilteredTransactions();
        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
        const currentTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

        const financeStats = filteredTransactions.reduce((acc: any, t: any) => {
          if (t.status === 'completed' || t.status === 'approved') {
            acc.totalRevenue += t.amount;
            acc.totalFees += t.amount * 0.20;
            acc.netRevenue += t.amount * 0.80;
          }
          return acc;
        }, { totalRevenue: 0, totalFees: 0, netRevenue: 0 });

        return (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
              {/* Toolbar */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar transação..."
                      value={financeFilters.search}
                      onChange={e => { setFinanceFilters({ ...financeFilters, search: e.target.value }); setCurrentPage(1); }}
                      className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold w-64 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <select
                    value={financeFilters.status}
                    onChange={e => { setFinanceFilters({ ...financeFilters, status: e.target.value }); setCurrentPage(1); }}
                    className="py-2 pl-3 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 capitalize"
                  >
                    <option value="all">Todos os Status</option>
                    {statusOptions.map((status: any) => (
                      <option key={status} value={status}>
                        {status === 'completed' ? 'Concluído' :
                         status === 'refunded' ? 'Reembolsado' :
                         status === 'scheduled' ? 'pre-aprovado' :
                         status === 'pending' ? 'Pendente' :
                         status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={financeFilters.dateRange}
                    onChange={e => { setFinanceFilters({ ...financeFilters, dateRange: e.target.value }); setCurrentPage(1); }}
                    className="py-2 pl-3 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">Todo o Período</option>
                    <option value="today">Hoje</option>
                    <option value="week">Últimos 7 dias</option>
                    <option value="month">Último Mês</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Pág {currentPage} de {totalPages || 1}</span>
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronRight size={16} /></button>
                </div>
              </div>

              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-4">ID</th>
                      <th className="p-4">Data</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Ref. Externa</th>
                      <th className="p-4">Método</th>
                      <th className="p-4">Material / Plano</th>
                      <th className="p-4">Comprador</th>
                      <th className="p-4">Vendedor</th>
                      <th className="p-4 text-right">Valor</th>
                      <th className="p-4 text-right">Taxa (Admin)</th>
                      <th className="p-4 text-right">Líquido</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300 divide-y divide-slate-50 dark:divide-slate-800">
                    {currentTransactions.length === 0 ? (
                      <tr><td colSpan={12} className="p-12 text-center text-slate-400 dark:text-slate-600 italic">Nenhuma transação encontrada.</td></tr>
                    ) : (
                      currentTransactions.map((t: any) => {
                        const isHeld = (Date.now() - t.timestamp) < (7 * 24 * 60 * 60 * 1000);
                        const adminFee = t.amount * 0.20;
                        const netAmount = t.amount - adminFee;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 font-mono text-[10px] text-slate-400 selected-none">{String(t.id).substring(0, 8).toUpperCase()}</td>
                            <td className="p-4">
                              <div className="font-bold">{new Date(t.timestamp).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400">{new Date(t.timestamp).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${t.type === 'plan' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {t.type === 'plan' ? 'Assinatura' : 'Material'}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-[10px] text-slate-500 truncate max-w-[100px]" title={t.externalId}>
                              {t.externalId || '-'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5" title={t.paymentMethod || 'Não informado'}>
                                {(!t.paymentMethod || t.paymentMethod === 'credit_card') && <CreditCard size={14} className="text-indigo-500" />}
                                {t.paymentMethod === 'pix' && <QrCode size={14} className="text-emerald-500" />}
                                {t.paymentMethod === 'boleto' && <FileText size={14} className="text-amber-500" />}
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                  {t.paymentMethod === 'credit_card' ? 'Cartão' : t.paymentMethod === 'pix' ? 'Pix' : t.paymentMethod === 'boleto' ? 'Boleto' : 'Cartão'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold truncate max-w-[200px]" title={t.materialTitle}>{t.materialTitle || 'Plano de Assinatura'}</div>
                              <div className="text-[10px] text-slate-400">ID: {t.materialId || '-'}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold">{t.buyerName}</div>
                              <div className="text-[10px] text-slate-400">{t.buyerEmail}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold">{t.sellerName}</div>
                              <div className="text-[10px] text-slate-400">{t.sellerEmail}</div>
                            </td>
                            <td className="p-4 text-right font-black">R$ {t.amount.toFixed(2)}</td>
                            <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">+ R$ {adminFee.toFixed(2)}</td>
                            <td className="p-4 text-right text-blue-600 dark:text-blue-400 font-bold">R$ {netAmount.toFixed(2)}</td>
                            <td className="p-4 text-center">
                               {t.status === 'completed' || t.status === 'approved' ? (
                                 <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase">Concluído</span>
                               ) : t.status === 'scheduled' ? (
                                 <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded text-[10px] font-black uppercase border border-indigo-200 dark:border-indigo-800">pre-aprovado</span>
                               ) : t.status === 'refunded' ? (
                                 <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase">Reembolsado</span>
                               ) : t.status === 'refund_requested' ? (
                                 <div className="flex flex-col items-center gap-1">
                                   <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><AlertCircle size={10} /> Disputa</span>
                                   <button
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       if (window.confirm('Aprovar estorno e cancelar assinatura/venda?')) {
                                         try {
                                           const res = await api.post('transactions/approve_refund.php', { transaction_id: t.id });
                                           if ((res as any).success) {
                                             addToast('Estorno aprovado com sucesso.', 'success');
                                             loadTransactions();
                                           }
                                         } catch (err) {
                                           console.error(err);
                                           addToast('Erro ao aprovar estorno.', 'error');
                                         }
                                       }
                                     }}
                                     className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
                                   >
                                     Aprovar
                                   </button>
                                   <button
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       if (window.confirm('Rejeitar estorno?')) {
                                         try {
                                           const res = await api.post('transactions/reject_refund.php', { transaction_id: t.id });
                                           if ((res as any).success) {
                                             addToast('Estorno rejeitado.', 'info');
                                             loadTransactions();
                                           }
                                         } catch (err) {
                                           console.error(err);
                                           addToast('Erro ao rejeitar estorno.', 'error');
                                         }
                                       }
                                     }}
                                     className="text-[9px] font-black uppercase text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
                                   >
                                     Rejeitar
                                   </button>
                                 </div>
                               ) : t.status === 'pending' ? (
                                 <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded text-[10px] font-black uppercase">Pendente</span>
                               ) : isHeld ? (
                                 <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center justify-center gap-1"><Lock size={10} /> Preso</span>
                               ) : (
                                 <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center justify-center gap-1"><Check size={10} /> Liberado</span>
                               )}
                             </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-xs sticky bottom-0 shadow-lg z-10">
                    <tr className="bg-gradient-to-r from-slate-100 to-white dark:from-slate-900 dark:to-slate-800">
                      <td colSpan={8} className="p-4 text-right uppercase tracking-widest text-slate-500 dark:text-slate-400 font-black border-r border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-end gap-2">
                          <TrendingUp size={16} className="text-indigo-500" />
                          Totais da Visualização:
                        </div>
                      </td>
                      <td className="p-4 text-right bg-indigo-50/50 dark:bg-indigo-900/10 border-r border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 font-medium uppercase">Bruto</span>
                          <span className="text-slate-900 dark:text-slate-100 font-black text-sm">R$ {financeStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right bg-emerald-50/50 dark:bg-emerald-900/10 border-r border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-emerald-600/70 font-medium uppercase">Taxas</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">R$ {financeStats.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right bg-blue-50/50 dark:bg-blue-900/10 border-r border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-blue-600/70 font-medium uppercase">Líquido</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black text-sm">R$ {financeStats.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Pagination Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Mostrando {currentTransactions.length} de {filteredTransactions.length} registros
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700">Anterior</button>
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700">Próximo</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {activeSection === 'prices' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
          <div className="mb-8 border-b border-slate-100 dark:border-slate-800/50 pb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">Configuração de Planos</h3>
            <p className="text-sm text-slate-500 font-medium">Defina os valores base e descontos cumulativos para cada nível de assinatura.</p>
          </div>
          <div className="flex justify-end mb-6">
            <button
              onClick={() => {
                updateSystemSettings(systemSettings);
                apiClient.post('settings.php', systemSettings)
                  .then((res: any) => {
                    const data = res.data || res;
                    if (data.success) {
                      addToast('Planos salvos com sucesso!', 'success');
                    } else {
                      addToast('Erro ao salvar: ' + (data.error || 'Erro desconhecido'), 'error');
                    }
                  })
                  .catch(err => console.error(err));
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
            >
              <Save size={16} /> Salvar Planos
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {Object.entries(systemSettings.pricing).map(([plan, config]: any) => (
              <div key={plan} className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{plan}</h4>
                  <span className="text-[10px] font-black bg-white dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm text-slate-400 uppercase">Valores em Reais</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Comercial</label>
                    <input
                      type="text"
                      value={config.description || ''}
                      onChange={e => handleDescriptionChange(plan, e.target.value)}
                      placeholder="Descrição breve do plano para atrair usuários..."
                      className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Mensal (Base)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        value={config.monthly}
                        onChange={e => handlePriceChange(plan, Number(e.target.value))}
                        className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all text-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desconto Trimestral</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={config.quarterlyDiscountPercent || 0}
                          onChange={e => handleDiscountPercentChange(plan, 'quarterly', Number(e.target.value))}
                          className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desconto Anual</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={config.annualDiscountPercent || 0}
                          onChange={e => handleDiscountPercentChange(plan, 'annual', Number(e.target.value))}
                          className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Trimestral</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.quarterly.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">≈ R$ {(config.quarterly / 3).toFixed(2)}/mês</p>
                      <p className="text-[9px] text-emerald-500 font-bold">Economia de R$ {(config.monthly * 3 - config.quarterly).toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Anual</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.annual.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">≈ R$ {(config.annual / 12).toFixed(2)}/mês</p>
                      <p className="text-[9px] text-indigo-500 font-bold">Economia de R$ {(config.monthly * 12 - config.annual).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Recursos do Plano</p>
                    {systemSettings.planDetails[plan].features.map((feature: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 group/feature">
                        <button
                          onClick={() => handleTogglePlanFeature(plan, idx)}
                          className={`p-1 rounded-md transition-colors ${feature.included ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-300 bg-slate-50 dark:bg-slate-800'}`}
                        >
                          {feature.included ? <Check size={12} /> : <X size={12} />}
                        </button>
                        <input
                          type="text"
                          value={feature.text}
                          onChange={(e) => handleUpdatePlanFeatureText(plan, idx, e.target.value)}
                          className="flex-1 bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:text-indigo-600 transition-colors"
                        />
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/feature:opacity-100 transition-all">
                          <button
                            onClick={() => handleMovePlanFeature('up', idx)}
                            disabled={idx === 0}
                            className="p-1 text-slate-300 hover:text-indigo-500 disabled:opacity-30"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMovePlanFeature('down', idx)}
                            disabled={idx === systemSettings.planDetails[plan].features.length - 1}
                            className="p-1 text-slate-300 hover:text-indigo-500 disabled:opacity-30"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button
                            onClick={() => handleRemovePlanFeature(plan, idx)}
                            className="p-1 text-slate-300 hover:text-red-500"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddPlanFeature(plan)}
                      className="w-full py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all flex items-center justify-center gap-1 mt-2"
                    >
                      <Plus size={12} /> Adicionar Recurso
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeSection === 'marketing' && (
        <AdminMarketing
          systemSettings={systemSettings}
          updateSystemSettings={updateSystemSettings}
          addCoupon={addCoupon}
          deleteCoupon={deleteCoupon}
        />
      )}

      {activeSection === 'automation' && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in transition-colors duration-300">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Terminal size={20} className="text-indigo-600 dark:text-indigo-400" /> Automação de Cobrança (Subscription API)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">O sistema utiliza a <strong>Mercado Pago Subscription API</strong> (Nativa) para gerenciar cobranças recorrentes automaticamente.</p>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Opção Windows */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Database size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Windows (XAMPP)</h4>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal pl-4 font-bold uppercase tracking-tight">
                  <li>Baixe o script .bat de automação.</li>
                  <li>Abra o "Agendador de Tarefas" do Windows.</li>
                  <li>Crie uma tarefa para rodar este arquivo .bat diariamente.</li>
                </ul>
                <button 
                  onClick={() => window.open((api as any).defaults.baseURL + '/subscriptions/automation_helper.php?action=download_bat')}
                  className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Baixar Script .bat
                </button>
              </div>

              {/* Opção Linux */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Globe size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Linux / cPanel</h4>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Adicione o comando abaixo no seu painel de "Cron Jobs" para rodar a cada 1 hora ou diariamente:
                </p>
                <div className="p-3 bg-slate-900 rounded-xl font-mono text-[10px] text-emerald-400 break-all border border-emerald-900/30">
                  0 * * * * curl -s "{(api as any).defaults.baseURL}/subscriptions/cron_recurring.php?key=SECURE_CRON_KEY_123"
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`0 * * * * curl -s "${(api as any).defaults.baseURL}/subscriptions/cron_recurring.php?key=SECURE_CRON_KEY_123"`);
                    addToast('Comando copiado!', 'success');
                  }}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={14} /> Copiar Comando
                </button>
              </div>
            </div>

            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-indigo-500 mt-1" size={18} />
                <div>
                  <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest">Integração Nativa Ativa</h4>
                  <p className="text-xs text-indigo-800/70 dark:text-indigo-400/70 font-medium leading-relaxed mt-1">
                    As cobranças agendadas e retentativas de pagamento são gerenciadas diretamente pelos servidores do Mercado Pago. Os Webhooks integrados garantem que os períodos de acesso dos alunos sejam renovados automaticamente após cada pagamento aprovado.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center flex-col items-center gap-4 py-8 border-t border-slate-100 dark:border-slate-800">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso Direto ao Script (Teste)</p>
               <a 
                 href={`${(api as any).defaults.baseURL}/subscriptions/cron_recurring.php?key=SECURE_CRON_KEY_123`}
                 target="_blank"
                 className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none hover:scale-105 transition-all flex items-center gap-2"
               >
                 <Zap size={14} /> Executar Cron Manualmente Agora
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose combined characters into their base characters and diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
};

const AdminDatabaseManager = ({
  questions, allUsers, allMaterials, allReports, allTransactions, rankings = [],
  onDeleteQuestion, onAddQuestion, onAddQuestions, onUpdateQuestion, resolveReport,
  updateUserStatus, moderateMaterial, onDeleteMaterial, systemSettings, updateSystemSettings, updateRanking,
  initialTab = 'questions'
}: any) => {
  const { dispatch } = useData();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [activeSubTab, setActiveSubTab] = useState<'questions' | 'users' | 'materials' | 'rankings' | 'import' | 'reports' | 'blocked' | 'filters'>(initialTab as any);
  const [pagination, setPagination] = useState({ total: 0, perPage: 20, pages: 1, page: 1 });

  // Filter Management State
  const [activeFilterType, setActiveFilterType] = useState<string>('all');
  const [filterInput, setFilterInput] = useState('');
  const [filterSlug, setFilterSlug] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterWebsite, setFilterWebsite] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [editingFilterItem, setEditingFilterItem] = useState<{ id?: number; item: any; originalName: string; type?: string } | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);

  const filterTypes = [
    { key: 'all', label: 'Todos os Tipos' },
    { key: 'banca', label: 'Bancas' },
    { key: 'orgao', label: 'Órgãos' },
    { key: 'cargo', label: 'Cargos' },
    { key: 'assunto', label: 'Assuntos (Matérias/Tópicos)', hierarchical: true },
    { key: 'ano', label: 'Anos' },
    { key: 'carreira', label: 'Carreiras' },
    { key: 'area', label: 'Áreas' }
  ];

  const fetchFilters = async () => {
    try {
      const res = await api.get<any>(ENDPOINTS.filters.list) as any;
      if (res.success && res.data) {
        const data = res.data;
        const taxonomies = {
          agencies: data.bancas?.map((b: any) => ({ id: b.id, name: b.nome || b.name, sigla: b.sigla, slug: b.slug, description: b.description, website: b.website, type: 'agency' })) || [],
          organizations: data.orgaos?.map((o: any) => ({ id: o.id, name: o.nome || o.name, sigla: o.sigla, slug: o.slug, description: o.description, website: o.website, type: 'organization' })) || [],
          subjects: data.assuntos?.filter((a: any) => a.materia).map((a: any) => ({ id: a.id, name: a.nome || a.name, slug: a.slug, description: a.description, website: a.website, materia: true, type: 'subject' })) || [],
          topics: data.assuntos?.filter((a: any) => !a.materia).map((a: any) => ({ id: a.id, name: a.nome || a.name, slug: a.slug, description: a.description, website: a.website, parentId: a.pai || a.parent_id, materia: false, type: 'topic' })) || [],
          roles: data.cargos?.map((c: any) => ({ id: c.id, name: c.descricao || c.name, slug: c.slug, description: c.description, website: c.website, parentId: c.pai || c.parent_id, type: 'role' })) || [],
          careers: data.carreiras?.map((c: any) => ({ id: c.id, name: c.nome || c.name, slug: c.slug, description: c.description, website: c.website, type: 'career' })) || [],
          years: data.anos?.map(String) || [],
          modalities: ['Múltipla Escolha', 'Certo/Errado']
        };
        dispatch({ type: 'SET_TAXONOMIES', payload: taxonomies });
      } else if (res && Array.isArray(res)) {
        // Fallback if the response is just an array (some endpoints do this)
        // But our filters/list.php returns {success:true, data:...}
      }
    } catch (e) { console.error('Error fetching filters:', e); }
  };

  const handleSaveFilter = async () => {
    if (!filterInput.trim()) return;
    try {
      const typeToSave = editingFilterItem?.type || activeFilterType;
      if (typeToSave === 'all') {
        addToast('Selecione um tipo de filtro específico no modal.', 'error');
        return;
      }

      const res = await api.post<any>(ENDPOINTS.filters.save, {
        id: editingFilterItem?.id,
        type: typeToSave,
        name: filterInput.trim(),
        slug: filterSlug,
        description: filterDescription,
        website: filterWebsite,
        parent_id: selectedParentId,
        metadata: editingFilterItem?.item?.metadata || {}
      }) as any;

      if (res.success) {
        setFilterInput('');
        setFilterSlug('');
        setFilterDescription('');
        setFilterWebsite('');
        setEditingFilterItem(null);
        setSelectedParentId(null);
        setShowTaxonomyModal(false);
        fetchFilters();
        addToast(editingFilterItem ? 'Item atualizado!' : 'Item adicionado!', 'success');
      } else {
        addToast(res.message || 'Erro ao salvar filtro', 'error');
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Erro ao salvar filtro';
      addToast(msg, 'error');
    }
  };

  const handleSaveRanking = async () => {
    if (!editingRanking) return;
    try {
      const res = await api.post<any>(ENDPOINTS.rankings.create, editingRanking) as any;
      if (res && res.success) {
        updateRanking(editingRanking);
        setEditingRanking(null);
        addToast("Ranking atualizado com sucesso!", "success");
      }
    } catch (e) {
      console.error(e);
      addToast("Erro ao salvar ranking", "error");
    }
  };

  const handleDeleteFilter = async (id: number) => {
    if (!confirm('Tem certeza?')) return;
    try {
      const res = await api.get<any>(ENDPOINTS.filters.delete, { params: { id: id.toString() } }) as any;
      if (res && res.success) fetchFilters();
    } catch (e) { addToast('Erro ao deletar filtro', 'success'); }
  };

  const startEditingFilter = (item: any) => {
    setFilterInput(item.name);
    setFilterSlug(item.slug || slugify(item.name));
    setFilterDescription(item.description || '');
    setFilterWebsite(item.website || '');
    setEditingFilterItem({ id: item.id, item, originalName: item.name, type: item.type });
    setSelectedParentId(item.parent_id || item.parentId);
    setShowTaxonomyModal(true);
  };

  const cancelEditingFilter = () => {
    setFilterInput('');
    setFilterSlug('');
    setFilterDescription('');
    setFilterWebsite('');
    setEditingFilterItem(null);
    setSelectedParentId(null);
    setShowTaxonomyModal(false);
  };

  // Real-time slug generation
  useEffect(() => {
    if (showTaxonomyModal && !editingFilterItem) {
      setFilterSlug(slugify(filterInput));
    }
  }, [filterInput, showTaxonomyModal, editingFilterItem]);

  // Material Moderation State
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationEvidence, setModerationEvidence] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [editingRanking, setEditingRanking] = useState<any | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Detailed User Management State
  const [detailedUser, setDetailedUser] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'subscription' | 'transactions' | 'comments'>('overview');


  const [actionLoading, setActionLoading] = useState(false);

  // Edit User State
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', cpf: '', phone: '', targetExam: '' });


  useEffect(() => {
    if (viewingProfileId) {
      setIsEditingUser(false);
      setIsLoadingDetail(true);
      apiClient.get(`${ENDPOINTS.admin.userDetails}?id=${viewingProfileId}`)

        .then((response: any) => {
          if (response.success) {
            setDetailedUser(response.data);
          } else {
            addToast(response.message || "Erro ao carregar detalhes", "error");
            setDetailedUser(null);
          }
        })
        .catch(err => {
          console.error(err);
          addToast("Erro ao carregar detalhes do usuário.", "error");
        })
        .finally(() => setIsLoadingDetail(false));
    } else {
      setDetailedUser(null);
      setDetailTab('overview');
    }
  }, [viewingProfileId]);

  const handleUserAction = async (action: string, data: any) => {
    if (!detailedUser) return;
    setActionLoading(true);
    const payload = {
      user_id: detailedUser.profile?.id,
      action,
      ...data
    };

    console.log('🚀 Sending Admin Action:', payload);

    if (!payload.user_id && action !== 'refund_transaction') {
      console.error('❌ Cannot perform action: user_id is missing', detailedUser);
      addToast("Erro: ID do usuário faltando para esta ação.", "error");
      setActionLoading(false);
      return;
    }

    try {
      await apiClient.post(ENDPOINTS.admin.userActions, payload);
      addToast("Ação realizada com sucesso!", "success");

      if (action === 'update_profile') {
        setIsEditingUser(false);
      }

      // Refresh data
      const refresh = await apiClient.get(`${ENDPOINTS.admin.userDetails}?id=${viewingProfileId}`) as any;
      if (refresh.success) {
        setDetailedUser(refresh.data);
      }
    } catch (error) {
      console.error(error);
      addToast("Erro ao realizar ação.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const startEditingUser = () => {
    if (detailedUser) {
      setEditUserForm({
        name: detailedUser.profile?.name || '',
        email: detailedUser.profile?.email || '',
        cpf: detailedUser.profile?.cpf || '',
        phone: detailedUser.profile?.phone || '',
        targetExam: detailedUser.profile?.target_exam || ''
      });
      setIsEditingUser(true);
    }
  };


  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['questions', 'users', 'materials', 'rankings', 'import', 'reports', 'blocked', 'filters'].includes(tabParam)) {
      setActiveSubTab(tabParam as any);
    }
  }, [searchParams]);

  // Handle Hash Scroll
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-indigo-50', 'ring-2', 'ring-indigo-500');
          setTimeout(() => element.classList.remove('bg-indigo-50', 'ring-2', 'ring-indigo-500'), 3000);
        }
      }, 800);
    }
  }, [location.hash, activeSubTab]);

  const [filter, setFilter] = useState('');

  // Modais
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [isGeneratingDetailed, setIsGeneratingDetailed] = useState(false);
  const [isGeneratingTeacher, setIsGeneratingTeacher] = useState(false);

  // --- PDF IMPORTER STATE ---
  const [qFile, setQFile] = useState<File | null>(null);
  const [kFile, setKFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractWithComment, setExtractWithComment] = useState(true);
  const [examProgress, setExamProgress] = useState(0);
  const [keyProgress, setKeyProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);

  // Bulk Generation State
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);

  const [generatingSpecific, setGeneratingSpecific] = useState<{ index: number, type: 'teacher' | 'detailed' } | null>(null);

  const loadQuestions = async (page = 1) => {
    try {
      const res = await api.get<any>(ENDPOINTS.questions.filter, {
        params: {
          page: page.toString(),
          keyword: filter
        }
      }) as any;
      if (res.success && res.data) {
        setAdminQuestions(res.data.rows);
        setPagination({
          total: res.data.total,
          perPage: res.data.perPage,
          pages: res.data.pages,
          page: res.data.page
        });
      }
    } catch (e) { console.error('Error loading questions:', e); }
  };

  useEffect(() => {
    if (activeSubTab === 'questions') loadQuestions(1);
  }, [activeSubTab, filter]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const sortData = (data: any[]) => {
    if (!data || !sortConfig) return data || [];
    return [...data].sort((a, b) => {
      let aVal = getNestedValue(a, sortConfig.key);
      let bVal = getNestedValue(b, sortConfig.key);

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortableHeader = ({ label, sortKey, className = "" }: { label: string; sortKey: string; className?: string }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <th
        className={`p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group ${className}`}
        onClick={() => requestSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronUp size={10} className={isActive && sortConfig?.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'} />
            <ChevronDown size={10} className={isActive && sortConfig?.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'} />
          </div>
          {isActive && (
            <div className="ml-auto">
              {sortConfig?.direction === 'asc' ? <ChevronUp size={12} className="text-indigo-600" /> : <ChevronDown size={12} className="text-indigo-600" />}
            </div>
          )}
        </div>
      </th>
    );
  };
  // Dados para os Seletores Inteligentes
  const existingAgencies = useMemo(() => {
    return (systemSettings.taxonomies?.agencies || []).map((t: any) => t.sigla || t.name);
  }, [systemSettings.taxonomies?.agencies]);

  const existingOrgaos = useMemo(() => {
    return (systemSettings.taxonomies?.organizations || []).map((t: any) => t.sigla || t.name);
  }, [systemSettings.taxonomies?.organizations]);

  const existingSubjects = useMemo(() => {
    return (systemSettings.taxonomies?.subjects || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.subjects]);

  const existingTopics = useMemo(() => {
    return (systemSettings.taxonomies?.topics || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.topics]);

  const existingYears = useMemo(() => {
    return (systemSettings.taxonomies?.years || []);
  }, [systemSettings.taxonomies?.years]);

  const existingRoles = useMemo(() => {
    return (systemSettings.taxonomies?.roles || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.roles]);

  const groupedReports = useMemo(() => {
    const groups: Record<string, {
      id: string;
      targetId: string | number;
      targetType: 'question' | 'material';
      reports: ErrorReport[];
      lastReport: ErrorReport;
    }> = {};

    (allReports as ErrorReport[]).filter(r => r.status === 'pending').forEach(r => {
      const targetId = r.targetType === 'question' ? r.questionId : r.materialId;
      if (!targetId) return;

      const key = `${r.targetType}-${targetId}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          targetId: targetId,
          targetType: r.targetType,
          reports: [],
          lastReport: r
        };
      }
      groups[key].reports.push(r);
      if (r.timestamp > groups[key].lastReport.timestamp) {
        groups[key].lastReport = r;
      }
    });

    return Object.values(groups);
  }, [allReports]);

  // Form Manual Questão
  const [manualQ, setManualQ] = useState<any>({
    enunciado: '', enunciado_clean: '', introText: '', imageUrl: '',
    bancas: [], subjects: [], dificuldade: 2,
    itens: [
      { id: 1, corpo: '', corpo_clean: '', rotulo: 'A' },
      { id: 2, corpo: '', corpo_clean: '', rotulo: 'B' },
      { id: 3, corpo: '', corpo_clean: '', rotulo: 'C' },
      { id: 4, corpo: '', corpo_clean: '', rotulo: 'D' },
      { id: 5, corpo: '', corpo_clean: '', rotulo: 'E' },
    ],
    resposta: 1, teacherComment: '', detailedComment: '',
    orgaos: [], anos: [], cargos: [], assuntos: [], level: 'Superior', tipo: 'Múltipla Escolha',
    anulada: false, desatualizada: false,
    text: '', // Legacy support
    agencies: [], years: [], topics: [], roles: [],
    provaId: ''
  });

  // Auto-fill logic for metadata relationships
  useEffect(() => {
    // 1. Auto-fill Orgaos from Selected Cargos
    const selectedCargos = manualQ.cargos || [];
    const currentOrgaos = manualQ.orgaos || [];
    const newOrgaos = [...currentOrgaos];
    let changed = false;

    selectedCargos.forEach((cName: any) => {
      const cargo = systemSettings.taxonomies?.roles?.find((r: any) => r.name === cName || r.sigla === cName);
      if (cargo && cargo.parentId) {
        const parentOrgao = systemSettings.taxonomies?.organizations?.find((o: any) => o.id === cargo.parentId);
        if (parentOrgao) {
          const orgaoName = parentOrgao.sigla || parentOrgao.name;
          if (!newOrgaos.includes(orgaoName)) {
            newOrgaos.push(orgaoName);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      setManualQ((prev: any) => ({ ...prev, orgaos: newOrgaos }));
    }
  }, [manualQ.cargos, systemSettings.taxonomies]);

  useEffect(() => {
    // 2. Auto-fill Subjects (Matérias) from Selected Assuntos (Tópicos)
    const selectedTopics = manualQ.assuntos || [];
    const currentSubjects = manualQ.subjects || [];
    const newSubjects = [...currentSubjects];
    let changed = false;

    selectedTopics.forEach((tName: any) => {
      const topic = systemSettings.taxonomies?.topics?.find((t: any) => t.name === tName);
      if (topic && topic.parentId) {
        // Find if this parentId belongs to a Subject
        const parentSubject = systemSettings.taxonomies?.subjects?.find((s: any) => s.id === topic.parentId);
        if (parentSubject) {
          const subjectName = parentSubject.name;
          if (!newSubjects.includes(subjectName)) {
            newSubjects.push(subjectName);
            changed = true;
          }
        } else {
          // Also recursively check if parent is another topic that has its own subject parent
          const parentTopic = systemSettings.taxonomies?.topics?.find((t: any) => t.id === topic.parentId);
          if (parentTopic && parentTopic.parentId) {
            const rootSubject = systemSettings.taxonomies?.subjects?.find((s: any) => s.id === parentTopic.parentId);
            if (rootSubject) {
              const subjectName = rootSubject.name;
              if (!newSubjects.includes(subjectName)) {
                newSubjects.push(subjectName);
                changed = true;
              }
            }
          }
        }
      }
    });

    if (changed) {
      setManualQ((prev: any) => ({ ...prev, subjects: newSubjects }));
    }
  }, [manualQ.assuntos, systemSettings.taxonomies]);

  const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev].slice(0, 50));

  const pdfToImage = async (pdfDoc: any, pageNum: number): Promise<string> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    }
    throw new Error("Falha ao renderizar PDF");
  };

  const handleImportProcess = async () => {
    if (!qFile || !kFile) {
      addToast("`Arquivos de Prova e Gabarito são obrigatórios para este processo.", "error");
      return;
    }
    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExamProgress(0);
    setKeyProgress(0);

    try {
      // 1. Process Answer Key first
      addLog("Iniciando leitura do Gabarito...");
      const kBuffer = await kFile.arrayBuffer();
      const kPdf = await pdfjs.getDocument(kBuffer).promise;
      const kImg = await pdfToImage(kPdf, 1);
      setKeyProgress(50);
      const keyMap = await aiService.extractAnswerKeyMapping(systemSettings.geminiApiKey || '', kImg);
      setKeyProgress(100);
      addLog("Gabarito oficial mapeado pela IA.");

      // 2. Process Questions Page by Page
      addLog("Iniciando motor de extração IA (Prova)...");
      const qBuffer = await qFile.arrayBuffer();
      const qPdf = await pdfjs.getDocument(qBuffer).promise;
      const pagesCount = qPdf.numPages;
      setTotalPages(pagesCount);
      addLog(`Arquivo de prova identificado: ${pagesCount} páginas.`);

      let allFoundQuestions: Question[] = [];

      for (let i = 1; i <= pagesCount; i++) {
        setCurrentPage(i);
        addLog(`Lendo pág ${i}/${pagesCount}...`);

        const pageImg = await pdfToImage(qPdf, i);
        // Passando a opção de extrair com comentário ou não
        const result = await aiService.extractQuestionsFromPage(systemSettings.geminiApiKey || '', pageImg, extractWithComment);

        if (result.questions && result.questions.length > 0) {
          addLog(`${result.questions.length} questões encontradas na pág ${i}.`);

          const mappedQs = result.questions.map((q, idx) => {
            const questionNumber = allFoundQuestions.length + idx + 1;
            const qAny = q as any;
            return {
              ...q,
              // id will be generated by MySQL auto_increment
              hashId: (result.metadata as any)?.hash_id,
              enunciado: qAny.text || q.enunciado || '',
              enunciado_clean: (qAny.text || q.enunciado || '').replace(/<[^>]*>?/gm, ''),
              bancas: result.metadata?.agency ? [{ sigla: result.metadata.agency, name: result.metadata.agency, id: null, slug: result.metadata.agency.toLowerCase() }] : [],
              orgaos: result.metadata?.source ? [{ name: result.metadata.source, id: null, slug: result.metadata.source.toLowerCase() }] : [],
              cargos: result.metadata?.role ? [{ id: null, slug: result.metadata.role.toLowerCase(), descricao: result.metadata.role }] : [],
              assuntos: [
                ...(qAny.subject ? [{ id: null, name: qAny.subject, slug: qAny.subject.toLowerCase(), materia: true }] : []),
                ...(qAny.topic ? [{ id: null, name: qAny.topic, slug: qAny.topic.toLowerCase(), materia: false }] : [])
              ],
              anos: result.metadata?.year ? [Number(result.metadata.year)] : [new Date().getFullYear()],
              tipo: (qAny.options || []).length === 2 ? 'certo ou errado' : 'multipla escolha',
              dificuldade: qAny.difficulty === 'Fácil' ? 1 : qAny.difficulty === 'Difícil' ? 3 : 2,
              itens: (qAny.options || []).map((o: string, i: number) => ({
                id: i + 1,
                ordem: i + 1,
                rotulo: String.fromCharCode(65 + i),
                corpo: o,
                corpo_clean: o.replace(/<[^>]*>?/gm, '')
              })),
              resposta: keyMap[questionNumber] !== undefined ? keyMap[questionNumber] + 1 : 1,
              stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
              comments: []
            } as unknown as Question;
          });

          allFoundQuestions = [...allFoundQuestions, ...mappedQs];
          setExtractedQuestions([...allFoundQuestions]);
        }

        setExamProgress(Math.round((i / pagesCount) * 100));
      }

      addLog("IMPORTAÇÃO CONCLUÍDA! Revise as questões.");
    } catch (e: any) {
      addLog(`ERRO CRÍTICO: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) return;
    setIsBulkGenerating(true);
    setBulkProgress(0);
    addLog("Iniciando geração em massa de comentários detalhados...");

    const updatedList = [...extractedQuestions];
    const total = updatedList.length;

    for (let i = 0; i < total; i++) {
      // Skip if already has detailed comment
      if (!updatedList[i].detailedComment) {
        try {
          const detail = await aiService.generateDetailedAnalysis(systemSettings.geminiApiKey || '', updatedList[i]);
          updatedList[i] = { ...updatedList[i], detailedComment: detail };
          setExtractedQuestions([...updatedList]); // Update UI incrementally
        } catch (e) {
          addLog(`Erro ao gerar detalhado para questão ${i + 1}`);
        }
      }
      setBulkProgress(Math.round(((i + 1) / total) * 100));
    }

    addLog("Geração em massa concluída!");
    setIsBulkGenerating(false);
  };

  const handleGenerateSpecific = async (index: number, type: 'teacher' | 'detailed') => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    try {
      let updatedQ = { ...question };
      if (type === 'teacher') {
        const comment = await aiService.generateTeacherComment(systemSettings.geminiApiKey || '', question);
        updatedQ.teacherComment = comment;
      } else {
        const detail = await aiService.generateDetailedAnalysis(systemSettings.geminiApiKey || '', question);
        updatedQ.detailedComment = detail;
      }

      const newList = [...extractedQuestions];
      newList[index] = updatedQ;
      setExtractedQuestions(newList);
    } catch (e) {
      addToast("`Erro ao gerar comentário. Tente novamente.", "error");
    } finally {
      setGeneratingSpecific(null);
    }
  };

  const handleGenerateManualDetail = async () => {
    setIsGeneratingDetailed(true);
    const q: Question = { ...manualQ, options: manualQ.itens.map((i: any) => i.corpo).filter((o: string) => o) } as Question;
    const detail = await aiService.generateDetailedAnalysis(systemSettings.geminiApiKey || '', q);
    setManualQ({ ...manualQ, detailedComment: detail });
    setIsGeneratingDetailed(false);
  };

  const handleGenerateManualTeacherComment = async () => {
    setIsGeneratingTeacher(true);
    const q: Question = { ...manualQ, options: manualQ.itens.map((i: any) => i.corpo).filter((o: string) => o) } as Question;
    const comment = await aiService.generateTeacherComment(systemSettings.geminiApiKey || '', q);
    setManualQ({ ...manualQ, teacherComment: comment });
    setIsGeneratingTeacher(false);
  };

  const handleSaveManual = async () => {
    const newQ: Question = {
      id: editingQuestion?.id ? Number(editingQuestion.id) : null,
      enunciado: manualQ.enunciado || manualQ.text,
      enunciado_clean: manualQ.enunciado_clean || (manualQ.text ? manualQ.text.replace(/<[^>]*>?/gm, '') : ''),
      introText: manualQ.introText,
      imageUrl: manualQ.imageUrl,

      // Map strings from selectors back to objects if they aren't already
      bancas: manualQ.bancas.map((b: any) => typeof b === 'string' ? (systemSettings.taxonomies?.agencies?.find((t: any) => t.sigla === b || t.name === b) || { id: null, sigla: b, nome: b, name: b, slug: slugify(b) }) : { ...b, name: b.name || b.nome || b.sigla }),
      orgaos: manualQ.orgaos.map((o: any) => typeof o === 'string' ? (systemSettings.taxonomies?.organizations?.find((t: any) => t.sigla === o || t.name === o) || { id: null, nome: o, sigla: o, name: o, slug: slugify(o) }) : { ...o, name: o.name || o.nome || o.sigla }),
      cargos: manualQ.cargos.map((c: any) => typeof c === 'string' ? (systemSettings.taxonomies?.roles?.find((t: any) => t.name === c) || { id: null, slug: slugify(c), descricao: c, name: c }) : { ...c, name: c.name || c.descricao }),
      assuntos: [
        ...manualQ.subjects.map((s: any) => {
          const found = typeof s === 'string' ? systemSettings.taxonomies?.subjects?.find((t: any) => t.name === s) : s;
          return found ? { ...found, name: found.name || found.nome || s, materia: true } : { id: null, nome: s, name: s, slug: slugify(s), materia: true };
        }),
        ...manualQ.assuntos
          .filter((a: any) => {
            const aName = typeof a === 'string' ? a : (a.name || a.nome);
            // Deduplicate: if it's already in subjects, don't include it in assuntos
            return !manualQ.subjects.some((s: any) => (typeof s === 'string' ? s : (s.name || s.nome)) === aName);
          })
          .map((a: any) => {
            const found = typeof a === 'string' ? systemSettings.taxonomies?.topics?.find((t: any) => t.name === a) : a;
            return found ? { ...found, name: found.name || found.nome || a, materia: false } : { id: null, nome: a, name: a, slug: slugify(a), materia: false };
          })
      ],
      anos: manualQ.anos.map((y: any) => typeof y === 'string' ? { id: null, name: y, slug: y } : { id: null, name: String(y), slug: String(y) }),
      provaId: manualQ.provaId || null,

      tipo: manualQ.modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      dificuldade: manualQ.difficulty,

      itens: manualQ.itens.filter((it: any) => it.corpo.trim()),
      resposta: manualQ.resposta,

      teacherComment: manualQ.teacherComment,
      detailedComment: manualQ.detailedComment,

      anulada: manualQ.anulada,
      desatualizada: manualQ.desatualizada,

      stats: editingQuestion?.stats || { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
      comments: editingQuestion?.comments || [],
      timestamp: new Date().toISOString()
    } as Question;

    try {
      // Se estivermos editando uma questão da extração temporária
      if (editingExtractedIndex !== null) {
        const updatedExtracted = [...extractedQuestions];
        updatedExtracted[editingExtractedIndex] = newQ;
        setExtractedQuestions(updatedExtracted);
        setEditingExtractedIndex(null);
        addToast("`Questão extraída revisada com sucesso!", "error");
      } else {
        // Se for edição/criação direta no banco
        let res;
        if (editingQuestion) {
          res = await onUpdateQuestion(newQ);
        } else {
          res = await onAddQuestion(newQ);
        }
        setEditingQuestion(null);
        loadQuestions(pagination.page);

        let msg = "Questão salva com sucesso!";
        if (res?.newTaxonomies?.length > 0) {
          msg += "\n\nNovos itens criados: " + res.newTaxonomies.map((t: any) => `${t.type}: ${t.name}`).join(", ");
        }
        addToast(msg, 'success');
      }
    } catch (error) {
      console.error("Error saving manual question:", error);
      addToast("`Erro ao salvar questão. Verifique o console para mais detalhes.", "error");
    } finally {
      setShowAddManual(false);
    }
  };

  const handleEditReportTarget = (report: ErrorReport) => {
    if (report.targetType === 'question' && report.questionId) {
      const q = questions.find((q: Question) => q.id === report.questionId);
      if (q) openManualModal(q);
      else addToast("`Questão não encontrada (pode ter sido excluída).", "error");
    } else if (report.targetType === 'material') {
      if (!report.materialId) {
        addToast("`Erro: ID do material não encontrado na denúncia.", "error");
        return;
      }
      const m = allMaterials.find((m: Material) => m.id === report.materialId);
      if (m) {
        setEditingMaterial(m);
        setSelectedReport(report);
        setModerationReason(m.rejectionReason || '');
      } else {
        addToast(`Material não encontrado com ID: ${report.materialId}`, 'error');
      }
    }
  };

  const openManualModal = (q?: Question, extractedIndex?: number) => {
    if (q) {
      setEditingQuestion(q);
      setEditingExtractedIndex(extractedIndex !== undefined ? extractedIndex : null);

      const qAny = q as any;
      setManualQ({
        ...q,
        enunciado: q.enunciado || qAny.text || '',
        enunciado_clean: q.enunciado_clean || (qAny.text ? qAny.text.replace(/<[^>]*>?/gm, '') : ''),
        // Extract string values for SmartTagSelector
        bancas: (q.bancas || []).map((b: any) => typeof b === 'string' ? b : (b.sigla || b.name)),
        orgaos: (q.orgaos || []).map((o: any) => typeof o === 'string' ? o : o.name),
        cargos: (q.cargos || []).map((c: any) => typeof c === 'string' ? c : (c.descricao || c.name)),
        subjects: (q.assuntos?.filter((a: any) => a.materia) || []).map((s: any) => s.nome || s.name || s),
        assuntos: (q.assuntos?.filter((a: any) => !a.materia) || []).map((a: any) => a.nome || a.name || a),
        anos: (q.anos || []).map((y: any) => typeof y === 'number' ? String(y) : y),
        dificuldade: q.dificuldade || qAny.difficulty || 2,
        tipo: q.tipo || qAny.modality || 'Múltipla Escolha',
        itens: q.itens || qAny.options?.map((o: string, idx: number) => ({ id: idx + 1, corpo: o, corpo_clean: o.replace(/<[^>]*>?/gm, ''), rotulo: String.fromCharCode(65 + idx) })) || [],
        resposta: q.resposta || (qAny.correctOptionIndex !== undefined ? qAny.correctOptionIndex + 1 : 1),
        anulada: q.anulada || qAny.isCanceled || false,
        desatualizada: q.desatualizada || qAny.isOutdated || false,
        detailedComment: q.detailedComment || '',
        provaId: (q as any).prova_id || qAny.provaId || ''
      });
    } else {
      setEditingQuestion(null);
      setEditingExtractedIndex(null);
      setManualQ({
        enunciado: '', enunciado_clean: '', introText: '', imageUrl: '',
        bancas: [], orgaos: [], assuntos: [], anos: [], cargos: [],
        subjects: [], dificuldade: 2,
        itens: [
          { id: 1, corpo: '', corpo_clean: '', rotulo: 'A' },
          { id: 2, corpo: '', corpo_clean: '', rotulo: 'B' },
          { id: 3, corpo: '', corpo_clean: '', rotulo: 'C' },
          { id: 4, corpo: '', corpo_clean: '', rotulo: 'D' },
          { id: 5, corpo: '', corpo_clean: '', rotulo: 'E' },
        ],
        resposta: 1, teacherComment: '', detailedComment: '',
        nivel: 'Superior', tipo: 'Múltipla Escolha',
        anulada: false, desatualizada: false,
        provaId: ''
      });
    }
    setShowAddManual(true);
  };

  const [activeCategory, setActiveCategory] = useState<'content' | 'users' | 'marketplace'>('content');

  const categories = [
    { id: 'content', label: 'Conteúdo', icon: BookOpen, tabs: ['questions', 'import', 'filters'] },
    { id: 'users', label: 'Usuários', icon: User, tabs: ['users', 'blocked', 'rankings', 'reports'] },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, tabs: ['materials'] }
  ];

  // Map sub-tabs to their display names for pills
  const subTabLabels: Record<string, string> = {
    questions: 'Questões',
    import: 'Importador',
    filters: 'Filtros (Taxonomia)',
    users: 'Gestão de Usuários',
    blocked: 'Bloqueados',
    rankings: 'Rankings',
    materials: 'Materiais',
    reports: 'Denúncias'
  };

  return (
    <div className="space-y-6 animate-slide-up relative">
      {/* NAVEGAÇÃO CATEGORIZADA */}
      <div className="flex flex-col gap-4">
        {/* Categorias Principais */}
        <div className="flex gap-4 p-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id as any);
                setActiveSubTab(cat.tabs[0] as any);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <cat.icon size={18} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            {categories.find(c => c.id === activeCategory)?.tabs
              .filter(tab => tab !== 'import' || systemSettings.features.bulkImportEnabled)
              .map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab as any)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeSubTab === tab ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                >
                  {subTabLabels[tab] || tab}
                </button>
              ))
            }
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {activeSubTab !== 'questions' && (
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input type="text" placeholder="Filtrar dados..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full h-10 pl-9 pr-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors" />
              </div>
            )}
            {activeSubTab === 'questions' && (
              <div className="flex items-center gap-2">
                <button onClick={() => openManualModal()} className="h-10 px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-md transition-all active:scale-95"><Plus size={16} /> Nova Questão</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeSubTab === 'questions' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <SortableHeader label="Questão" sortKey="enunciado_clean" />
                  <th className="p-4">Status</th>
                  <SortableHeader label="Banca/Matéria" sortKey="banca" />
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {sortData(adminQuestions).map((q: any) => (
                  <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 max-w-md truncate text-slate-900 dark:text-slate-100 font-medium">{q.enunciado_clean || q.text}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {Number(q.anulada) === 1 && <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Anulada</span>}
                        {Number(q.desatualizada) === 1 && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Desat.</span>}
                        {q.detailedComment && <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black uppercase" title="Possui Análise Detalhada">IA</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {q.bancas?.map((b: any) => b.sigla).join(' / ') || 'Banca'}
                        </span>
                        <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit">
                          {q.assuntos?.map((s: any) => s.materia ? s.nome : '').filter(Boolean).join(', ') || 'Matéria'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openManualModal(q)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"><Edit3 size={14} /></button>
                        <button onClick={() => onDeleteQuestion(q.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {pagination.total}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => loadQuestions(pagination.page - 1)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase disabled:opacity-30">Anterior</button>
              <span className="flex items-center px-4 text-[10px] font-black uppercase text-indigo-600">Página {pagination.page} de {pagination.pages}</span>
              <button disabled={pagination.page >= pagination.pages} onClick={() => loadQuestions(pagination.page + 1)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase disabled:opacity-30">Próxima</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <SortableHeader label="Usuário" sortKey="name" />
                <SortableHeader label="Cargo/Plano" sortKey="billing.plan" />
                <SortableHeader label="Estatísticas" sortKey="level" />
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {sortData(allUsers.filter((u: any) => (u.name || '').toLowerCase().includes(filter.toLowerCase()) || (u.email || '').toLowerCase().includes(filter.toLowerCase()))).map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{u.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{u.email}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{u.targetExam || 'N/I'}</span>
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit">{u.billing?.plan || 'Gratuito'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Nível {u.level} • {u.xp} XP</div>
                    <div className="w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (u.xp % 1000) / 10)}%` }} />
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setViewingProfileId(u.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all" title="Ver Perfil Completo"><Eye size={16} /></button>
                      <button onClick={() => setViewingProfileId(u.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"><Edit3 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'materials' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <SortableHeader label="Material" sortKey="title" />
                <SortableHeader label="Autor/Preço" sortKey="price" />
                <SortableHeader label="Vendas" sortKey="salesCount" />
                <SortableHeader label="Status" sortKey="status" />
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {sortData(allMaterials.filter((m: any) => (m.title || '').toLowerCase().includes(filter.toLowerCase()))).map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{m.title}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{m.subject}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{m.authorName}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-black text-[10px]">R$ {m.price.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{m.salesCount || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : m.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                      {m.status === 'approved' ? 'Ativo' : m.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditingMaterial(m); setModerationReason(m.rejectionReason || ''); }} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"><Edit3 size={14} /> Moderar</button>
                      {m.fileUrl && (
                        <a
                          href={`${ENDPOINTS.materials.list.replace('list.php', 'access.php')}?id=${m.id}&token=${localStorage.getItem('token')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
                        >
                          <Download size={14} />
                        </a>
                      )}
                      <button onClick={() => onDeleteMaterial(m.id)} className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <SortableHeader label="Alvo" sortKey="targetType" />
                <SortableHeader label="Motivo" sortKey="lastReport.reason" />
                <th className="p-4">Detalhes</th>
                <SortableHeader label="Usuário" sortKey="lastReport.userName" />
                <th className="p-4">Prova</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {sortData(groupedReports).map(group => (
                <tr key={group.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-500">
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase w-fit ${group.targetType === 'question' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'}`}>
                        {group.targetType === 'question' ? 'Questão' : 'Material'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">ID: {group.targetId}</span>
                      {group.reports.length > 1 && (
                        <span className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1">
                          <AlertTriangle size={10} /> {group.reports.length} Denúncias
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{group.lastReport.reason}</span>
                      {group.reports.length > 1 && <span className="text-[10px] text-slate-400">Última: {new Date(group.lastReport.timestamp).toLocaleDateString()}</span>}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">{group.lastReport.details}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-slate-500 dark:text-slate-400 font-bold">{group.lastReport.userName}</span>
                      {group.reports.length > 1 && <span className="text-[10px] text-slate-400">+{group.reports.length - 1} outros</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    {group.lastReport.evidenceUrl ? (
                      <a href={group.lastReport.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                        <ImageIcon size={20} />
                      </a>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => {
                          if (group.targetType === 'question') {
                            const q = questions.find((ques: any) => Number(ques.id) === Number(group.targetId));
                            if (q) {
                              setEditingQuestion(q);
                              setManualQ({
                                ...q,
                                bancas: q.bancas.map((b: any) => typeof b === 'string' ? b : (b.sigla || b.name)),
                                orgaos: q.orgaos.map((o: any) => typeof o === 'string' ? o : o.name),
                                subjects: q.subjects.map((s: any) => typeof s === 'string' ? s : s.name),
                                assuntos: q.assuntos.map((a: any) => typeof a === 'string' ? a : a.name),
                                cargos: q.cargos.map((c: any) => typeof c === 'string' ? c : (c.descricao || c.name)),
                                anos: q.anos.map(String),
                                difficulty: q.dificuldade,
                                level: q.nivel
                              });
                              setShowAddManual(true);
                              setSelectedReport(group.lastReport);
                            } else {
                              addToast("`Questão não encontrada na base atual.", "error");
                            }
                          } else {
                            const m = allMaterials.find((mat: any) => mat.id === group.targetId);
                            if (m) {
                              setEditingMaterial(m);
                              setSelectedReport(group.lastReport);
                              setModerationReason(m.rejectionReason || '');
                            }
                          }
                        }}
                        className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"
                      >
                        <Shield size={14} /> Moderar
                      </button>
                      <button onClick={() => resolveReport(group.lastReport.id, 'resolved', 'Resolvido via dashboard')} className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"><CheckCircle2 size={14} /> Resolver</button>
                    </div>
                  </td>
                </tr>
              ))}
              {groupedReports.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">Nenhuma denúncia pendente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {activeSubTab === 'rankings' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <SortableHeader label="Ranking" sortKey="name" />
                <SortableHeader label="Instituição" sortKey="institution" />
                <SortableHeader label="Vagas/Reserva" sortKey="vacancies" />
                <SortableHeader label="Inscritos" sortKey="entries.length" />
                <SortableHeader label="Status" sortKey="keyStatus" />
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {sortData(rankings).map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{r.institution}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{r.vacancies} + {r.reserveLimit}</td>
                  <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{r.entries?.length || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${r.keyStatus === 'official' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                      {r.keyStatus === 'official' ? 'Gabarito Oficial' : 'Preliminar'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setEditingRanking(r)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors group"
                    >
                      <Edit3 size={14} className="group-hover:scale-110 transition-transform" />
                    </button>
                  </td>
                </tr>
              ))}
              {rankings.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">Nenhum ranking cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'blocked' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10 flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-widest">
            <ShieldAlert size={16} /> Materiais Bloqueados / Rejeitados
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr><th className="p-4">Material</th><th className="p-4">Autor</th><th className="p-4">Motivo do Bloqueio</th><th className="p-4 text-center">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {allMaterials.filter((m: any) => m.status === 'rejected').map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{m.title}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{m.authorName}</td>
                  <td className="p-4 text-red-600/80 dark:text-red-400/80 italic max-w-md truncate">{m.rejectionReason || 'Sem motivo registrado'}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => { setEditingMaterial(m); setSelectedReport(null); setModerationReason(m.rejectionReason || '') }} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold uppercase text-[10px] transition-colors">Reanalisar</button>
                  </td>
                </tr>
              ))}
              {allMaterials.filter((m: any) => m.status === 'rejected').length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum material bloqueado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}



      {activeSubTab === 'filters' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
          {/* Categorias de Filtros (Sidebar Lateral) */}
          <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm h-fit">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Filtrar por Tipo</h3>
            <div className="space-y-1">
              {filterTypes.map(type => (
                <button
                  key={type.key}
                  onClick={() => setActiveFilterType(type.key)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${activeFilterType === type.key ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {type.label}
                  <ChevronDown size={14} className={activeFilterType === type.key ? 'rotate-[-90deg]' : 'opacity-0'} />
                </button>
              ))}
            </div>
          </div>

          {/* Gestão de Itens (Tabela Unificada) */}
          <div className="md:col-span-3 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar em todas as taxonomias..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                onClick={() => { cancelEditingFilter(); setShowTaxonomyModal(true); }}
                className="w-full md:w-auto h-11 px-6 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus size={18} /> Novo Filtro
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nome / Parentesco</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Slug (URL)</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {(() => {
                    const getActiveList = () => {
                      if (!systemSettings.taxonomies) return [];
                      const t = systemSettings.taxonomies;
                      const safeMap = (arr: any[] | undefined, type: string) => (arr || []).map((i: any) => ({ ...i, type }));
                      const all = [
                        ...safeMap(t.agencies, 'banca'),
                        ...safeMap(t.organizations, 'orgao'),
                        ...safeMap(t.roles, 'cargo'),
                        ...safeMap(t.subjects, 'assunto'),
                        ...safeMap(t.topics, 'assunto'),
                        ...safeMap(t.careers, 'carreira'),
                        ...safeMap(t.areas, 'area'),
                        ...(t.years || []).map((y: any) => ({ id: y, name: String(y), slug: String(y), type: 'ano' }))
                      ];
                      if (activeFilterType === 'all') return all;
                      return all.filter(i => i.type === activeFilterType);
                    };
                    return getActiveList();
                  })()
                    .filter((item: any) => (item.name || '').toLowerCase().includes(filterSearch.toLowerCase()) || (item.slug || '').toLowerCase().includes(filterSearch.toLowerCase()))
                    .map((item: any) => (
                      <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                          {(item.parentId || item.parent_id) && (
                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <span className="opacity-50">Subitem de:</span>
                              {(() => {
                                const t = systemSettings.taxonomies;
                                if (!t) return '...';
                                const allLists = [...(t.agencies || []), ...(t.organizations || []), ...(t.roles || []), ...(t.subjects || []), ...(t.topics || []), ...(t.careers || []), ...(t.areas || [])];
                                const parent = allLists.find((p: any) => p.id === (item.parentId || item.parent_id));
                                return parent ? parent.name : 'Item Raiz';
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                            {filterTypes.find(t => t.key === item.type)?.label || item.type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-[10px]">{item.slug}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            {filterTypes.find(t => t.key === item.type)?.hierarchical && (
                              <button
                                onClick={() => {
                                  cancelEditingFilter();
                                  setActiveFilterType(item.type);
                                  setSelectedParentId(item.id);
                                  setShowTaxonomyModal(true);
                                }}
                                title="Adicionar Subitem"
                                className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all"
                              >
                                <PlusCircle size={14} />
                              </button>
                            )}
                            <button onClick={() => startEditingFilter(item)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteFilter(item.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'import' && (
        <div className="space-y-6 animate-slide-up">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors duration-300">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
                  <Database size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-sm tracking-widest">Extração Inteligente</h3>
                </div>

                {/* --- API KEY CONFIGURATION --- */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Zap size={12} className={systemSettings.geminiApiKey?.startsWith('AIza') ? 'text-emerald-500' : 'text-slate-400'} />
                      Gemini API Key
                    </label>
                    {systemSettings.geminiApiKey?.startsWith('AIza') && <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Ativa</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={systemSettings.geminiApiKey || ''}
                      onChange={e => dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: { ...systemSettings, geminiApiKey: e.target.value } })}
                      placeholder="Cole sua API Key aqui (AIza...)"
                      className="flex-1 h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      onClick={() => updateSystemSettings(systemSettings)}
                      className="h-9 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                  {!systemSettings.geminiApiKey && (
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium leading-tight">
                      <AlertTriangle size={10} className="inline mr-1" />
                      Necessário configurar uma chave válida para extrair questões.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">Arquivo da Prova <span className="text-red-500 font-black">*</span></label>
                    <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${qFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50'}`}>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => setQFile(e.target.files?.[0] || null)} />
                      <UploadCloud size={24} className={qFile ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 px-4 text-center line-clamp-1">{qFile ? qFile.name : "Selecionar Prova (PDF)"}</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">Gabarito Oficial <span className="text-red-500 font-black">*</span></label>
                    <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${kFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50'}`}>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => setKFile(e.target.files?.[0] || null)} />
                      <FileCheck size={24} className={kFile ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 px-4 text-center line-clamp-1">{kFile ? kFile.name : "Selecionar Gabarito (PDF)"}</span>
                    </label>
                  </div>

                  {/* Opção para extrair com comentário */}
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                    <input type="checkbox" checked={extractWithComment} onChange={e => setExtractWithComment(e.target.checked)} className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500" />
                    <label onClick={() => setExtractWithComment(!extractWithComment)} className="text-xs font-bold text-amber-800 dark:text-amber-200 cursor-pointer select-none">Extrair Comentário Resumido (Prof)</label>
                  </div>
                </div>

                {isProcessing ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Progresso da Prova</span>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{examProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500" style={{ width: `${examProgress}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Progresso do Gabarito</span>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{keyProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500" style={{ width: `${keyProgress}%` }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center animate-pulse italic">Processando...</p>
                  </div>
                ) : (
                  <button
                    onClick={handleImportProcess}
                    disabled={!qFile || !kFile}
                    className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none disabled:opacity-30 flex items-center justify-center gap-3"
                  >
                    <PlayCircle size={20} /> Iniciar Importação
                  </button>
                )}
              </div>

              <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 font-mono text-[10px] text-emerald-400 overflow-y-auto h-48 border border-slate-800 dark:border-slate-800 shadow-inner flex flex-col-reverse transition-colors">
                <div className="space-y-1">
                  {logs.map((log, i) => <div key={i} className="animate-fade-in opacity-80">{log}</div>)}
                  {isProcessing && <div className="animate-pulse">_</div>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col gap-6">
              {extractedQuestions.length > 0 ? (
                <div className="space-y-4 animate-slide-up flex-1 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle2 size={16} /> {extractedQuestions.length} Questões Extraídas
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={handleBulkGenerateDetailed}
                        disabled={isBulkGenerating || isProcessing}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black uppercase rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-[10px]"
                      >
                        {isBulkGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} Gerar Análise Detalhada (Todas)
                      </button>
                      <button
                        onClick={async () => {
                          const res = await onAddQuestions(extractedQuestions);
                          setExtractedQuestions([]);

                          let msg = "Banco atualizado!";
                          if (res?.newTaxonomies?.length > 0) {
                            msg += "\n\nNovos itens criados: " + res.newTaxonomies.map((t: any) => `${t.type}: ${t.name}`).join(", ");
                          }
                          addToast(msg, 'success');
                        }}
                        disabled={isProcessing || isBulkGenerating}
                        className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 text-white font-black uppercase rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-[10px]"
                      >
                        <CheckCircle2 size={16} /> Publicar Tudo
                      </button>
                    </div>
                  </div>

                  {isBulkGenerating && (
                    <div className="bg-white px-6 py-4 rounded-2xl border border-indigo-100 shadow-sm animate-fade-in">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2"><Sparkles size={12} /> Gerando Comentários em Massa</span>
                        <span className="text-[10px] font-bold text-slate-400">{bulkProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto max-h-[800px] pr-2 space-y-4 no-scrollbar">
                    {extractedQuestions.map((q, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-500 dark:group-hover:bg-indigo-600 transition-colors" />
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md">{i + 1}</span>
                            <div className="flex flex-wrap gap-2">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {q.bancas?.map((b: any) => b.sigla || b.name).join(' / ') || 'Banca N/I'}
                              </span>
                              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {q.assuntos?.filter((a: any) => a.materia).map((a: any) => a.name).join(', ') || 'Matéria N/I'}
                              </span>
                              <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {q.assuntos?.filter((a: any) => !a.materia).map((a: any) => a.name).join(', ') || 'Assunto N/I'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(q.anulada || (q as any).isCanceled) && <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Anulada</span>}
                            {(q.desatualizada || (q as any).isOutdated) && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Desat.</span>}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-100 dark:border-emerald-900/30">
                              Gabarito: {String.fromCharCode(65 + (q as any).correctOptionIndex)}
                            </div>
                            <button
                              onClick={() => openManualModal(q, i)}
                              className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
                              title="Editar Questão Extraída"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Listagem Detalhada de Metadados Extraídos */}
                        <div className="flex flex-wrap gap-3 mb-4">
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Briefcase size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.cargos?.map((c: any) => c.descricao).join(', ') || (q as any).role || 'Cargo Geral'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Calendar size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.anos?.join(', ') || (q as any).year || '2024'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Layers size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.nivel || 'Superior'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <TrendingUp size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.dificuldade === 1 ? 'Fácil' : q.dificuldade === 3 ? 'Difícil' : 'Média'}</span>
                          </div>
                        </div>

                        {q.introText && (
                          <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 border-l-2 border-slate-200 dark:border-slate-700 rounded-r-xl">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Texto de Apoio</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed line-clamp-2">{q.introText}</p>
                          </div>
                        )}

                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed mb-4 line-clamp-3 group-hover:line-clamp-none transition-all">{q.enunciado}</h4>

                        {/* BOTÕES DE GERAÇÃO PÓS-EXTRAÇÃO */}
                        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                          <button
                            onClick={() => handleGenerateSpecific(i, 'teacher')}
                            disabled={!!generatingSpecific || isBulkGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all disabled:opacity-50"
                          >
                            {generatingSpecific?.index === i && generatingSpecific.type === 'teacher' ? <Loader2 className="animate-spin" size={12} /> : <GraduationCap size={12} />}
                            {q.teacherComment ? 'Regerar Professor' : 'Gerar Professor'}
                          </button>
                          <button
                            onClick={() => handleGenerateSpecific(i, 'detailed')}
                            disabled={!!generatingSpecific || isBulkGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all disabled:opacity-50"
                          >
                            {generatingSpecific?.index === i && generatingSpecific.type === 'detailed' ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                            {q.detailedComment ? 'Regerar Detalhado' : 'Gerar Detalhado'}
                          </button>
                        </div>

                        {q.teacherComment && (
                          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-200 space-y-2 animate-fade-in opacity-80 group-hover:opacity-100">
                            <p className="font-black uppercase tracking-widest text-[9px] flex items-center gap-2"><BookOpen size={14} /> Comentário do Professor</p>
                            <p className="font-medium leading-relaxed italic">{q.teacherComment}</p>
                          </div>
                        )}

                        {q.detailedComment && (
                          <div className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-800 dark:text-indigo-200 space-y-2 animate-fade-in opacity-80 group-hover:opacity-100">
                            <p className="font-black uppercase tracking-widest text-[9px] flex items-center gap-2"><Sparkles size={14} /> Análise Detalhada (IA)</p>
                            <p className="font-medium leading-relaxed italic line-clamp-3">{q.detailedComment}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-20 text-center space-y-4 flex-1 transition-colors">
                  <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300 dark:text-slate-700"><FileText size={80} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Aguardando Arquivos</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto font-medium">Faça o upload da Prova e do Gabarito para iniciar a extração em massa com IA.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ... (Modal de adicionar/editar questão e editar usuário mantidos) ... */}
      {showAddManual && createPortal(
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white dark:bg-slate-900 p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {editingExtractedIndex !== null ? `Revisar Questão Extraída #${editingExtractedIndex + 1}` : editingQuestion ? 'Editar Questão' : 'Adicionar Nova Questão'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-display">Gerencie o conteúdo e os filtros inteligentes para garantir a qualidade.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 mr-6">
                  <button onClick={() => setManualQ({ ...manualQ, anulada: !manualQ.anulada })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${manualQ.anulada ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-400'}`}>
                    {manualQ.anulada ? 'Questão Anulada' : 'Anular Questão'}
                  </button>
                  <button onClick={() => setManualQ({ ...manualQ, desatualizada: !manualQ.desatualizada })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${manualQ.desatualizada ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-400'}`}>
                    {manualQ.desatualizada ? 'Desatualizada' : 'Marcar Desatualizada'}
                  </button>
                </div>
                <button onClick={() => { setShowAddManual(false); setEditingExtractedIndex(null); }} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-2xl transition-all"><X size={24} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar bg-slate-50 dark:bg-slate-950">
              {/* Alertas de Status */}
              {(manualQ.anulada || manualQ.desatualizada) && (
                <div className="flex flex-col gap-2">
                  {manualQ.anulada && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-3"><AlertCircle size={18} /> Esta questão será exibida como ANULADA para os alunos.</div>}
                  {manualQ.desatualizada && <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-3"><AlertTriangle size={18} /> Esta questão será exibida como DESATUALIZADA.</div>}
                </div>
              )}

              {/* Seletores de Metadados (Filtros) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <SmartTagSelector
                  label="Banca(s)"
                  options={existingAgencies}
                  selected={manualQ.bancas.map((b: any) => typeof b === 'string' ? b : (b.sigla || b.name))}
                  onChange={v => setManualQ({ ...manualQ, bancas: v })}
                  placeholder="Ex: Cebraspe, FGV..."
                />
                <SmartTagSelector
                  label="Órgão(s)"
                  options={existingOrgaos}
                  selected={manualQ.orgaos.map((o: any) => typeof o === 'string' ? o : o.name)}
                  onChange={v => setManualQ({ ...manualQ, orgaos: v })}
                  placeholder="Ex: TJ-SP, PF, Receita Federal..."
                />
                <SmartTagSelector
                  label="Matéria(s)"
                  options={existingSubjects}
                  selected={manualQ.subjects.map((s: any) => typeof s === 'string' ? s : s.name)}
                  onChange={v => setManualQ({ ...manualQ, subjects: v })}
                  placeholder="Ex: Direito Administrativo..."
                />
                <SmartTagSelector
                  label="Assunto(s) / Tópicos"
                  options={existingTopics}
                  selected={manualQ.assuntos.map((a: any) => typeof a === 'string' ? a : a.name)}
                  onChange={v => setManualQ({ ...manualQ, assuntos: v })}
                  placeholder="Ex: Crase, Atos..."
                />
                <div className="grid grid-cols-2 gap-4">
                  <SmartTagSelector
                    label="Ano"
                    options={existingYears}
                    selected={manualQ.anos.map(String)}
                    onChange={v => setManualQ({ ...manualQ, anos: v })}
                    placeholder="2024"
                    multiple={true}
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">ID da Prova</label>
                    <input
                      type="number"
                      value={manualQ.provaId}
                      onChange={e => setManualQ({ ...manualQ, provaId: e.target.value })}
                      className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Ex: 54321"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Dificuldade</label>
                    <select value={manualQ.difficulty} onChange={e => setManualQ({ ...manualQ, difficulty: Number(e.target.value) })} className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value={1}>Fácil</option>
                      <option value={2}>Médio</option>
                      <option value={3}>Difícil</option>
                    </select>
                  </div>
                </div>
                <SmartTagSelector
                  label="Cargo(s)"
                  options={existingRoles}
                  selected={manualQ.cargos.map((c: any) => typeof c === 'string' ? c : (c.descricao || c.name))}
                  onChange={v => setManualQ({ ...manualQ, cargos: v })}
                  placeholder="Ex: Analista Judiciário..."
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo da Questão</label>
                    <select value={manualQ.modality || (manualQ.itens.length === 2 ? 'Certo/Errado' : 'Múltipla Escolha')} onChange={e => {
                      const newType = e.target.value;
                      const newItens = newType === 'Certo/Errado'
                        ? [{ id: 1, rotulo: 'C', corpo: 'Certo', corpo_clean: 'Certo' }, { id: 2, rotulo: 'E', corpo: 'Errado', corpo_clean: 'Errado' }]
                        : (manualQ.itens.length === 2 && manualQ.itens[0].corpo === 'Certo'
                          ? [{ id: 1, rotulo: 'A', corpo: '', corpo_clean: '' }, { id: 2, rotulo: 'B', corpo: '', corpo_clean: '' }, { id: 3, rotulo: 'C', corpo: '', corpo_clean: '' }, { id: 4, rotulo: 'D', corpo: '', corpo_clean: '' }, { id: 5, corpo: '', corpo_clean: '' }]
                          : manualQ.itens);

                      setManualQ({ ...manualQ, modality: newType, itens: newItens, tipo: newType === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha' });
                    }} className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value="Múltipla Escolha">Múltipla Escolha</option>
                      <option value="Certo/Errado">Certo/Errado</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Escolaridade (Nível)</label>
                    <select value={manualQ.level} onChange={e => setManualQ({ ...manualQ, level: e.target.value })} className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value="Superior">Superior</option>
                      <option value="Médio">Médio</option>
                      <option value="Fundamental">Fundamental</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Conteúdo da Questão */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Texto de Apoio (Opcional)</label>
                  <textarea value={manualQ.introText} onChange={e => setManualQ({ ...manualQ, introText: e.target.value })} className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 font-medium min-h-[100px] outline-none focus:border-indigo-500 transition-colors" placeholder="Insira textos auxiliares aqui..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Enunciado Principal (HTML)</label>
                  <textarea required value={manualQ.enunciado} onChange={e => setManualQ({ ...manualQ, enunciado: e.target.value, enunciado_clean: e.target.value.replace(/<[^>]*>?/gm, '') })} className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-base text-slate-900 dark:text-slate-100 font-bold min-h-[140px] outline-none focus:border-indigo-500 transition-colors" placeholder="Qual o comando da questão? Aceita HTML." />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-indigo-500 transition-all shadow-sm">
                    <ImageIcon size={18} className="text-indigo-500" /> Upload de Imagem
                    <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setManualQ({ ...manualQ, imageUrl: URL.createObjectURL(f) }); }} />
                  </label>
                  {manualQ.imageUrl && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/50 animate-fade-in">
                      <Check size={14} /> Imagem Anexada
                      <button onClick={() => setManualQ({ ...manualQ, imageUrl: '' })} className="ml-2 hover:text-red-500"><X size={14} /></button>
                    </div>
                  )}
                </div>

                {/* Alternativas */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Alternativas</label>
                    <button onClick={() => setManualQ({ ...manualQ, itens: [...manualQ.itens, { id: Date.now(), rotulo: String.fromCharCode(65 + manualQ.itens.length), corpo: '', corpo_clean: '' }] })} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                      <Plus size={14} /> Adicionar Alternativa
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {manualQ.itens.map((item: any, idx: number) => (
                      <div key={item.id} className="flex gap-3 items-start group">
                        <button onClick={() => setManualQ({ ...manualQ, resposta: idx + 1 })} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all border-2 ${manualQ.resposta === idx + 1 ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-emerald-200'}`}>{item.rotulo}</button>
                        <input type="text" value={item.corpo} onChange={e => { const newItens = [...manualQ.itens]; newItens[idx].corpo = e.target.value; newItens[idx].corpo_clean = e.target.value.replace(/<[^>]*>?/gm, ''); setManualQ({ ...manualQ, itens: newItens }); }} className="flex-1 h-10 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" placeholder={`Corpo da alternativa ${item.rotulo}...`} />
                        <button onClick={() => setManualQ({ ...manualQ, itens: manualQ.itens.filter((_: any, i: number) => i !== idx) })} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comentários */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Comentário do Professor</label>
                      <button
                        onClick={handleGenerateManualTeacherComment}
                        disabled={isGeneratingTeacher}
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1 hover:text-indigo-700 transition-colors"
                      >
                        {isGeneratingTeacher ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} Gerar com IA
                      </button>
                    </div>
                    <textarea value={manualQ.teacherComment} onChange={e => setManualQ({ ...manualQ, teacherComment: e.target.value })} className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl text-sm text-slate-800 dark:text-slate-200 font-medium min-h-[120px] outline-none focus:border-indigo-300 transition-colors" placeholder="Breve comentário ou dica do professor..." />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Análise Detalhada (IA)</label>
                      <button onClick={handleGenerateManualDetail} disabled={isGeneratingDetailed} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1 hover:text-indigo-700 transition-colors">
                        {isGeneratingDetailed ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} Gerar com IA
                      </button>
                    </div>
                    <textarea value={manualQ.detailedComment} onChange={e => setManualQ({ ...manualQ, detailedComment: e.target.value })} className="w-full p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl text-sm text-slate-800 dark:text-slate-200 font-medium min-h-[150px] outline-none focus:border-indigo-300 transition-colors" placeholder="Análise alternativa por alternativa..." />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4 rounded-b-[2.4rem] transition-colors duration-300">
              <button onClick={() => { setShowAddManual(false); setEditingExtractedIndex(null); }} className="px-8 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Descartar</button>
              <button onClick={handleSaveManual} className="px-10 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-slate-200 dark:shadow-none hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center gap-2"><Save size={18} /> {editingExtractedIndex !== null ? 'Atualizar Revision' : 'Salvar Questão'}</button>
            </div>
          </div>
        </div>,
        document.body
      )
      }


      {/* MODAL MODERAÇÃO DE MATERIAL */}
      {
        editingMaterial && createPortal(
          <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden max-w-5xl mx-auto w-full p-8 md:p-12 no-scrollbar">
              <header className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md mb-2 block w-fit">Moderação</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{editingMaterial.title}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Por: {editingMaterial.authorName}</p>
                    <button onClick={() => setViewingProfileId(editingMaterial.authorId)} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-all"><Eye size={10} /> Perfil Admin</button>
                  </div>
                </div>
                <button onClick={() => setEditingMaterial(null)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"><XCircle size={20} className="text-slate-400 dark:text-slate-500" /></button>
              </header>

              {/* Informações da Denúncia */}
              {selectedReport && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-black text-xs uppercase tracking-wider">
                    <AlertTriangle size={14} /> Denúncia: {selectedReport.reason}
                  </div>
                  <p className="text-xs text-red-600/80 leading-relaxed italic">"{selectedReport.details}"</p>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-red-100/50 text-[10px] text-red-500 font-bold">
                    <div className="flex items-center gap-2">
                      <span>Reportado por: {selectedReport.userName}</span>
                      <button onClick={() => selectedReport.userId && setViewingProfileId(selectedReport.userId)} className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase hover:bg-red-200"><Eye size={8} /> Ver Perfil</button>
                    </div>
                    <span>•</span>
                    <span>{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                  </div>
                  {selectedReport.evidenceUrl && (
                    <div className="mt-2 pt-2 border-t border-red-100/50">
                      <p className="text-[9px] font-black uppercase text-red-400 mb-1 flex items-center gap-1"><ImageIcon size={10} /> Prova do Usuário:</p>
                      <img src={selectedReport.evidenceUrl} alt="Prova do Usuário" className="rounded-xl border border-red-200 max-h-32 object-contain bg-white" />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto no-scrollbar pr-2">
                <div className="space-y-6">
                  {/* Material Card */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">R$ {editingMaterial.price.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ano</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{editingMaterial.year}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Páginas</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{editingMaterial.pageCount || '?'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendas</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{editingMaterial.salesCount}</p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Matéria</p>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">{editingMaterial.subjectText || editingMaterial.subject}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assunto</p>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">{editingMaterial.topic || 'Não especificado'}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Lock size={16} />
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Senha do PDF</p>
                            <p className="text-sm font-mono font-black text-indigo-700 dark:text-indigo-300">{editingMaterial.pdfPassword || 'Sem Senha'}</p>
                          </div>
                        </div>
                        {editingMaterial.fileUrl && (
                          <a
                            href={editingMaterial.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                          >
                            <FileText size={14} /> Abrir PDF
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{editingMaterial.description}</p>
                    </div>
                  </div>

                  {/* Moderation Inputs */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Mensagem ao Autor</label>
                      <textarea
                        value={moderationReason}
                        onChange={e => setModerationReason(e.target.value)}
                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium outline-none min-h-[120px] transition-all focus:border-indigo-500 dark:text-slate-200"
                        placeholder="Justificativa da decisão..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagem de Prova (Opcional)</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-indigo-500 transition-all shadow-sm">
                          <ImageIcon size={18} className="text-indigo-500" /> Anexar Prova
                          <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setModerationEvidence(URL.createObjectURL(f)); }} />
                        </label>
                        {moderationEvidence && (
                          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/10 animate-fade-in">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-black uppercase">Pronto</span>
                            <button onClick={() => setModerationEvidence(null)} className="hover:text-red-500 ml-2"><X size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Reports context if exists */}
                  {selectedReport && (
                    <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-[2rem] space-y-4">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-black text-xs uppercase tracking-wider">
                        <AlertTriangle size={16} /> Denúncia Ativa
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl space-y-2 shadow-sm">
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedReport.reason}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">"{selectedReport.details}"</p>
                      </div>

                      {selectedReport.evidenceUrl && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase text-red-400 flex items-center gap-1"><ImageIcon size={10} /> Prova enviada:</p>
                          <img src={selectedReport.evidenceUrl} alt="Prova" className="rounded-xl border border-red-200 dark:border-red-900 max-h-48 w-full object-cover bg-white dark:bg-slate-900" />
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-bold text-red-400">
                        <span>Por: {selectedReport.userName}</span>
                        <span>{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Decisions */}
                  <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 space-y-4 mt-auto">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center px-4">Escolha a ação definitiva para este conteúdo</p>

                    <button
                      onClick={() => {
                        const finalReason = moderationReason.trim() || "Conteúdo revisado e considerado adequado para a plataforma.";
                        moderateMaterial(editingMaterial.id, 'approved', finalReason, moderationEvidence || undefined);
                        if (selectedReport) resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
                        setEditingMaterial(null);
                        setModerationEvidence(null);
                      }}
                      className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 size={18} /> Aprovar / Manter Ativo
                    </button>

                    <button
                      onClick={() => {
                        const finalReason = moderationReason.trim() || "O conteúdo foi ocultado temporariamente por não atender às diretrizes da comunidade ou estar em revisão.";
                        if (!confirm('Ocultar este material da loja?')) return;
                        moderateMaterial(editingMaterial.id, 'rejected', finalReason, moderationEvidence || undefined);
                        if (selectedReport) resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
                        setEditingMaterial(null);
                        setModerationEvidence(null);
                      }}
                      className="w-full py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      Ocultar Temporário
                    </button>

                    <button
                      onClick={() => {
                        const blockReason = moderationReason.trim() || "Violação recorrente ou grave das diretrizes da plataforma.";
                        const blockMessage = `[CONTEÚDO BLOQUEADO] Seu material foi suspenso. Motivo: "${blockReason}". CASO DISCORDE, VOCÊ TEM 5 DIAS ÚTEIS PARA CONTESTAR. Envie sua justificativa para suporte@concursomestre.com informando o ID #${editingMaterial.id}.`;

                        if (confirm("Bloquear material permanentemente e solicitar contestação?")) {
                          moderateMaterial(editingMaterial.id, 'rejected', blockMessage, moderationEvidence || undefined);
                          if (selectedReport) resolveReport(selectedReport.id, 'resolved', blockReason, moderationEvidence || undefined);
                          setEditingMaterial(null);
                          setModerationEvidence(null);
                        }
                      }}
                      className="w-full py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase hover:bg-red-600 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldAlert size={16} /> Bloquear e Solicitar Contestação
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* Portal Modals as Fragment siblings */}
      {/* MODAL PERFIL ADMIN (VIEW & MANAGE) */}
      {
        viewingProfileId && createPortal(
          <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-white dark:bg-slate-900 rounded-t-[2.4rem] p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                    {detailedUser?.profile?.photo_url ? (
                      <img src={getAssetUrl(detailedUser.profile.photo_url)} alt="Profile" className="w-full h-full object-cover rounded-3xl" />
                    ) : (
                      <User size={40} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display mb-1">
                      {detailedUser?.profile?.name || 'Carregando...'}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{detailedUser?.profile?.email}</span>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${detailedUser?.profile?.billing?.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {detailedUser?.profile?.billing?.status || 'Free'}
                      </span>
                      <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md">ID: {viewingProfileId}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingProfileId(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"><X size={24} /></button>
              </div>

              {isLoadingDetail ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
                  {/* TABS HEADER */}
                  <div className="px-8 pt-6 pb-2 flex gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
                    <button onClick={() => setDetailTab('overview')} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${detailTab === 'overview' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Visão Geral</button>
                    <button onClick={() => setDetailTab('subscription')} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${detailTab === 'subscription' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Assinatura & Planos</button>
                    <button onClick={() => setDetailTab('transactions')} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${detailTab === 'transactions' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Financeiro</button>
                    <button onClick={() => setDetailTab('comments')} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${detailTab === 'comments' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Comentários ({detailedUser?.last_comments?.length || 0})</button>
                  </div>


                  {/* CONTENT BODY */}
                  <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                    {detailTab === 'overview' && detailedUser && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* CARD 1: STATS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3"><Activity size={14} /> Estatísticas</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Nível</p>
                              <p className="text-xl font-black text-slate-800 dark:text-slate-200">{detailedUser.profile?.level || 0}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">XP Total</p>
                              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{detailedUser.profile?.xp || 0}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Comentários</p>
                              <p className="text-xl font-black text-slate-800 dark:text-slate-200">{detailedUser.stats?.comments_count || 0}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Compras</p>
                              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{detailedUser.materials?.length || 0}</p>
                            </div>
                          </div>
                        </div>

                        {/* Coluna 1: Dados da Conta */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-700/50 pb-3">
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 font-display"><Settings size={14} /> Dados da Conta</h4>
                            <button onClick={startEditingUser} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 transition-colors"><Edit2 size={12} /> Editar</button>
                          </div>

                          {isEditingUser ? (
                            <div className="space-y-3 animate-fade-in">
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400">Nome</label>
                                <input type="text" value={editUserForm.name} onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400">Email</label>
                                <input type="email" value={editUserForm.email} onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400">CPF</label>
                                <input type="text" value={editUserForm.cpf} onChange={e => setEditUserForm({ ...editUserForm, cpf: e.target.value })} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400">Telefone</label>
                                <input type="text" value={editUserForm.phone} onChange={e => setEditUserForm({ ...editUserForm, phone: e.target.value })} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400">Concurso Alvo</label>
                                <input type="text" value={editUserForm.targetExam} onChange={e => setEditUserForm({ ...editUserForm, targetExam: e.target.value })} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2" />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-black text-slate-400">Nível de Acesso (Cargo)</label>
                                <select value={(editUserForm as any).role || 'user'} onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value } as any)} className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 outline-none focus:border-indigo-500">
                                  <option value="user">Usuário Comum</option>
                                  <option value="tester">Testador (Acesso Max Vitalício)</option>
                                  <option value="partner">Parceiro (Professor)</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsEditingUser(false)} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10px] font-black uppercase text-slate-500">Cancelar</button>
                                <button onClick={() => handleUserAction('update_profile', editUserForm)} disabled={actionLoading} className="flex-1 py-2 rounded-lg bg-indigo-600 text-[10px] font-black uppercase text-white hover:bg-indigo-700 transition-colors">Salvar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Membro Desde</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                  {detailedUser.profile?.created_at ? new Date(detailedUser.profile.created_at).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Plano Atual</p>
                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                  {detailedUser.subscriptions?.find((s: any) => s.status === 'active')?.plan_name || 'Gratuito'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">CPF</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{detailedUser.profile?.cpf || 'Não informado'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Concurso Alvo</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{detailedUser.profile?.target_exam || 'Não informado'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Resumo de Atividade</p>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                  <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <p className="text-[9px] uppercase text-slate-400 font-bold">Assinaturas</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{detailedUser.subscriptions?.length || 0}</p>
                                  </div>
                                  <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <p className="text-[9px] uppercase text-slate-400 font-bold">Materiais</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{detailedUser.materials?.length || 0}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 flex flex-col gap-2">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contato Rápido</p>
                                <div className="flex gap-2">
                                  <a
                                    href={`mailto:${detailedUser.profile?.email}`}
                                    className="flex-1 py-2 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                                  >
                                    <Mail size={14} /> <span className="text-[10px] font-black uppercase">Email</span>
                                  </a>
                                  {detailedUser.profile?.phone && (
                                    <a
                                      href={`https://wa.me/55${detailedUser.profile.phone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex-1 py-2 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 transition-colors"
                                    >
                                      <MessageCircle size={14} /> <span className="text-[10px] font-black uppercase">WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                            </div>
                          )}
                        </div>
                        {/* CARD 2: PERSONAL INFO */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3"><User size={14} /> Dados Pessoais</h4>
                          <div className="space-y-3">
                            <div><p className="text-[10px] font-black text-slate-400 uppercase">CPF</p><p className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">{detailedUser.profile?.cpf || '-'}</p></div>
                            {/* Phone not in DB */}
                            <div><p className="text-[10px] font-black text-slate-400 uppercase">Concurso Alvo</p><p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{detailedUser.profile?.target_exam || '-'}</p></div>
                          </div>
                        </div>

                        {/* CARD 3: ADDRESS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3"><MapPin size={14} /> Endereço</h4>
                          {detailedUser.profile?.address ? (
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400 space-y-1">
                              <p>{detailedUser.profile?.address?.street}, {detailedUser.profile?.address?.number} {detailedUser.profile?.address?.complement ? `- ${detailedUser.profile?.address?.complement}` : ''}</p>
                              <p>{detailedUser.profile?.address?.neighborhood}</p>
                              <p>{detailedUser.profile?.address?.city} - {detailedUser.profile?.address?.state}</p>
                              <p className="font-mono text-xs text-slate-400">{detailedUser.profile?.address?.zipCode}</p>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-sm">Endereço não cadastrado.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {detailTab === 'subscription' && detailedUser && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-6">Plano Atual</h4>
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                                {detailedUser.subscriptions?.find((s: any) => s.status === 'active')?.plan_name?.[0] || 'G'}
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                                  {detailedUser.subscriptions?.find((s: any) => s.status === 'active')?.plan_name || 'Gratuito'}
                                </h3>
                                <p className={`text-xs font-bold uppercase ${detailedUser.subscriptions?.find((s: any) => s.status === 'active') ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  Status: {detailedUser.subscriptions?.find((s: any) => s.status === 'active')?.status || 'Inativo'}
                                </p>
                              </div>
                            </div>
                            {detailedUser.subscriptions?.find((s: any) => s.status === 'active')?.current_period_end && (
                              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expira em / Renovação</p>
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono">
                                  {new Date(detailedUser.subscriptions.find((s: any) => s.status === 'active').current_period_end).toLocaleDateString()}
                                </p>
                              </div>
                            )}

                            <div className="space-y-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações Rápidas</p>
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  const days = prompt("Quantos dias deseja adicionar?");
                                  if (days) handleUserAction('add_days', { days });
                                }} className="flex-1 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center gap-2"><PlusCircle size={14} /> Add Dias</button>

                                <button onClick={() => {
                                  // Simple prompt for now, could be a select modal
                                  const planId = prompt("ID do Plano para Upgrade (1=Essencial, 2=Pro, 3=Elite):");
                                  if (planId) handleUserAction('upgrade_plan', { plan_id: planId });
                                }} className="flex-1 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all flex items-center justify-center gap-2"><ArrowUpCircle size={14} /> Upgrade</button>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4">Histórico de Assinaturas</h4>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                              {detailedUser.subscriptions?.map((sub: any) => (
                                <div key={sub.id} className="p-3 border border-slate-100 dark:border-slate-700 rounded-xl flex justify-between items-center">
                                  <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{sub.plan_name}</p>
                                    <p className="text-[10px] text-slate-400">{new Date(sub.created_at).toLocaleDateString()} - {new Date(sub.current_period_end).toLocaleDateString()}</p>
                                  </div>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{sub.status}</span>
                                </div>
                              ))}
                              {!detailedUser.subscriptions?.length && <p className="text-slate-400 italic text-xs">Sem histórico.</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === 'transactions' && detailedUser && (
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 mb-4"><DollarSign size={14} /> Histórico Financeiro Completo</h4>
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 uppercase font-black">
                            <tr>
                              <th className="p-3 rounded-l-xl">Data</th>
                              <th className="p-3">Tipo</th>
                              <th className="p-3">Valor</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 rounded-r-xl text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {detailedUser.transactions?.map((t: any) => (
                              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="p-3 text-slate-500 font-mono">{new Date(t.created_at).toLocaleDateString()}</td>
                                <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                                  {t.type === 'plan' ? `Assinatura` : (t.type === 'material_purchase' ? 'Compra Material' : 'Venda Material')}
                                </td>
                                <td className={`p-3 font-black ${t.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                  R$ {Math.abs(t.amount).toFixed(2)}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${(t.status === 'completed' || t.status === 'approved') ? 'bg-emerald-100 text-emerald-700' : t.status === 'refunded' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                      {t.status}
                                    </span>
                                    {t.type === 'plan' && (
                                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1">
                                        <Crown size={8} /> Assinatura
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {(t.status === 'completed' || t.status === 'approved') && t.amount > 0 && (
                                      <>
                                        <button
                                          onClick={() => {
                                            if (confirm("Deseja emitir Nota Fiscal para esta transação?")) handleUserAction('issue_invoice', { transaction_id: t.id });
                                          }}
                                          disabled={actionLoading}
                                          className="p-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all border border-slate-100 dark:border-slate-800"
                                          title="Emitir Nota Fiscal"
                                        >
                                          <FileText size={14} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm("Tem certeza que deseja estornar esta transação?")) handleUserAction('refund_transaction', { transaction_id: t.id });
                                          }}
                                          disabled={actionLoading}
                                          className="p-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all border border-slate-100 dark:border-slate-800"
                                          title="Estornar Transação"
                                        >
                                          <RefreshCcw size={14} />
                                        </button>
                                      </>
                                    )}
                                    {(t.type === 'material_purchase' || t.type === 'material_sale') && (
                                      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[9px] font-black uppercase border border-blue-100 dark:border-blue-800/30" title="Transferência Segura Ativa">
                                        <Zap size={10} /> Transfer.
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!detailedUser.transactions?.length && <p className="text-center text-slate-400 py-8 italic">Nenhuma transação registrada.</p>}
                      </div>
                    )}

                    {/* ABAS COMENTÁRIOS */}
                    {detailTab === 'comments' && detailedUser && (
                      <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14} className="text-indigo-500" /> Histórico de Comentários (Últimos 50)</h4>
                          <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30">Total: {detailedUser.stats?.comments_count || 0}</span>
                        </div>

                        {detailedUser.last_comments && detailedUser.last_comments.length > 0 ? (
                          <div className="space-y-4">
                            {detailedUser.last_comments.map((comment: any) => (
                              <div key={comment.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={10} /> {new Date(comment.created_at).toLocaleString()}
                                  </span>
                                  <Link
                                    to={`/questoes?q=${comment.question_id}`}
                                    target="_blank"
                                    className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1"
                                  >
                                    Q{comment.question_id} <LinkIcon size={10} />
                                  </Link>
                                </div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed pl-3 border-l-2 border-slate-100 dark:border-slate-700">
                                  "{comment.comment}"
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700 border-dashed">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-3"><MessageSquare size={20} /></div>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhum comentário encontrado</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      }

      {/* --- MODAL DE EDIÇÃO DE RANKING --- */}
      {
        editingRanking && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
              <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Editar Ranking</h3>
                    <p className="text-xs text-slate-500 font-medium">Ajuste as configurações e regras do ranking.</p>
                  </div>
                </div>
                <button onClick={() => setEditingRanking(null)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"><X size={20} /></button>
              </header>

              <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome do Ranking</label>
                    <input
                      type="text"
                      value={editingRanking.name}
                      onChange={e => setEditingRanking({ ...editingRanking, name: e.target.value })}
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Instituição</label>
                    <input
                      type="text"
                      value={editingRanking.institution}
                      onChange={e => setEditingRanking({ ...editingRanking, institution: e.target.value })}
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Vagas Imediatas</label>
                    <input
                      type="number"
                      value={editingRanking.vacancies}
                      onChange={e => setEditingRanking({ ...editingRanking, vacancies: Number(e.target.value) })}
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Vagas Reserva</label>
                    <input
                      type="number"
                      value={editingRanking.reserveLimit}
                      onChange={e => setEditingRanking({ ...editingRanking, reserveLimit: Number(e.target.value) })}
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Total de Questões</label>
                    <input
                      type="number"
                      value={editingRanking.totalQuestions}
                      onChange={e => setEditingRanking({ ...editingRanking, totalQuestions: Number(e.target.value) })}
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Status do Gabarito</label>
                    <select
                      value={editingRanking.keyStatus}
                      onChange={e => setEditingRanking({ ...editingRanking, keyStatus: e.target.value })}
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="pending">Pendente / Preliminar</option>
                      <option value="official">Oficial</option>
                    </select>
                  </div>
                </div>
              </div>

              <footer className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex justify-end gap-3">
                <button onClick={() => setEditingRanking(null)} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Cancelar</button>
                <button onClick={handleSaveRanking} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2">
                  <Save size={16} /> Salvar Alterações
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )
      }

      {/* --- MODAL UNIVERSAL DE TAXONOMIA (FILTROS) --- */}
      {
        showTaxonomyModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col animate-fade-in">
            <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Filter size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    {editingFilterItem ? 'Editar Filtro' : 'Novo Filtro'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Configure as propriedades da taxonomia.</p>
                </div>
              </div>
              <button onClick={cancelEditingFilter} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                <X size={20} /> Fechar
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto p-8 space-y-8">
                {/* Tipo de Filtro */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Filtro</label>
                  <select
                    disabled={!!editingFilterItem}
                    value={editingFilterItem?.type || activeFilterType}
                    onChange={e => setActiveFilterType(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  >
                    {filterTypes.map(t => t.key !== 'all' && <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>

                {/* Nome do Item */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome / Título</label>
                  <input
                    type="text"
                    autoFocus
                    value={filterInput}
                    onChange={e => setFilterInput(e.target.value)}
                    placeholder="Ex: Direito Administrativo, FGV..."
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Slug (URL) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Slug (URL amigável)</label>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase"><LinkIcon size={10} /> Automático</div>
                  </div>
                  <input
                    type="text"
                    value={filterSlug}
                    onChange={e => setFilterSlug(e.target.value)}
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Descrição e Site (Somente para Bancas) */}
                {(editingFilterItem?.type || activeFilterType) === 'banca' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Descrição (Contexto)</label>
                      <textarea
                        value={filterDescription}
                        onChange={e => setFilterDescription(e.target.value)}
                        placeholder="Informações adicionais sobre esta banca..."
                        className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Site Oficial (URL)</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="url"
                          value={filterWebsite}
                          onChange={e => setFilterWebsite(e.target.value)}
                          placeholder="https://exemplo.com.br"
                          className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Item Pai (Root Filter) - Habilitado para todos os tipos agora */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Filtro Raiz / Item Pai (Opcional)</label>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Hierarquia</span>
                  </div>
                  <select
                    value={selectedParentId || ''}
                    onChange={e => setSelectedParentId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Nenhum (Item Raiz)</option>
                    {(() => {
                      const currentType = editingFilterItem?.type || activeFilterType;
                      if (!systemSettings.taxonomies) return null;
                      const t = systemSettings.taxonomies;

                      let list: any[] = [];
                      switch (currentType) {
                        case 'banca': list = t.agencies || []; break;
                        case 'orgao': list = t.organizations || []; break;
                        case 'cargo': list = t.roles || []; break;
                        case 'assunto': list = [...(t.subjects || []), ...(t.topics || [])]; break;
                        case 'carreira': list = t.careers || []; break;
                        case 'area': list = t.areas || []; break;
                        default: list = [];
                      }

                      return list
                        .filter((s: any) => s.id !== editingFilterItem?.id)
                        .map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ));
                    })()}
                  </select>
                </div>
              </div>
            </div>

            <footer className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
              <div className="max-w-3xl mx-auto flex justify-end gap-3">
                <button onClick={cancelEditingFilter} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Cancelar</button>
                <button
                  onClick={handleSaveFilter}
                  disabled={!filterInput.trim() || !filterSlug.trim()}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} /> {editingFilterItem ? 'Salvar Alterações' : 'Criar Item'}
                </button>
              </div>
            </footer>
          </div>,
          document.body
        )
      }
    </div>
  );
};

const Admin: React.FC = () => {
  const {
    questions, users, systemSettings, reports, rankings,
    addQuestion, addQuestions, updateQuestion, deleteQuestion, resolveReport,
    updateUserStatus, updateSystemSettings, addCoupon, deleteCoupon, updateRanking,
    notifications, markNotificationAsRead,
    // Lazy Load Fetchers
    ensureUsersLoaded, ensureReportsLoaded, ensureRankingsLoaded, ensureTaxonomiesLoaded
  } = useData();

  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = (notifications || []).filter(n => !n.isRead && !n.deletedAt).length;

  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const userLevel = currentUser?.level || 0;

  const handleNotificationClick = (n: any) => {
    markNotificationAsRead(n.id);
    if (n.link) navigate(n.link);
    setIsNotifOpen(false);
  };

  const { materials, transactions, moderateMaterial, deleteMaterial } = useMarketplace();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'database' | 'finance' | 'marketing' | 'settings' | 'feedback'>('dashboard');
  const [initialDbTab, setInitialDbTab] = useState('questions');
  const [initialFinanceSection, setInitialFinanceSection] = useState('balance');

  const adminTabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'database', label: 'Base de Dados', icon: Database },
    { key: 'finance', label: 'Financeiro', icon: DollarSign },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare },
    { key: 'settings', label: 'Configurações', icon: Settings },
  ];

  useEffect(() => {
    if (searchParams.get('tab')) {
      const section = searchParams.get('tab');
      setActiveTab(section as any);
    }
    
    // Lazy Load Essential Admin Data
    ensureUsersLoaded();
    ensureReportsLoaded();
    ensureRankingsLoaded();
    ensureTaxonomiesLoaded();
  }, [searchParams, ensureUsersLoaded, ensureReportsLoaded, ensureRankingsLoaded, ensureTaxonomiesLoaded]);

  return (
    <div className="flex h-[100dvh] max-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
      <div className="flex-none w-64 md:fixed h-[100dvh] max-h-screen z-50 overflow-hidden">
        <DashboardSidebar
          type="admin"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={adminTabs}
        />
      </div>
      <div className="flex-1 ml-0 md:ml-64 flex flex-col min-w-0 transition-colors duration-300 overflow-hidden">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors shrink-0">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex h-20 items-center justify-between gap-8">
              <div className="flex items-center gap-3">
                {/* Spacer/Empty div to maintain layout since logo was removed */}
              </div>

              {/* Actions & User */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="p-3 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                >
                  {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {systemSettings?.features?.notificationsEnabled && (
                  <div className="relative">
                    <button
                      onClick={() => setIsNotifOpen(!isNotifOpen)}
                      className="p-3 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                    >
                      <Bell size={20} />
                      {unreadCount > 0 && <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
                    </button>
                    {isNotifOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                        <div className="absolute right-0 top-full mt-2">
                          <NotificationDropdown
                            notifications={notifications}
                            markNotificationAsRead={markNotificationAsRead}
                            unreadCount={unreadCount}
                            setIsNotifOpen={setIsNotifOpen}
                            navigate={navigate}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/profile')}>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">{currentUser?.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Master Admin</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg group-hover:scale-105 transition-all">
                    {userInitials}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>


        <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 animate-fade-in overflow-y-auto no-scrollbar">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="text-rose-600" />
                  {adminTabs.find(t => t.key === activeTab)?.label}
                </h1>
                <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest border border-rose-200 dark:border-rose-800">Admin</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Gestão completa da plataforma.</p>
            </div>
          </header>

          <div className="min-h-[500px]">
            {activeTab === 'dashboard' && <AdminDashboard
              questions={questions}
              allMaterials={materials}
              allTransactions={transactions}
              allUsers={users}
              systemSettings={systemSettings}
              allReports={reports}
              allRankings={rankings}
              onNavigate={(tab: string, subTab?: string) => {
                if (tab === 'database' && subTab) setInitialDbTab(subTab);
                if (tab === 'finance' && subTab) setInitialFinanceSection(subTab);
                setActiveTab(tab as any);
              }}
            />}
            {activeTab === 'database' && (
              <AdminDatabaseManager
                questions={questions} allUsers={users} allMaterials={materials} allReports={reports} allTransactions={transactions} rankings={rankings}
                onDeleteQuestion={deleteQuestion} onAddQuestion={addQuestion} onAddQuestions={addQuestions} onUpdateQuestion={updateQuestion}
                resolveReport={resolveReport} updateUserStatus={updateUserStatus} moderateMaterial={moderateMaterial}
                onDeleteMaterial={deleteMaterial} systemSettings={systemSettings} updateSystemSettings={updateSystemSettings}
                updateRanking={updateRanking}
                initialTab={initialDbTab}
                key={initialDbTab} // Force re-render when initialTab changes
              />
            )}
            {activeTab === 'finance' && (
              <AdminFinance
                allTransactions={transactions}
                allUsers={users}
                systemSettings={systemSettings}
                updateSystemSettings={updateSystemSettings}
                addCoupon={addCoupon}
                deleteCoupon={deleteCoupon}
                initialSection={initialFinanceSection}
                key={initialFinanceSection}
              />
            )}
            {activeTab === 'feedback' && (
              <AdminFeedback />
            )}
            {activeTab === 'settings' && (
              <AdminSettings
                systemSettings={systemSettings}
                updateSystemSettings={updateSystemSettings}
                addToast={addToast}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
