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
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  CreditCard,
  Download,
  FileText,
  Globe,
  Loader2,
  Lock,
  Megaphone,
  Palette,
  Percent,
  QrCode,
  RefreshCcw,
  Save,
  ShoppingBag,
  Tag,
  Terminal,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import type { AppPromotionTheme, PlanBenefitKey, SystemSettings, UserProfile } from '@types';
import { adminService } from '@services/admin/adminService';
import { subscriptionsService } from '@services/subscriptions';
import { themeConfig } from '@constants/themes';
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  PLAN_BENEFIT_DEFINITIONS,
  PLAN_ORDER,
  normalizePlanEntitlements,
} from '@constants/subscriptions/planEntitlements';

type AdminToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

interface AdminFinanceProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  allTransactions: any[];
  allUsers: UserProfile[];
  initialSection?: 'balance' | 'transactions' | 'refunds' | 'prices' | 'marketing' | 'automation';
  addCoupon: (coupon: { code: string; discountPercentage: number; maxUses: number }) => void;
  deleteCoupon: (couponCode: string) => void;
}

/**
 * SubmÃ³dulo financeiro e de marketing do painel administrativo.
 * MantÃ©m o domÃ­nio comercial isolado do arquivo principal do admin,
 * preservando filtros, pricing, automaÃ§Ã£o e operaÃ§Ã£o financeira.
 */
