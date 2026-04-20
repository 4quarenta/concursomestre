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

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Home,
  Layers,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  RefreshCcw,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Terminal,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
  FileText,
} from 'lucide-react';
import type { SystemSettings } from '@types';
import { adminService } from '@services/admin/adminService';

interface AdminDashboardProps {
  questions: any[];
  allMaterials: any[];
  allTransactions: any[];
  allUsers: any[];
  systemSettings: SystemSettings;
  allReports: any[];
  allRankings: any[];
  onNavigate?: (tab: string, subTab?: string) => void;
}

const ADMIN_PAID_TRANSACTION_STATUSES = new Set(['completed', 'approved']);

const isAdminPaidTransaction = (transaction: any) => ADMIN_PAID_TRANSACTION_STATUSES.has(String(transaction?.status || '').toLowerCase());

const isAdminSubscriptionTransaction = (transaction: any) => {
  const type = String(transaction?.type || '').toLowerCase();
  return type === 'plan' || type === 'subscription' || (!type && !transaction?.material_id && !transaction?.materialId);
};

const readAdminTransactionAmount = (transaction: any) => Number(transaction?.amount || 0);

const readAdminTransactionPlatformFee = (transaction: any) => {
  const amount = readAdminTransactionAmount(transaction);
  const fee = Number(transaction?.platformFee ?? transaction?.platform_fee);
  return Number.isFinite(fee) && fee > 0 ? fee : amount * 0.20;
};

const isAdminMarketplaceTransaction = (transaction: any) => {
  const type = String(transaction?.type || '').toLowerCase();
  return type !== 'plan'
    && type !== 'subscription'
    && Boolean(transaction?.sellerId || transaction?.seller_id || transaction?.materialId || transaction?.material_id);
};

const isAdminHeldTransaction = (transaction: any) => {
  const timestamp = Number(transaction?.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;

  return (Date.now() - timestamp) < (7 * 24 * 60 * 60 * 1000);
};

const isAdminSellerPayoutPaid = (transaction: any) => {
  const booleanFlags = [
    transaction?.sellerPaid,
    transaction?.seller_paid,
    transaction?.paidToSeller,
    transaction?.paid_to_seller,
    transaction?.paidOut,
    transaction?.paid_out,
  ];

  if (booleanFlags.some((flag) => flag === true || flag === 1 || flag === '1')) {
    return true;
  }

  const statusFlags = [
    transaction?.sellerPayoutStatus,
    transaction?.seller_payout_status,
    transaction?.payoutStatus,
    transaction?.payout_status,
  ];

  if (statusFlags.some((status) => ['paid', 'completed', 'processed', 'sent'].includes(String(status || '').toLowerCase()))) {
    return true;
  }

  const dateFlags = [
    transaction?.sellerPaidAt,
    transaction?.seller_paid_at,
    transaction?.paidToSellerAt,
    transaction?.paid_to_seller_at,
    transaction?.payoutDate,
    transaction?.payout_date,
  ];

  return dateFlags.some((value) => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  });
};

/**
 * Painel executivo do admin.
 * Reúne KPIs, atalhos operacionais e a auditoria visual financeira sem
 * acoplar essa lógica ao arquivo principal do painel.
 */
/**
 * Painel executivo do admin.
 * Reune KPIs, atalhos operacionais e a auditoria visual financeira sem
 * acoplar essa logica ao arquivo principal do painel.
 * @since v1.0.0
 */