const AdminMarketing = ({ systemSettings, updateSystemSettings, addCoupon, deleteCoupon }: Pick<AdminFinanceProps, 'systemSettings' | 'updateSystemSettings' | 'addCoupon' | 'deleteCoupon'>) => {
  const { addToast } = useToast();
  const [activeSection, setActiveSection] = useState<'coupons' | 'promo' | 'themes'>('coupons');
  const [newCoupon, setNewCoupon] = useState({ code: '', discountPercentage: 10, maxUses: 100 });

  const themes: { value: AppPromotionTheme; label: string }[] = [
    { value: 'default', label: 'PadrÃ£o (Azul/Slate)' },
    { value: 'black-friday', label: 'Black Friday (Preto/Roxo)' },
    { value: 'black-november', label: 'Black November' },
    { value: 'estudante', label: 'Dia do Estudante' },
    { value: 'sao-joao', label: 'SÃ£o JoÃ£o' },
    { value: 'carnaval', label: 'Carnaval' },
    { value: 'ano-novo', label: 'Ano Novo' },
    { value: 'pascoa', label: 'PÃ¡scoa' },
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
            <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CÃ³digo</label><input type="text" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-black uppercase bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 transition-colors" placeholder="EX: APROVADO20" /></div>
            <div className="w-32 space-y-1"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Desconto (%)</label><input type="number" value={newCoupon.discountPercentage} onChange={e => setNewCoupon({ ...newCoupon, discountPercentage: Number(e.target.value) })} className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 transition-colors" /></div>
            <button onClick={() => { addCoupon(newCoupon); setNewCoupon({ code: '', discountPercentage: 10, maxUses: 100 }); }} className="h-10 px-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all">Criar Cupom</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemSettings.coupons.map((coupon: any) => (
              <div key={coupon.code} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                <div><h4 className="font-black text-slate-900 dark:text-slate-100">{coupon.code}</h4><p className="text-xs text-slate-500 dark:text-slate-400">{coupon.discountPercentage}% OFF â€¢ {coupon.uses} usos</p></div>
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
                <Zap size={14} /> Preview da NotificaÃ§Ã£o
              </h4>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{systemSettings.activePromotion.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{systemSettings.activePromotion.bannerText}</p>
              </div>
              <button
                onClick={() => addToast("`NotificaÃ§Ã£o enviada!", "error")}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
              >
                Disparar para todos os usuÃ¡rios
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
                    {id === 'default' ? 'PadrÃ£o (Modern)' : id === 'black-friday' ? 'Black Friday' : id === 'black-november' ? 'Black November' : id === 'estudante' ? 'Dia do Estudante' : id === 'sao-joao' ? 'SÃ£o JoÃ£o' : id === 'carnaval' ? 'Carnaval' : id === 'ano-novo' ? 'Ano Novo' : id === 'pascoa' ? 'PÃ¡scoa' : 'Semana do Consumidor'}
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
                A alteraÃ§Ã£o do tema impacta imediatamente a Landing Page e elementos decorativos em toda a plataforma (banners, badges e destaques). O sistema de cores light/dark continua funcionando de forma complementar ao tema selecionado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminFinance = ({
  systemSettings,
  updateSystemSettings,
  allTransactions,
  allUsers,
  initialSection = 'balance',
  addCoupon,
  deleteCoupon,
}: AdminFinanceProps) => {
  const { addToast } = useToast();
  const { saveSystemSettingsNow } = useData();
  const [activeSection, setActiveSection] = useState<'balance' | 'transactions' | 'refunds' | 'prices' | 'marketing' | 'automation'>(initialSection as any);
  const [financeFilters, setFinanceFilters] = useState({ search: '', status: 'all', dateRange: 'all' });
  const [currentPage, setCurrentPage] = useState(1);
  const [refundActionKey, setRefundActionKey] = useState<string | null>(null);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [automationHelper, setAutomationHelper] = useState<any | null>(null);
  const [automationHelperLoading, setAutomationHelperLoading] = useState(false);
  const refundRequests = useMemo(() => allTransactions?.filter((t: any) => t.status === 'refund_requested') || [], [allTransactions]);

  const totalInDispute = useMemo(() => refundRequests.reduce((acc: number, t: any) => acc + t.amount, 0), [refundRequests]);
  const totalRefunded = useMemo(() => allTransactions?.filter((t: any) => t.status === 'refunded').reduce((acc: number, t: any) => acc + t.amount, 0) || 0, [allTransactions]);

  // --- NOVOS CALCULOS POR VENDEDOR ---
  const [sellersMetrics, setSellersMetrics] = useState<any[]>([]);
  const [viewingSellerDetails, setViewingSellerDetails] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'available_desc' | 'available_asc' | 'date_asc' | 'date_desc'>('available_desc');
  const paymentProvider = (systemSettings.paymentProvider || 'mercado_pago') as 'mercado_pago' | 'stripe';
  const automationDownloadUrl = automationHelper?.download_url || '';
  const automationCronUrl = automationHelper?.cron_url || '';
  const automationCronCommand = automationHelper?.linux_command || '';

  useEffect(() => {
    if (!allTransactions || !allUsers) return;

    const metricsBySeller: Record<string, any> = {};
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. Identificar todos os vendedores que tÃªm transaÃ§Ãµes
    allTransactions.forEach((t: any) => {
      if (!metricsBySeller[t.sellerId]) {
        const seller = allUsers.find((u: any) => u.id === t.sellerId);
        metricsBySeller[t.sellerId] = {
          id: t.sellerId,
          name: seller?.name || 'Desconhecido',
          email: seller?.email || '-',
          paymentDay: seller?.billing?.paymentDay || Math.floor(Math.random() * 28) + 1, // Mock se nÃ£o existir
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

  useEffect(() => {
    if (activeSection !== 'automation' || automationHelper || automationHelperLoading) return;

    let cancelled = false;
    setAutomationHelperLoading(true);

    subscriptionsService.getAutomationHelperInfo()
      .then((payload) => {
        if (!cancelled) {
          setAutomationHelper(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          addToast('Nao foi possivel carregar as instrucoes oficiais de automacao.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAutomationHelperLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, automationHelper, automationHelperLoading, addToast]);

  const sortedSellers = useMemo(() => {
    return [...sellersMetrics].sort((a, b) => {
      if (sortBy === 'available_desc') return b.availablePayout - a.availablePayout;
      if (sortBy === 'available_asc') return a.availablePayout - b.availablePayout;
      if (sortBy === 'date_asc') return a.paymentDay - b.paymentDay;
      if (sortBy === 'date_desc') return b.paymentDay - a.paymentDay;
      return 0;
    });
  }, [sellersMetrics, sortBy]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>(['completed', 'approved', 'pending', 'pre-approved', 'refunded', 'refund_requested', 'cancelled']);
    (allTransactions || []).forEach((transaction: any) => {
      const status = String(transaction.status || '').trim();
      if (status) statuses.add(status);
    });

    return Array.from(statuses);
  }, [allTransactions]);

  const formatTransactionStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'ConcluÃ­do';
      case 'pre-approved':
      case 'scheduled':
        return 'PrÃ©-aprovado';
      case 'refund_requested':
        return 'Em disputa';
      case 'refunded':
        return 'Reembolsado';
      case 'cancelled':
        return 'Cancelado';
      case 'pending':
        return 'Pendente';
      default:
        return status || 'N/A';
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    return allTransactions
      .filter((transaction: any) => {
        if (financeFilters.search) {
          const searchLower = financeFilters.search.toLowerCase();
          const haystack = [
            transaction.id,
            transaction.internalId,
            transaction.externalId,
            transaction.referenceId,
            transaction.providerTransactionId,
            transaction.providerInvoiceId,
            transaction.transactionName,
            transaction.planName,
            transaction.materialTitle,
            transaction.description,
            transaction.buyerName,
            transaction.buyerEmail,
            transaction.sellerName,
            transaction.sellerEmail,
            transaction.paymentMethod,
            transaction.paymentMethodLabel,
            transaction.paymentProvider,
            transaction.invoiceNumber,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          if (!haystack.includes(searchLower) && !String(transaction.amount ?? '').includes(searchLower)) {
            return false;
          }
        }

        if (financeFilters.status !== 'all' && transaction.status !== financeFilters.status) {
          return false;
        }

        if (financeFilters.dateRange !== 'all') {
          const now = new Date();
          const timestamp = Number(transaction.timestamp || 0);
          const transactionDate = timestamp > 0 ? new Date(timestamp) : null;
          if (!transactionDate || Number.isNaN(transactionDate.getTime())) {
            return false;
          }

          if (financeFilters.dateRange === 'today') {
            if (
              transactionDate.getDate() !== now.getDate()
              || transactionDate.getMonth() !== now.getMonth()
              || transactionDate.getFullYear() !== now.getFullYear()
            ) {
              return false;
            }
          } else if (financeFilters.dateRange === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (transactionDate < oneWeekAgo) return false;
          } else if (financeFilters.dateRange === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (transactionDate < oneMonthAgo) return false;
          }
        }

        return true;
      })
      .sort((left: any, right: any) => Number(right.timestamp || 0) - Number(left.timestamp || 0));
  }, [allTransactions, financeFilters]);

  const financeStats = useMemo(() => filteredTransactions.reduce((accumulator: any, transaction: any) => {
    if (['completed', 'approved', 'refunded', 'refund_requested'].includes(transaction.status)) {
      accumulator.totalRevenue += Number(transaction.amount || 0);
      accumulator.totalFees += Number(transaction.platformFee || 0);
      accumulator.netRevenue += Number(transaction.netAmount ?? (Number(transaction.amount || 0) - Number(transaction.platformFee || 0)));
    }

    return accumulator;
  }, { totalRevenue: 0, totalFees: 0, netRevenue: 0 }), [filteredTransactions]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const currentTransactions = useMemo(
    () => filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [currentPage, filteredTransactions],
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const exportTransactionsCsv = () => {
    const rows = filteredTransactions.map((transaction: any) => ({
      id: transaction.id,
      data: transaction.dateTimeFormatted || new Date(transaction.timestamp || Date.now()).toLocaleString(),
      tipo: transaction.type === 'plan' ? 'Assinatura' : 'Material',
      descricao: transaction.transactionName || transaction.materialTitle || transaction.planName || 'Plano de Assinatura',
      comprador: transaction.buyerName || '',
      vendedor: transaction.sellerName || 'Plataforma',
      provedor: transaction.paymentProvider || '',
      metodo: transaction.paymentMethodLabel || transaction.paymentMethod || '',
      referencia: transaction.providerTransactionId || transaction.referenceId || transaction.externalId || '',
      valor: Number(transaction.amount || 0).toFixed(2),
      taxa: Number(transaction.platformFee || 0).toFixed(2),
      liquido: Number(transaction.netAmount ?? (Number(transaction.amount || 0) - Number(transaction.platformFee || 0))).toFixed(2),
      status: formatTransactionStatusLabel(transaction.status || ''),
      invoice: transaction.invoiceNumber || transaction.providerInvoiceId || '',
    }));

    const header = Object.keys(rows[0] || {
      id: '', data: '', tipo: '', descricao: '', comprador: '', vendedor: '', provedor: '', metodo: '', referencia: '', valor: '', taxa: '', liquido: '', status: '', invoice: '',
    });
    const csv = [
      header.join(';'),
      ...rows.map((row) => header.map((key) => `"${String((row as any)[key] ?? '').replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transacoes-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast('ExportaÃ§Ã£o CSV gerada com sucesso.', 'success');
  };

  const handleSavePricing = async () => {
    if (isSavingPricing) return;

    setIsSavingPricing(true);
    try {
      await saveSystemSettingsNow(systemSettings);
      addToast('Planos e regras de acesso salvos com sucesso.', 'success');
    } catch (error) {
      console.error('Error saving pricing settings:', error);
      addToast('Nao foi possivel salvar as configuracoes dos planos.', 'error');
    } finally {
      setIsSavingPricing(false);
    }
  };

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

  const handleTogglePlanEntitlement = (plan: typeof PLAN_ORDER[number], benefitKey: PlanBenefitKey) => {
    const updatedEntitlements = normalizePlanEntitlements(systemSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS);
    const planIndex = PLAN_ORDER.indexOf(plan);
    const nextValue = !updatedEntitlements[plan][benefitKey];

    PLAN_ORDER.forEach((planName, index) => {
      if (nextValue && index >= planIndex) {
        updatedEntitlements[planName][benefitKey] = true;
      }

      if (!nextValue && index <= planIndex) {
        updatedEntitlements[planName][benefitKey] = false;
      }
    });

    updateSystemSettings({ ...systemSettings, planEntitlements: updatedEntitlements });
  };

  // --- REEMBOLSOS ---
  const { resolveRefund } = useMarketplace();
  const handleResolveRefund = async (transactionId: string, resolution: 'approved' | 'rejected') => {
    if (!window.confirm(`Tem certeza que deseja ${resolution === 'approved' ? 'APROVAR' : 'REJEITAR'} este reembolso?`)) {
      return;
    }

    const nextKey = `${transactionId}:${resolution}`;
    if (refundActionKey) return;

    setRefundActionKey(nextKey);
    try {
      await resolveRefund(transactionId, resolution);
    } finally {
      setRefundActionKey(null);
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
          <div className="flex items-center gap-2"><FileText size={14} /> TransaÃ§Ãµes</div>
        </button>
        <button
          onClick={() => setActiveSection('prices')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'prices' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><Tag size={14} /> PreÃ§os & Planos</div>
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
          <div className="flex items-center gap-2"><Terminal size={14} /> AutomaÃ§Ã£o</div>
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
                  <option value="date_asc">Data PrÃ³xima</option>
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
                    <th className="p-6 text-right">DisponÃ­vel</th>
                    <th className="p-6 text-center">Dia Pagamento</th>
                    <th className="p-6 text-center">AÃ§Ãµes</th>
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
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">DisponÃ­vel para Saque</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">R$ {selectedSeller.availablePayout.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-1">Saldo Preso</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {selectedSeller.heldBalance.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">PrÃ³ximo Pagamento</p>
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
                <ShieldAlert size={18} className="text-red-500" /> SolicitaÃ§Ãµes Pendentes
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-6 pl-8">Comprador</th>
                  <th className="p-6">Material / Produto</th>
                  <th className="p-6">Motivo</th>
                  <th className="p-6 text-right">Valor</th>
                  <th className="p-6 text-center">AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {refundRequests.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma solicitaÃ§Ã£o de reembolso pendente.</td></tr>
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
                          {t.refundReason || 'NÃ£o informado'}
                        </span>
                      </td>
                      <td className="p-6 text-right font-black">R$ {t.amount.toFixed(2)}</td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleResolveRefund(t.id, 'approved')}
                            className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                            title="Aprovar DevoluÃ§Ã£o"
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

      {activeSection === 'transactions' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Volume filtrado</p>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
                R$ {financeStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{filteredTransactions.length} transaÃ§Ãµes no recorte atual.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Taxa da plataforma</p>
              <p className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {financeStats.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Usa o valor real retornado pelo backend.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">LÃ­quido consolidado</p>
              <p className="mt-3 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                R$ {financeStats.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Inclui marketplace, assinaturas e reembolsos.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por ID, plano, material, comprador ou gateway"
                    value={financeFilters.search}
                    onChange={(e) => {
                      setFinanceFilters({ ...financeFilters, search: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold w-full sm:w-80 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <select
                  value={financeFilters.status}
                  onChange={(e) => {
                    setFinanceFilters({ ...financeFilters, status: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="py-2.5 pl-3 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Todos os status</option>
                  {statusOptions.map((status: string) => (
                    <option key={status} value={status}>
                      {formatTransactionStatusLabel(status)}
                    </option>
                  ))}
                </select>
                <select
                  value={financeFilters.dateRange}
                  onChange={(e) => {
                    setFinanceFilters({ ...financeFilters, dateRange: e.target.value });
                    setCurrentPage(1);
                  }}
                  className="py-2.5 pl-3 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Todo o perÃ­odo</option>
                  <option value="today">Hoje</option>
                  <option value="week">Ãšltimos 7 dias</option>
                  <option value="month">Ãšltimos 30 dias</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportTransactionsCsv}
                  disabled={filteredTransactions.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Download size={14} />
                  Exportar CSV
                </button>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    PÃ¡gina {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[420px]">
              <table className="w-full min-w-[1260px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4">TransaÃ§Ã£o</th>
                    <th className="p-4">Data</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Pagamento</th>
                    <th className="p-4">DescriÃ§Ã£o</th>
                    <th className="p-4">Comprador</th>
                    <th className="p-4">Vendedor</th>
                    <th className="p-4 text-right">Bruto</th>
                    <th className="p-4 text-right">Taxa</th>
                    <th className="p-4 text-right">LÃ­quido</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Fatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {currentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-12 text-center italic text-slate-400 dark:text-slate-600">
                        Nenhuma transaÃ§Ã£o encontrada para os filtros atuais.
                      </td>
                    </tr>
                  ) : currentTransactions.map((transaction: any) => {
                    const referenceCode = transaction.providerTransactionId || transaction.referenceId || transaction.externalId || transaction.id;
                    const invoiceUrl = transaction.invoicePdfUrl || transaction.hostedInvoiceUrl || '';
                    const amount = Number(transaction.amount || 0);
                    const fee = Number(transaction.platformFee || 0);
                    const net = Number(transaction.netAmount ?? (amount - fee));
                    const description = transaction.transactionName || transaction.materialTitle || transaction.planName || 'Plano de assinatura';
                    const statusLabel = formatTransactionStatusLabel(transaction.status || '');
                    const isRefundActionLocked = refundActionKey !== null;

                    return (
                      <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors align-top">
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="font-mono text-[11px] font-black text-slate-700 dark:text-slate-200 break-all">{String(transaction.id)}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">Ref.: {referenceCode || '-'}</div>
                            {transaction.providerInvoiceId && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                Invoice: {transaction.invoiceNumber || transaction.providerInvoiceId}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {transaction.dateFormatted || new Date(transaction.timestamp || Date.now()).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {transaction.dateTimeFormatted
                              ? transaction.dateTimeFormatted.split(' ').slice(1).join(' ')
                              : new Date(transaction.timestamp || Date.now()).toLocaleTimeString()}
                          </div>
                          {transaction.scheduleLabel && (
                            <div className="mt-1 text-[10px] font-bold text-indigo-500 dark:text-indigo-400">{transaction.scheduleLabel}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            transaction.type === 'plan'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {transaction.type === 'plan' ? 'Assinatura' : 'Material'}
                          </span>
                          {transaction.installmentNumber && transaction.installmentCount && (
                            <div className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                              Parcela {transaction.installmentNumber} de {transaction.installmentCount}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {String(transaction.paymentMethod || '').toLowerCase().includes('pix') ? (
                              <QrCode size={14} className="text-emerald-500" />
                            ) : String(transaction.paymentMethod || '').toLowerCase().includes('boleto') ? (
                              <FileText size={14} className="text-amber-500" />
                            ) : (
                              <CreditCard size={14} className="text-indigo-500" />
                            )}
                            <div>
                              <div className="font-bold text-slate-700 dark:text-slate-200">
                                {transaction.paymentMethodLabel || transaction.paymentMethod || 'CartÃ£o'}
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                {String(transaction.paymentProvider || '').replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="max-w-[220px]">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{description}</div>
                            <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 break-words">
                              {transaction.description || transaction.planName || transaction.materialTitle || 'Sem descriÃ§Ã£o adicional'}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{transaction.buyerName || '-'}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{transaction.buyerEmail || '-'}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{transaction.sellerName || 'Plataforma'}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{transaction.sellerEmail || '-'}</div>
                        </td>
                        <td className="p-4 text-right font-black text-slate-900 dark:text-slate-100">
                          R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          R$ {fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          R$ {net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-center gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                              transaction.status === 'refund_requested'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : transaction.status === 'refunded'
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  : transaction.status === 'pre-approved' || transaction.status === 'scheduled'
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                    : transaction.status === 'pending'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            }`}>
                              {statusLabel}
                            </span>

                            {transaction.status === 'refund_requested' && (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleResolveRefund(transaction.id, 'approved');
                                  }}
                                  disabled={isRefundActionLocked}
                                  className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline disabled:opacity-50"
                                >
                                  {refundActionKey === `${transaction.id}:approved` ? 'Aprovando...' : 'Aprovar'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleResolveRefund(transaction.id, 'rejected');
                                  }}
                                  disabled={isRefundActionLocked}
                                  className="text-[9px] font-black uppercase text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline disabled:opacity-50"
                                >
                                  {refundActionKey === `${transaction.id}:rejected` ? 'Rejeitando...' : 'Rejeitar'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {invoiceUrl ? (
                            <button
                              onClick={() => window.open(invoiceUrl, '_blank', 'noopener,noreferrer')}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Download size={12} />
                              PDF
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-600">IndisponÃ­vel</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                  <tr>
                    <td colSpan={7} className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Totais do recorte
                    </td>
                    <td className="p-4 text-right text-sm font-black text-slate-900 dark:text-slate-100">
                      R$ {financeStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                      R$ {financeStats.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right text-sm font-black text-indigo-600 dark:text-indigo-400">
                      R$ {financeStats.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-6 py-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Mostrando {currentTransactions.length} de {filteredTransactions.length} registros
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  PrÃ³xima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'transactions-legacy' && (() => {
        // --- LOGICA DE FILTRO E PAGINAÃ‡ÃƒO LOCAL PARA TRANSAÃ‡Ã•ES ---
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
                      placeholder="Buscar transaÃ§Ã£o..."
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
                        {status === 'completed' ? 'ConcluÃ­do' :
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
                    <option value="all">Todo o PerÃ­odo</option>
                    <option value="today">Hoje</option>
                    <option value="week">Ãšltimos 7 dias</option>
                    <option value="month">Ãšltimo MÃªs</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">PÃ¡g {currentPage} de {totalPages || 1}</span>
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
                      <th className="p-4">MÃ©todo</th>
                      <th className="p-4">Material / Plano</th>
                      <th className="p-4">Comprador</th>
                      <th className="p-4">Vendedor</th>
                      <th className="p-4 text-right">Valor</th>
                      <th className="p-4 text-right">Taxa (Admin)</th>
                      <th className="p-4 text-right">LÃ­quido</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300 divide-y divide-slate-50 dark:divide-slate-800">
                    {currentTransactions.length === 0 ? (
                      <tr><td colSpan={12} className="p-12 text-center text-slate-400 dark:text-slate-600 italic">Nenhuma transaÃ§Ã£o encontrada.</td></tr>
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
                              <div className="flex items-center gap-1.5" title={t.paymentMethod || 'NÃ£o informado'}>
                                {(!t.paymentMethod || t.paymentMethod === 'credit_card') && <CreditCard size={14} className="text-indigo-500" />}
                                {t.paymentMethod === 'pix' && <QrCode size={14} className="text-emerald-500" />}
                                {t.paymentMethod === 'boleto' && <FileText size={14} className="text-amber-500" />}
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                  {t.paymentMethod === 'credit_card' ? 'CartÃ£o' : t.paymentMethod === 'pix' ? 'Pix' : t.paymentMethod === 'boleto' ? 'Boleto' : 'CartÃ£o'}
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
                                 <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase">ConcluÃ­do</span>
                               ) : t.status === 'scheduled' ? (
                                 <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded text-[10px] font-black uppercase border border-indigo-200 dark:border-indigo-800">pre-aprovado</span>
                               ) : t.status === 'refunded' ? (
                                 <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase">Reembolsado</span>
                               ) : t.status === 'refund_requested' ? (
                                 <div className="flex flex-col items-center gap-1">
                                   <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><AlertCircle size={10} /> Disputa</span>
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       void handleResolveRefund(t.id, 'approved');
                                     }}
                                     disabled={refundActionKey !== null}
                                     className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline disabled:opacity-50"
                                   >
                                     {refundActionKey === `${t.id}:approved` ? 'Aprovando...' : 'Aprovar'}
                                   </button>
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       void handleResolveRefund(t.id, 'rejected');
                                     }}
                                     disabled={refundActionKey !== null}
                                     className="text-[9px] font-black uppercase text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline disabled:opacity-50"
                                   >
                                     {refundActionKey === `${t.id}:rejected` ? 'Rejeitando...' : 'Rejeitar'}
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
                          Totais da VisualizaÃ§Ã£o:
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
                          <span className="text-[10px] text-blue-600/70 font-medium uppercase">LÃ­quido</span>
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
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700">PrÃ³ximo</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {activeSection === 'prices' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
          <div className="mb-8 border-b border-slate-100 dark:border-slate-800/50 pb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">ConfiguraÃ§Ã£o de Planos</h3>
            <p className="text-sm text-slate-500 font-medium">Defina preÃ§os, descontos e benefÃ­cios liberados para cada nÃ­vel de assinatura.</p>
          </div>
          <div className="flex justify-end mb-6">
            <button
              onClick={() => void handleSavePricing()}
              disabled={isSavingPricing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-60"
            >
              {isSavingPricing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSavingPricing ? 'Salvando...' : 'Salvar Planos'}
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DescriÃ§Ã£o Comercial</label>
                    <input
                      type="text"
                      value={config.description || ''}
                      onChange={e => handleDescriptionChange(plan, e.target.value)}
                      placeholder="DescriÃ§Ã£o breve do plano para atrair usuÃ¡rios..."
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
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">â‰ˆ R$ {(config.quarterly / 3).toFixed(2)}/mÃªs</p>
                      <p className="text-[9px] text-emerald-500 font-bold">Economia de R$ {(config.monthly * 3 - config.quarterly).toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Anual</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.annual.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">â‰ˆ R$ {(config.annual / 12).toFixed(2)}/mÃªs</p>
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

          <div className="mt-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
                Controle de Acesso por Plano
              </h4>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Esta matriz define os beneficios reais liberados para cada plano. A interface e os endpoints premium passam a confiar nela para evitar vazamento de recursos de planos superiores.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Beneficio</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descricao</th>
                    {PLAN_ORDER.map((planName) => (
                      <th key={planName} className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {planName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PLAN_BENEFIT_DEFINITIONS.map((benefit) => {
                    const resolvedEntitlements = normalizePlanEntitlements(systemSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS);

                    return (
                      <tr key={benefit.key} className="bg-white dark:bg-slate-900/40">
                        <td className="p-4 align-top">
                          <div className="text-sm font-black text-slate-900 dark:text-slate-100">{benefit.label}</div>
                          <div className="mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">{benefit.key}</div>
                        </td>
                        <td className="p-4 align-top text-xs font-medium text-slate-500 dark:text-slate-400">
                          {benefit.description}
                        </td>
                        {PLAN_ORDER.map((planName) => {
                          const enabled = resolvedEntitlements[planName][benefit.key];

                          return (
                            <td key={`${benefit.key}-${planName}`} className="p-4 text-center align-top">
                              <button
                                onClick={() => handleTogglePlanEntitlement(planName, benefit.key)}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                                  enabled
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400'
                                    : 'border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                                }`}
                                title={`${enabled ? 'Remover' : 'Liberar'} ${benefit.label} para o plano ${planName}`}
                              >
                                {enabled ? <Check size={14} /> : <X size={14} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Terminal size={20} className="text-indigo-600 dark:text-indigo-400" />
                  AutomaÃ§Ã£o de cobranÃ§a
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  A automaÃ§Ã£o segue o gateway principal configurado no painel e centraliza conciliaÃ§Ã£o, renovaÃ§Ã£o e diagnÃ³stico operacional.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Cpu size={12} />
                {paymentProvider === 'stripe' ? 'Stripe ativo' : 'Mercado Pago ativo'}
              </span>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Provedor</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {paymentProvider === 'stripe' ? 'Stripe Billing + ReconciliaÃ§Ã£o' : 'Mercado Pago Subscription API'}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {paymentProvider === 'stripe'
                    ? 'O cron revisa assinaturas, parcelas, invoices e divergÃªncias entre gateway e base local.'
                    : 'O cron executa a rotina de cobranÃ§as recorrentes e retentativas automÃ¡ticas do provedor.'}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">FrequÃªncia recomendada</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">1 vez por hora</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Essa cadÃªncia reduz divergÃªncias de renovaÃ§Ã£o, conciliaÃ§Ã£o e feedback operacional no financeiro.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">URL monitorada</p>
                <p className="break-all text-sm font-black text-indigo-600 dark:text-indigo-400">{automationCronUrl || 'Carregando URL oficial...'}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use a URL oficial retornada pelo backend para testes manuais e agendamento no servidor.</p>
              </div>
            </div>

            {automationHelperLoading && (
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Carregando instrucoes oficiais...
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Database size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Windows / XAMPP</h4>
                </div>
                <ul className="list-decimal space-y-2 pl-4 text-xs font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400">
                  <li>Baixe o script auxiliar do cron.</li>
                  <li>Cadastre a tarefa no Agendador do Windows.</li>
                  <li>Programe a execuÃ§Ã£o horÃ¡ria para manter a conciliaÃ§Ã£o atualizada.</li>
                </ul>
                <button
                  onClick={() => {
                    if (!automationDownloadUrl) {
                      addToast('A URL oficial do helper ainda nao foi carregada.', 'error');
                      return;
                    }

                    window.open(automationDownloadUrl, '_blank', 'noopener,noreferrer');
                  }}
                  disabled={!automationDownloadUrl}
                  className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Baixar script .bat
                </button>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Globe size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Linux / cPanel</h4>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed text-slate-400">
                  Adicione este comando no gerenciador de cron jobs do servidor:
                </p>
                <div className="rounded-xl border border-emerald-900/30 bg-slate-900 p-3 font-mono text-[10px] text-emerald-400 break-all">
                  {automationCronCommand}
                </div>
                <button
                  onClick={() => {
                    if (!automationCronCommand) {
                      addToast('O comando oficial ainda nao foi carregado.', 'error');
                      return;
                    }

                    navigator.clipboard.writeText(automationCronCommand);
                    addToast('Comando copiado!', 'success');
                  }}
                  disabled={!automationCronCommand}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={14} />
                  Copiar comando
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/10 p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 text-indigo-500" size={18} />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-400">Fluxo operacional ativo</h4>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-indigo-800/70 dark:text-indigo-400/80">
                    {paymentProvider === 'stripe'
                      ? 'A reconciliaÃ§Ã£o Stripe revisa invoices, pagamentos, renovaÃ§Ã£o, parcelas e divergÃªncias entre o gateway e a base local antes de manter a assinatura ativa.'
                      : 'A automaÃ§Ã£o do Mercado Pago mantÃ©m a cobranÃ§a recorrente, as retentativas e a atualizaÃ§Ã£o dos perÃ­odos de acesso dos alunos apÃ³s cada pagamento aprovado.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 border-t border-slate-100 dark:border-slate-800 py-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ExecuÃ§Ã£o manual para diagnÃ³stico</p>
              <button
                type="button"
                onClick={() => {
                  if (!automationCronUrl) {
                    addToast('A URL oficial do cron ainda nao foi carregada.', 'error');
                    return;
                  }

                  window.open(automationCronUrl, '_blank', 'noopener,noreferrer');
                }}
                disabled={!automationCronUrl}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:shadow-none"
              >
                <Zap size={14} />
                Executar rotina agora
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'automation-legacy' && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in transition-colors duration-300">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Terminal size={20} className="text-indigo-600 dark:text-indigo-400" /> AutomaÃ§Ã£o de CobranÃ§a (Subscription API)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">O sistema utiliza a <strong>Mercado Pago Subscription API</strong> (Nativa) para gerenciar cobranÃ§as recorrentes automaticamente.</p>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* OpÃ§Ã£o Windows */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Database size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Windows (XAMPP)</h4>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-decimal pl-4 font-bold uppercase tracking-tight">
                  <li>Baixe o script .bat de automaÃ§Ã£o.</li>
                  <li>Abra o "Agendador de Tarefas" do Windows.</li>
                  <li>Crie uma tarefa para rodar este arquivo .bat diariamente.</li>
                </ul>
                <button 
                  onClick={() => {
                    if (!automationDownloadUrl) {
                      addToast('A URL oficial do helper ainda nao foi carregada.', 'error');
                      return;
                    }

                    window.open(automationDownloadUrl, '_blank', 'noopener,noreferrer');
                  }}
                  disabled={!automationDownloadUrl}
                  className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Baixar Script .bat
                </button>
              </div>

              {/* OpÃ§Ã£o Linux */}
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
                  {automationCronCommand || 'Carregando comando oficial...'}
                </div>
                <button 
                  onClick={() => {
                    if (!automationCronCommand) {
                      addToast('O comando oficial ainda nao foi carregado.', 'error');
                      return;
                    }

                    navigator.clipboard.writeText(automationCronCommand);
                    addToast('Comando copiado!', 'success');
                  }}
                  disabled={!automationCronCommand}
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
                  <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest">IntegraÃ§Ã£o Nativa Ativa</h4>
                  <p className="text-xs text-indigo-800/70 dark:text-indigo-400/70 font-medium leading-relaxed mt-1">
                    As cobranÃ§as agendadas e retentativas de pagamento sÃ£o gerenciadas diretamente pelos servidores do Mercado Pago. Os Webhooks integrados garantem que os perÃ­odos de acesso dos alunos sejam renovados automaticamente apÃ³s cada pagamento aprovado.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center flex-col items-center gap-4 py-8 border-t border-slate-100 dark:border-slate-800">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso Direto ao Script (Teste)</p>
               <button 
                 type="button"
                 onClick={() => {
                   if (!automationCronUrl) {
                     addToast('A URL oficial do cron ainda nao foi carregada.', 'error');
                     return;
                   }

                   window.open(automationCronUrl, '_blank', 'noopener,noreferrer');
                 }}
                 disabled={!automationCronUrl}
                 className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all flex items-center gap-2 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none"
               >
                 <Zap size={14} /> Executar Cron Manualmente Agora
               </button>
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

export default AdminFinance;