const AdminDashboard = ({
  questions,
  allMaterials,
  allTransactions,
  allUsers,
  systemSettings,
  allReports,
  allRankings,
  onNavigate,
}: AdminDashboardProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Filtra colecoes do dashboard pelo período selecionado no topo do painel.
   * Essa regra abastece cards, tabelas e alertas da home administrativa.
   * @since v1.0.0
   */
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
    const nowTime = now.getTime();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = nowTime - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = nowTime - (30 * 24 * 60 * 60 * 1000);
    const startOfYear = nowTime - (365 * 24 * 60 * 60 * 1000);

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
  // --- STATE FOR AVAILABLE VALUES TOGGLE ---
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const [stats, setStats] = useState({
    total_revenue: 0,
    platform_revenue: 0,
    subscription_revenue: 0,
    marketplace_revenue: 0,
    active_subscriptions: 0,
    cancelled_subscriptions: 0,
    expired_subscriptions: 0,
    trial_subscriptions: 0,
    mrr: 0,
    new_users: 0,
    seller_payout: 0,
    total_refunded: 0,
    refund_requests_count: 0,
    refund_requested_amount: 0,
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
    // Carrega as métricas do dashboard pelo serviço administrativo oficial.
    setLoading(true);
    adminService.getStats({
      period: selectedPeriod,
      startDate: customStartDate || undefined,
      endDate: customEndDate || undefined,
    })
      .then((data) => {
        setStats(data);
      })
      .catch(err => console.error('Error fetching admin stats:', err))
      .finally(() => setLoading(false));
  }, [selectedPeriod, customStartDate, customEndDate]);




  // --- CALCULATE FINANCE OVERVIEW ---
  const financeOverview = useMemo(() => {
    return {
      totalRevenue: stats.total_revenue,
      platformTotalRevenue: stats.platform_revenue,
      sellerPayout: stats.seller_payout,
      activeSubscriptions: stats.active_subscriptions,
      subscriptionRevenue: stats.mrr, // Using MRR for the estimate display
      platformFees: stats.platform_revenue - stats.subscription_revenue,
      refundRequestsCount: stats.refund_requests_count,
    };
  }, [stats]);

  const sellerTransferOverview = useMemo(() => {
    const summary = (filteredTransactions || []).reduce((acc, transaction: any) => {
      if (!isAdminPaidTransaction(transaction) || !isAdminMarketplaceTransaction(transaction)) {
        return acc;
      }

      const sellerShare = Math.max(0, readAdminTransactionAmount(transaction) - readAdminTransactionPlatformFee(transaction));
      if (sellerShare <= 0) return acc;

      if (isAdminSellerPayoutPaid(transaction)) {
        acc.paid += sellerShare;
        return acc;
      }

      if (isAdminHeldTransaction(transaction)) {
        acc.held += sellerShare;
      } else {
        acc.available += sellerShare;
      }

      return acc;
    }, {
      available: 0,
      held: 0,
      paid: 0,
    });

    return {
      ...summary,
      totalPending: summary.available + summary.held,
    };
  }, [filteredTransactions]);

  const auditPlatformRevenueOverview = useMemo(() => {
    return (filteredTransactions || []).reduce((acc, transaction: any) => {
      if (!isAdminPaidTransaction(transaction)) {
        return acc;
      }

      const amount = readAdminTransactionAmount(transaction);
      const platformShare = isAdminSubscriptionTransaction(transaction)
        ? amount
        : readAdminTransactionPlatformFee(transaction);

      if (platformShare <= 0) {
        return acc;
      }

      if (isAdminHeldTransaction(transaction)) {
        acc.held += platformShare;
      } else {
        acc.available += platformShare;
      }

      acc.total += platformShare;
      return acc;
    }, {
      available: 0,
      held: 0,
      total: 0,
    });
  }, [filteredTransactions]);


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
          <div className="mt-1 text-[10px] text-amber-500 font-black uppercase tracking-widest">
            R$ {stats.refund_requested_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em analise
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
              R$ {(showAvailableOnly ? Math.max(0, stats.total_revenue - stats.held_balance) : stats.total_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
              R$ {sellerTransferOverview.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-2 text-[9px] text-blue-400 font-bold uppercase">Repasses Confirmados</div>
          </div>

          {/* Seller Payout */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full opacity-30 pointer-events-none" />
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 relative z-10">
              {showAvailableOnly ? 'A Repassar Disponível' : 'Valor para Repassar aos Vendedores'}
            </p>
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 relative z-10">
              R$ {(showAvailableOnly ? sellerTransferOverview.available : sellerTransferOverview.totalPending).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <div className="mt-2 text-[9px] text-slate-400 font-bold uppercase relative z-10">Venda de Materiais</div>
          </div>

          {/* Held Balance */}
          <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30">
            <p className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-1">Valor Retido (7 dias Reembolso)</p>
            <h3 className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {sellerTransferOverview.held.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
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
                          <p className="font-black text-amber-900 dark:text-amber-300">Retenção de 7 Dias</p>
                          <p className="text-xs text-amber-700/70">O valor fica retido apenas durante a janela de possível reembolso. Depois disso, o saldo deixa de ser retido e segue o fluxo operacional de pagamento.</p>
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
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Receita Líquida Fora da Retenção</p>
                    <p className="text-5xl font-black tracking-tighter">R$ {auditPlatformRevenueOverview.available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
                    Total Liquidadas: {filteredTransactions?.filter(isAdminPaidTransaction).length}
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
                        {(filteredTransactions || []).filter((t: any) => isAdminPaidTransaction(t) || t.status === 'refunded' || t.status === 'refund_requested').sort((a: any, b: any) => b.timestamp - a.timestamp).map((t: any) => {
                          const isRefunded = t.status === 'refunded';
                          const isRefundRequested = t.status === 'refund_requested';
                          const isSub = isAdminSubscriptionTransaction(t);
                          const amount = readAdminTransactionAmount(t);
                          const fee = isSub ? amount : readAdminTransactionPlatformFee(t);
                          const seller = isSub ? 0 : Math.max(0, amount - fee);
                          const isHeld = isAdminPaidTransaction(t) && isAdminHeldTransaction(t);

                          return (
                            <tr key={t.id} className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-300 ${isRefunded || isRefundRequested ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                              <td className="pl-10 pr-6 py-6">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all transform group-hover:rotate-6 ${isRefunded || isRefundRequested ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-500 group-hover:text-white'}`}>
                                    {isRefunded || isRefundRequested ? <RefreshCcw size={18} /> : <Home size={18} />}
                                  </div>
                                  <div>
                                    <p className={`text-[11px] font-black ${isRefunded || isRefundRequested ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>#TR-{t.id}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(t.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6 text-center">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isRefunded || isRefundRequested ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : isSub ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                  {isSub ? 'Assinatura' : 'Material'}
                                </span>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <span className={`text-[13px] font-black ${isRefunded || isRefundRequested ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <span className={`text-[12px] font-bold ${isRefunded || isRefundRequested ? 'text-slate-400 line-through' : isSub ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 font-medium'}`}>
                                  R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="px-6 py-6 text-right font-bold">
                                <span className={`${isRefunded || isRefundRequested ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {seller > 0 ? `R$ ${seller.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                </span>
                              </td>
                              <td className="pr-10 pl-6 py-6">
                                <div className="flex justify-center">
                                  {t.status === 'refunded' ? (
                                    <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-900/30 flex items-center gap-2">
                                      <XCircle size={12} /> Estornado
                                    </div>
                                  ) : isRefundRequested ? (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                                      <Clock size={12} /> Em analise
                                    </div>
                                  ) : isHeld ? (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                                      <Clock size={12} className="animate-pulse" /> Retido (7 dias)
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

export default AdminDashboard;
