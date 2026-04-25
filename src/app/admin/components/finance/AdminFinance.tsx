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
  Calendar,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Cpu,
  CreditCard,
  Download,
  FileText,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Play,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Save,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Terminal,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { useToast } from '@providers/ToastProvider';
import type { PlanBenefitKey, PlanName, PlanUsageLimitKey, SystemSettings, UserProfile } from '@types';
import { adminService, type AdminRevenueProjectionPayload } from '@services/admin/adminService';
import { subscriptionsService } from '@services/subscriptions';
import { PLAN_DETAILS, PRICING } from '@constants';
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  DEFAULT_PLAN_USAGE_LIMITS,
  PLAN_BENEFIT_DEFINITIONS,
  PLAN_ORDER,
  PLAN_USAGE_LIMIT_DEFINITIONS,
  normalizePlanEntitlements,
  normalizePlanUsageLimits,
} from '@constants/subscriptions/planEntitlements';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import AdminMarketing from './AdminMarketing';
import AdminFinanceAnalyticsPanel from './AdminFinanceAnalyticsPanel';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SEGMENTED_TABS_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
} from '../shared/adminPanelStyles';

interface AdminFinanceProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  allTransactions: any[];
  allUsers: UserProfile[];
  initialSection?: 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics' | 'balance' | 'prices' | 'marketing' | 'plans-coupons';
  onSectionChange?: (section: 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics') => void;
  standaloneSection?: boolean;
}

type FinanceSection = 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics';

const clonePlanDetails = (source: any) => Object.fromEntries(
  Object.entries(source || {}).map(([plan, config]: any) => [
    plan,
    {
      ...config,
      features: Array.isArray(config?.features)
        ? config.features.map((feature: any) => ({ ...feature }))
        : [],
    },
  ]),
);

const mergePricingWithDefaults = (pricing: any) => Object.fromEntries(
  Object.entries(PRICING).map(([plan, config]: any) => [
    plan,
    {
      ...config,
      ...(pricing?.[plan] || {}),
    },
  ]),
);

const mergePlanDetailsWithDefaults = (planDetails: any) => {
  const defaults = clonePlanDetails(PLAN_DETAILS);
  const incoming = clonePlanDetails(planDetails);

  Object.keys(defaults).forEach((plan) => {
    const current = incoming[plan] || {};
    defaults[plan] = {
      ...defaults[plan],
      ...current,
      displayName: typeof current.displayName === 'string' && current.displayName.trim() !== ''
        ? current.displayName.trim()
        : defaults[plan].displayName || plan,
      enabled: typeof current.enabled === 'boolean' ? current.enabled : defaults[plan].enabled !== false,
      features: Array.isArray(current.features) && current.features.length > 0
        ? current.features.map((feature: any) => ({ ...feature }))
        : defaults[plan].features,
    };
  });

  return defaults;
};

const planNames = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;
const PAID_TRANSACTION_STATUSES = new Set(['completed', 'approved']);

const isPaidTransactionStatus = (status: unknown) => PAID_TRANSACTION_STATUSES.has(String(status || '').toLowerCase());

const readTransactionAmount = (transaction: any) => Number(transaction?.amount || 0);

const readTransactionPlatformFee = (transaction: any) => {
  const amount = readTransactionAmount(transaction);
  const platformFee = Number(transaction?.platformFee ?? transaction?.platform_fee);
  return Number.isFinite(platformFee) && platformFee > 0 ? platformFee : amount * 0.20;
};

const isMarketplaceTransaction = (transaction: any) => {
  const type = String(transaction?.type || '').toLowerCase();
  return type !== 'plan'
    && type !== 'subscription'
    && Boolean(transaction?.sellerId || transaction?.seller_id || transaction?.materialId || transaction?.material_id);
};

const isAdminTransactionHeld = (transaction: any) => {
  const timestamp = Number(transaction?.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;

  return (Date.now() - timestamp) < (7 * 24 * 60 * 60 * 1000);
};

const EMPTY_REVENUE_PROJECTION: AdminRevenueProjectionPayload = {
  totalProjectedAmount: 0,
  totalRemainingInstallments: 0,
  activeContracts: 0,
  atRiskProjectedAmount: 0,
  breakdownByCycle: [],
  breakdownByMonth: [],
  items: [],
};

const formatAdminMoney = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseProjectionTimestamp = (value?: string | null) => {
  if (!value) {
    return Date.now();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
};

const addProjectionMonths = (timestamp: number, monthOffset: number) => {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() + monthOffset);
  return date.getTime();
};

const buildProjectedTransactionRows = (projection: AdminRevenueProjectionPayload) => (
  (projection.items || []).flatMap((item) => {
    const remaining = Math.max(0, Number(item.remainingInstallments || 0));
    const installmentAmount = Number(item.installmentAmount || 0);
    const baseTimestamp = parseProjectionTimestamp(item.nextBillingAt || item.currentPeriodEnd || null);

    if (remaining <= 0 || installmentAmount <= 0) {
      return [];
    }

    return Array.from({ length: remaining }, (_, index) => {
      const installmentNumber = Number(item.paidInstallments || 0) + index + 1;
      const dueTimestamp = addProjectionMonths(baseTimestamp, index);

      return {
        id: `projection-${item.subscriptionId || item.userId}-${installmentNumber}`,
        internalId: `projection-${item.subscriptionId || item.userId}-${installmentNumber}`,
        referenceId: item.subscriptionId,
        providerTransactionId: item.subscriptionId,
        transactionName: `Receita projetada - ${item.planName || item.cycleLabel}`,
        planName: item.planName || item.cycleLabel,
        description: `Parcela futura ${installmentNumber} de ${item.totalInstallments} (${item.cycleLabel}).`,
        buyerName: item.userName,
        buyerEmail: item.userEmail,
        sellerName: 'Plataforma',
        sellerEmail: '',
        paymentMethod: 'card',
        paymentMethodLabel: 'Cobranca futura',
        paymentProvider: 'stripe',
        type: 'plan',
        status: 'pre-approved',
        amount: installmentAmount,
        platformFee: installmentAmount,
        netAmount: 0,
        timestamp: dueTimestamp,
        dateFormatted: new Date(dueTimestamp).toLocaleDateString('pt-BR'),
        dateTimeFormatted: new Date(dueTimestamp).toLocaleString('pt-BR'),
        scheduleLabel: item.status === 'past_due' ? 'Projecao em risco' : 'Parcela pre-aprovada',
        installmentNumber,
        installmentCount: item.totalInstallments,
        isRevenueProjection: true,
      };
    });
  })
);

const buildProjectionMonthBreakdownFromRows = (rows: any[]) => {
  const groups = new Map<string, {
    key: string;
    label: string;
    year: number;
    month: number;
    installments: number;
    amount: number;
    atRiskAmount: number;
  }>();

  rows.forEach((row) => {
    const timestamp = Number(row.timestamp || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }

    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = groups.get(key) || {
      key,
      label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      installments: 0,
      amount: 0,
      atRiskAmount: 0,
    };

    const amount = readTransactionAmount(row);
    current.installments += 1;
    current.amount += amount;

    if (String(row.scheduleLabel || '').toLowerCase().includes('risco')) {
      current.atRiskAmount += amount;
    }

    groups.set(key, current);
  });

  return Array.from(groups.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((month) => ({
      ...month,
      amount: Number(month.amount.toFixed(2)),
      atRiskAmount: Number(month.atRiskAmount.toFixed(2)),
    }));
};

const AdminFinance = ({
  systemSettings,
  allTransactions,
  allUsers,
  initialSection = 'transactions',
  onSectionChange,
  standaloneSection = false,
}: AdminFinanceProps) => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const { saveSystemSettingsNow } = useData();
  const normalizeSection = (section: AdminFinanceProps['initialSection']) => {
    if (section === 'balance') return 'subscriptions';
    if (section === 'prices' || section === 'plans-coupons') return 'plans';
    if (section === 'marketing') return 'coupons';
    if (section === 'transactions' || section === 'refunds' || section === 'automation' || section === 'plans' || section === 'coupons' || section === 'subscriptions' || section === 'analytics') {
      return section;
    }
    return 'transactions';
  };

  const [activeSection, setActiveSection] = useState<FinanceSection>(normalizeSection(initialSection));
  const [financeFilters, setFinanceFilters] = useState({ search: '', status: 'all', dateRange: 'all' });
  const [currentPage, setCurrentPage] = useState(1);
  const [refundActionKey, setRefundActionKey] = useState<string | null>(null);
  const [pendingRefundDecision, setPendingRefundDecision] = useState<{
    transactionId: string;
    resolution: 'approved' | 'retention_offer';
  } | null>(null);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [automationHelper, setAutomationHelper] = useState<any | null>(null);
  const [automationHelperLoading, setAutomationHelperLoading] = useState(false);
  const [automationHelperRequested, setAutomationHelperRequested] = useState(false);
  const [stripeTestingMatrix, setStripeTestingMatrix] = useState<any | null>(null);
  const [stripeTestingMatrixLoading, setStripeTestingMatrixLoading] = useState(false);
  const [stripeTestingMatrixRequested, setStripeTestingMatrixRequested] = useState(false);
  const [stripeTestingRuns, setStripeTestingRuns] = useState<any[]>([]);
  const [stripeTestingRunsLoading, setStripeTestingRunsLoading] = useState(false);
  const [stripeTestingRunsRequested, setStripeTestingRunsRequested] = useState(false);
  const [stripeTestingRunSaving, setStripeTestingRunSaving] = useState(false);
  const [stripeTestingRunScenario, setStripeTestingRunScenario] = useState<any | null>(null);
  const [revenueProjection, setRevenueProjection] = useState<AdminRevenueProjectionPayload>(EMPTY_REVENUE_PROJECTION);
  const [isRevenueProjectionLoading, setIsRevenueProjectionLoading] = useState(false);
  const [stripeTestingRunForm, setStripeTestingRunForm] = useState({
    execution_result: 'passed' as 'passed' | 'failed' | 'blocked',
    payment_intent_id: '',
    subscription_id: '',
    transaction_id: '',
    evidence_url: '',
    gateway_message: '',
    notes: '',
  });
  const [draftPricing, setDraftPricing] = useState(() => mergePricingWithDefaults(systemSettings.pricing));
  const [draftPlanDetails, setDraftPlanDetails] = useState(() => mergePlanDetailsWithDefaults(systemSettings.planDetails));
  const [draftCoupons, setDraftCoupons] = useState<any[]>(() => Array.isArray(systemSettings.coupons) ? systemSettings.coupons : []);
  const [draftPlanEntitlements, setDraftPlanEntitlements] = useState(() => normalizePlanEntitlements(systemSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS));
  const [draftPlanUsageLimits, setDraftPlanUsageLimits] = useState(() => normalizePlanUsageLimits(systemSettings.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS));
  const [draftActiveTheme, setDraftActiveTheme] = useState(systemSettings.activeTheme || 'default');
  const [draftActivePromotion, setDraftActivePromotion] = useState(systemSettings.activePromotion || undefined);
  const refundRequests = useMemo(
    () => allTransactions?.filter((t: any) => String(t.status || '') === 'refund_requested') || [],
    [allTransactions],
  );

  const totalInDispute = useMemo(() => refundRequests.reduce((acc: number, t: any) => acc + readTransactionAmount(t), 0), [refundRequests]);
  const totalRefunded = useMemo(
    () => allTransactions?.filter((t: any) => String(t.status || '') === 'refunded').reduce((acc: number, t: any) => acc + readTransactionAmount(t), 0) || 0,
    [allTransactions],
  );

  // --- NOVOS CALCULOS POR VENDEDOR ---
  const [sellersMetrics, setSellersMetrics] = useState<any[]>([]);
  const [viewingSellerDetails, setViewingSellerDetails] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'available_desc' | 'available_asc' | 'date_asc' | 'date_desc'>('available_desc');
  const paymentProvider = 'stripe' as const;
  const automationDownloadUrl = automationHelper?.download_url || '';
  const automationCronUrl = automationHelper?.cron_url || '';
  const automationCronCommand = automationHelper?.linux_command || '';
  const automationHelperUnavailable = automationHelperRequested && !automationHelperLoading && !automationHelper;
  const automationCronUrlLabel = automationCronUrl || (automationHelperUnavailable ? 'URL oficial indisponivel no momento.' : 'Carregando URL oficial...');
  const automationCronCommandLabel = automationCronCommand || (automationHelperUnavailable ? 'Comando oficial indisponivel no momento.' : 'Carregando comando oficial...');
  const stripeTestingCases = Array.isArray(stripeTestingMatrix?.cases) ? stripeTestingMatrix.cases : [];
  const stripeTestingSummary = stripeTestingMatrix?.summary || { total: 0, supported: 0, partial: 0, not_supported: 0 };
  const stripeTestingSources = Array.isArray(stripeTestingMatrix?.source) ? stripeTestingMatrix.source : [];
  const isAdminViewer = String(currentUser?.role || '').toLowerCase() === 'admin';
  const financeSettings = useMemo<SystemSettings>(() => ({
    ...systemSettings,
    pricing: draftPricing,
    planDetails: draftPlanDetails,
    coupons: draftCoupons as any,
    planEntitlements: draftPlanEntitlements,
    planUsageLimits: draftPlanUsageLimits,
    activeTheme: draftActiveTheme,
    activePromotion: draftActivePromotion,
  }), [draftActivePromotion, draftActiveTheme, draftCoupons, draftPlanDetails, draftPlanEntitlements, draftPlanUsageLimits, draftPricing, systemSettings]);

  useEffect(() => {
    setDraftPricing(mergePricingWithDefaults(systemSettings.pricing));
    setDraftPlanDetails(mergePlanDetailsWithDefaults(systemSettings.planDetails));
    setDraftCoupons(Array.isArray(systemSettings.coupons) ? systemSettings.coupons : []);
    setDraftPlanEntitlements(normalizePlanEntitlements(systemSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS));
    setDraftPlanUsageLimits(normalizePlanUsageLimits(systemSettings.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS));
    setDraftActiveTheme(systemSettings.activeTheme || 'default');
    setDraftActivePromotion(systemSettings.activePromotion || undefined);
  }, [
    systemSettings.activePromotion,
    systemSettings.activeTheme,
    systemSettings.coupons,
    systemSettings.planDetails,
    systemSettings.planEntitlements,
    systemSettings.planUsageLimits,
    systemSettings.pricing,
  ]);

  useEffect(() => {
    setActiveSection(normalizeSection(initialSection));
  }, [initialSection]);

  useEffect(() => {
    if (activeSection !== 'transactions') {
      return;
    }

    let cancelled = false;
    setIsRevenueProjectionLoading(true);

    adminService.getFinanceAnalytics({ period: 'all' })
      .then((payload) => {
        if (!cancelled) {
          setRevenueProjection(payload.revenueProjection || EMPTY_REVENUE_PROJECTION);
        }
      })
      .catch((error) => {
        console.error('Failed to load confirmed revenue projection:', error);
        if (!cancelled) {
          setRevenueProjection(EMPTY_REVENUE_PROJECTION);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRevenueProjectionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  const changeSection = (section: 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics') => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const applyPersistedFinanceSettings = (nextSettings: SystemSettings) => {
    setDraftPricing(mergePricingWithDefaults(nextSettings.pricing));
    setDraftPlanDetails(mergePlanDetailsWithDefaults(nextSettings.planDetails));
    setDraftCoupons(Array.isArray(nextSettings.coupons) ? nextSettings.coupons : []);
    setDraftPlanEntitlements(normalizePlanEntitlements(nextSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS));
    setDraftPlanUsageLimits(normalizePlanUsageLimits(nextSettings.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS));
    setDraftActiveTheme(nextSettings.activeTheme || 'default');
    setDraftActivePromotion(nextSettings.activePromotion || undefined);
  };

  useEffect(() => {
    if (!allTransactions || !allUsers) return;

    const metricsBySeller: Record<string, any> = {};

    // 1. Identificar todos os vendedores que têm transações
    allTransactions.forEach((t: any) => {
      if (!isPaidTransactionStatus(t.status) || !isMarketplaceTransaction(t)) return;

      const sellerId = String(t.sellerId || t.seller_id);
      if (!sellerId) return;

      if (!metricsBySeller[sellerId]) {
        const seller = allUsers.find((u: any) => String(u.id) === sellerId);
        const paymentDay = Number(seller?.billing?.paymentDay);
        metricsBySeller[sellerId] = {
          id: sellerId,
          name: seller?.name || 'Desconhecido',
          email: seller?.email || '-',
          paymentDay: null,
          totalSales: 0,
          heldBalance: 0,
          availablePayout: 0,
          transactions: []
        };
        metricsBySeller[sellerId].paymentDay = Number.isFinite(paymentDay) && paymentDay > 0 ? paymentDay : null;
      }

      const amount = readTransactionAmount(t);
      const sellerShare = Math.max(0, amount - readTransactionPlatformFee(t));
      metricsBySeller[sellerId].totalSales += amount;
      metricsBySeller[sellerId].transactions.push(t);

      if (isAdminTransactionHeld(t)) {
        metricsBySeller[sellerId].heldBalance += sellerShare;
      } else {
        metricsBySeller[sellerId].availablePayout += sellerShare;
      }
    });

    const metricsArray = Object.values(metricsBySeller);
    setSellersMetrics(metricsArray);
  }, [allTransactions, allUsers]);

  useEffect(() => {
    if (activeSection !== 'automation' || automationHelper || automationHelperLoading || automationHelperRequested) return;

    let cancelled = false;
    setAutomationHelperRequested(true);
    setAutomationHelperLoading(true);

    subscriptionsService.getAutomationHelperInfo()
      .then((payload) => {
        if (!cancelled) {
          setAutomationHelper(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          addToast('Não foi possível carregar as instrucoes oficiais de automacao.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAutomationHelperLoading(false);
        }
      });

    return () => {
      cancelled = true;
      setAutomationHelperLoading(false);
      setAutomationHelperRequested(false);
    };
  }, [activeSection, automationHelper, automationHelperLoading, automationHelperRequested, addToast]);

  useEffect(() => {
    if (activeSection !== 'automation' || stripeTestingMatrix || stripeTestingMatrixLoading || stripeTestingMatrixRequested) return;

    let cancelled = false;
    setStripeTestingMatrixRequested(true);
    setStripeTestingMatrixLoading(true);

    subscriptionsService.getStripeTestingMatrix()
      .then((payload) => {
        if (!cancelled) {
          setStripeTestingMatrix(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          addToast('Nao foi possivel carregar a matriz oficial de testes Stripe.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStripeTestingMatrixLoading(false);
        }
      });

    return () => {
      cancelled = true;
      setStripeTestingMatrixLoading(false);
      setStripeTestingMatrixRequested(false);
    };
  }, [activeSection, addToast, stripeTestingMatrix, stripeTestingMatrixLoading, stripeTestingMatrixRequested]);

  useEffect(() => {
    if (!isAdminViewer || activeSection !== 'automation' || stripeTestingRunsLoading || stripeTestingRunsRequested) return;
    if (stripeTestingRuns.length > 0) return;

    let cancelled = false;
    setStripeTestingRunsRequested(true);
    setStripeTestingRunsLoading(true);

    subscriptionsService.getStripeTestingRuns(80)
      .then((payload) => {
        if (!cancelled) {
          setStripeTestingRuns(Array.isArray(payload?.runs) ? payload.runs : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          addToast('Nao foi possivel carregar o historico de evidencias dos testes Stripe.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStripeTestingRunsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      setStripeTestingRunsLoading(false);
      setStripeTestingRunsRequested(false);
    };
  }, [activeSection, addToast, isAdminViewer, stripeTestingRuns.length, stripeTestingRunsLoading, stripeTestingRunsRequested]);

  const sortedSellers = useMemo(() => {
    return [...sellersMetrics].sort((a, b) => {
      if (sortBy === 'available_desc') return b.availablePayout - a.availablePayout;
      if (sortBy === 'available_asc') return a.availablePayout - b.availablePayout;
      const safePaymentDayA = typeof a.paymentDay === 'number' ? a.paymentDay : Number.POSITIVE_INFINITY;
      const safePaymentDayB = typeof b.paymentDay === 'number' ? b.paymentDay : Number.POSITIVE_INFINITY;
      if (sortBy === 'date_asc') return safePaymentDayA - safePaymentDayB;
      if (sortBy === 'date_desc') return safePaymentDayB - safePaymentDayA;
      return 0;
    });
  }, [sellersMetrics, sortBy]);

  const projectedTransactionRows = useMemo(
    () => buildProjectedTransactionRows(revenueProjection),
    [revenueProjection],
  );

  const projectionMonthRows = useMemo(() => {
    const apiRows = (revenueProjection.breakdownByMonth || [])
      .filter((month) => Number(month.amount || 0) > 0)
      .map((month) => ({
        ...month,
        amount: Number(month.amount || 0),
        atRiskAmount: Number(month.atRiskAmount || 0),
        installments: Number(month.installments || 0),
      }));

    return apiRows.length > 0
      ? apiRows
      : buildProjectionMonthBreakdownFromRows(projectedTransactionRows);
  }, [projectedTransactionRows, revenueProjection.breakdownByMonth]);

  const maxProjectionMonthAmount = useMemo(
    () => Math.max(1, ...projectionMonthRows.map((month) => Number(month.amount || 0))),
    [projectionMonthRows],
  );

  const financeTransactionRows = useMemo(
    () => (
      activeSection === 'transactions'
        ? [...(allTransactions || []), ...projectedTransactionRows]
        : (allTransactions || [])
    ),
    [activeSection, allTransactions, projectedTransactionRows],
  );

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>(['completed', 'approved', 'pending', 'pre-approved', 'refunded', 'refund_requested', 'cancelled']);
    (financeTransactionRows || []).forEach((transaction: any) => {
      const status = String(transaction.status || '').trim();
      if (status) statuses.add(status);
    });

    return Array.from(statuses);
  }, [financeTransactionRows]);

  const formatTransactionStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'Concluído';
      case 'pre-approved':
      case 'scheduled':
        return 'Pré-aprovado';
      case 'refund_requested':
        return 'Reembolso em analise';
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
    if (!financeTransactionRows) return [];

    return financeTransactionRows
      .filter((transaction: any) => {
        const transactionStatus = String(transaction.status || '');

        if (activeSection === 'refunds' && transactionStatus !== 'refund_requested') {
          return false;
        }

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

        if (financeFilters.status !== 'all' && transactionStatus !== financeFilters.status) {
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
  }, [activeSection, financeFilters, financeTransactionRows]);

  const financeStats = useMemo(() => filteredTransactions.reduce((accumulator: any, transaction: any) => {
    if (isPaidTransactionStatus(transaction.status)) {
      const amount = readTransactionAmount(transaction);
      const fee = isMarketplaceTransaction(transaction) ? readTransactionPlatformFee(transaction) : amount;
      accumulator.totalRevenue += amount;
      accumulator.totalFees += fee;
      accumulator.netRevenue += Number(transaction.netAmount ?? (amount - fee));
    }

    return accumulator;
  }, { totalRevenue: 0, totalFees: 0, netRevenue: 0 }), [filteredTransactions]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const currentTransactions = useMemo(
    () => filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [currentPage, filteredTransactions],
  );
  const completedVolume = useMemo(
    () => (allTransactions || [])
      .filter((transaction: any) => ['approved', 'completed'].includes(String(transaction.status || '').toLowerCase()))
      .reduce((acc: number, transaction: any) => acc + Number(transaction.amount || 0), 0),
    [allTransactions],
  );
  const failedTransactionsCount = useMemo(
    () => (allTransactions || []).filter((transaction: any) => ['rejected', 'failed'].includes(String(transaction.status || '').toLowerCase())).length,
    [allTransactions],
  );
  const financeOverviewCards = [
    {
      label: 'Volume aprovado',
      value: `R$ ${completedVolume.toFixed(2)}`,
      tone: 'emerald',
      helper: 'Transacoes aprovadas ou concluidas.',
    },
    {
      label: 'Pedidos em disputa',
      value: String(refundRequests.length),
      tone: refundRequests.length > 0 ? 'rose' : 'slate',
      helper: `R$ ${totalInDispute.toFixed(2)} aguardando decisao.`,
    },
    {
      label: 'Falhas recentes',
      value: String(failedTransactionsCount),
      tone: failedTransactionsCount > 0 ? 'amber' : 'slate',
      helper: 'Falhas ou rejeicoes no fluxo financeiro.',
    },
    {
      label: 'Gateway ativo',
      value: 'Stripe',
      tone: 'indigo',
      helper: systemSettings?.features?.recurringEnabled ? 'Recorrencia habilitada.' : 'Recorrencia desativada.',
    },
  ] as const;

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
      descrição: transaction.transactionName || transaction.materialTitle || transaction.planName || 'Plano de Assinatura',
      comprador: transaction.buyerName || '',
      vendedor: transaction.sellerName || 'Plataforma',
      provedor: transaction.paymentProvider || '',
      metodo: transaction.paymentMethodLabel || transaction.paymentMethod || '',
      referencia: transaction.providerTransactionId || transaction.referenceId || transaction.externalId || '',
      valor: readTransactionAmount(transaction).toFixed(2),
      taxa: (isMarketplaceTransaction(transaction) ? readTransactionPlatformFee(transaction) : readTransactionAmount(transaction)).toFixed(2),
      liquido: Number(transaction.netAmount ?? (readTransactionAmount(transaction) - (isMarketplaceTransaction(transaction) ? readTransactionPlatformFee(transaction) : readTransactionAmount(transaction)))).toFixed(2),
      status: formatTransactionStatusLabel(transaction.status || ''),
      invoice: transaction.invoiceNumber || transaction.providerInvoiceId || '',
    }));

    const header = Object.keys(rows[0] || {
      id: '', data: '', tipo: '', descrição: '', comprador: '', vendedor: '', provedor: '', metodo: '', referencia: '', valor: '', taxa: '', liquido: '', status: '', invoice: '',
    });
    const csv = [
      header.join(';'),
      ...rows.map((row) => header.map((key) => `"${String((row as any)[key] ?? '').replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transações-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast('Exportação CSV gerada com sucesso.', 'success');
  };

  const handleSavePricing = async () => {
    if (isSavingPricing) return;

    setIsSavingPricing(true);
    try {
      const persistedSettings = await saveSystemSettingsNow(financeSettings);
      applyPersistedFinanceSettings(persistedSettings);
      addToast('Planos e regras de acesso salvos com sucesso.', 'success');
    } catch (error) {
      console.error('Error saving pricing settings:', error);
      addToast('Não foi possível salvar as configurações dos planos.', 'error');
    } finally {
      setIsSavingPricing(false);
    }
  };

  // --- HANDLERS EXISTENTES ---
  const handleDescriptionChange = (plan: string, description: string) => {
    const updatedPricing = { ...draftPricing };
    const planConfig = updatedPricing[plan];
    planConfig.description = description;
    setDraftPricing(updatedPricing);
  };

  const handlePlanDisplayNameChange = (plan: PlanName, displayName: string) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    updatedPlanDetails[plan] = {
      ...updatedPlanDetails[plan],
      displayName,
    };
    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleTogglePlanEnabled = (plan: PlanName) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    updatedPlanDetails[plan] = {
      ...updatedPlanDetails[plan],
      enabled: !(updatedPlanDetails[plan]?.enabled !== false),
    };
    setDraftPlanDetails(updatedPlanDetails);
  };

  const handlePriceChange = (plan: string, monthlyValue: number) => {
    const updatedPricing = { ...draftPricing };
    const planConfig = updatedPricing[plan];
    planConfig.monthly = monthlyValue;
    const qDesc = planConfig.quarterlyDiscountPercent || 10;
    const aDesc = planConfig.annualDiscountPercent || 30;
    planConfig.quarterly = (monthlyValue * 3) * (1 - qDesc / 100);
    planConfig.annual = (monthlyValue * 12) * (1 - aDesc / 100);
    setDraftPricing(updatedPricing);
  };

  const handleDiscountPercentChange = (plan: string, type: 'quarterly' | 'annual', percent: number) => {
    const updatedPricing = { ...draftPricing };
    const planConfig = updatedPricing[plan];
    if (type === 'quarterly') planConfig.quarterlyDiscountPercent = percent;
    else planConfig.annualDiscountPercent = percent;
    planConfig.quarterly = (planConfig.monthly * 3) * (1 - (planConfig.quarterlyDiscountPercent || 0) / 100);
    planConfig.annual = (planConfig.monthly * 12) * (1 - (planConfig.annualDiscountPercent || 0) / 100);
    setDraftPricing(updatedPricing);
  };

  const handleTogglePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;
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

    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleUpdatePlanFeatureText = (plan: string, featureIndex: number, text: string) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;

    plans.forEach(p => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: updatedPlanDetails[p].features.map((f: any, i: number) =>
          i === featureIndex ? { ...f, text } : f
        )
      };
    });

    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleAddPlanFeature = (plan: string) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;
    const planIndex = plans.indexOf(plan as any);
    const featureName = 'Novo Recurso';

    plans.forEach((p, i) => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: [...updatedPlanDetails[p].features, { text: featureName, included: i >= planIndex }]
      };
    });

    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleRemovePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;

    plans.forEach(p => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: updatedPlanDetails[p].features.filter((_: any, i: number) => i !== featureIndex)
      };
    });

    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleMovePlanFeature = (direction: 'up' | 'down', featureIndex: number) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;

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

    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleTogglePlanEntitlement = (plan: typeof PLAN_ORDER[number], benefitKey: PlanBenefitKey) => {
    const updatedEntitlements = normalizePlanEntitlements(draftPlanEntitlements);
    const planIndex = PLAN_ORDER.indexOf(plan);
    const nextValue = !updatedEntitlements[plan][benefitKey].enabled;

    PLAN_ORDER.forEach((planName, index) => {
      if (nextValue && index >= planIndex) {
        updatedEntitlements[planName][benefitKey] = { enabled: true };
      }

      if (!nextValue && index <= planIndex) {
        updatedEntitlements[planName][benefitKey] = { enabled: false };
      }
    });

    setDraftPlanEntitlements(updatedEntitlements);
  };

  const handlePlanUsageLimitModeChange = (
    plan: PlanName,
    limitKey: PlanUsageLimitKey,
    mode: 'limited' | 'unlimited'
  ) => {
    const updatedLimits = normalizePlanUsageLimits(draftPlanUsageLimits);
    updatedLimits[plan][limitKey] = {
      mode,
      value: mode === 'limited' ? Math.max(0, Number(updatedLimits[plan][limitKey].value || 0)) : null,
    };
    setDraftPlanUsageLimits(updatedLimits);
  };

  const handlePlanUsageLimitValueChange = (
    plan: PlanName,
    limitKey: PlanUsageLimitKey,
    value: number
  ) => {
    const updatedLimits = normalizePlanUsageLimits(draftPlanUsageLimits);
    updatedLimits[plan][limitKey] = {
      mode: 'limited',
      value: Math.max(0, Number.isFinite(value) ? value : 0),
    };
    setDraftPlanUsageLimits(updatedLimits);
  };

  // --- REEMBOLSOS ---
  const { resolveRefund } = useMarketplace();
  const requestResolveRefund = (transactionId: string, resolution: 'approved' | 'retention_offer') => {
    if (refundActionKey) return;
    setPendingRefundDecision({ transactionId, resolution });
  };

  const handleResolveRefund = async () => {
    if (!pendingRefundDecision) return;

    const nextKey = `${pendingRefundDecision.transactionId}:${pendingRefundDecision.resolution}`;
    setRefundActionKey(nextKey);

    try {
      await resolveRefund(pendingRefundDecision.transactionId, pendingRefundDecision.resolution);
    } finally {
      setRefundActionKey(null);
      setPendingRefundDecision(null);
    }
  };

  const openStripeTestingRunModal = (testCase: any) => {
    if (!isAdminViewer) return;
    if (String(testCase?.platform_status || '').toLowerCase() !== 'supported') return;

    setStripeTestingRunScenario(testCase);
    setStripeTestingRunForm({
      execution_result: 'passed',
      payment_intent_id: '',
      subscription_id: '',
      transaction_id: '',
      evidence_url: '',
      gateway_message: '',
      notes: '',
    });
  };

  const closeStripeTestingRunModal = () => {
    if (stripeTestingRunSaving) return;
    setStripeTestingRunScenario(null);
  };

  const submitStripeTestingRun = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripeTestingRunScenario || !isAdminViewer) return;

    setStripeTestingRunSaving(true);
    try {
      const payload = await subscriptionsService.createStripeTestingRun({
        scenario_id: String(stripeTestingRunScenario.id),
        execution_result: stripeTestingRunForm.execution_result,
        payment_intent_id: stripeTestingRunForm.payment_intent_id,
        subscription_id: stripeTestingRunForm.subscription_id,
        transaction_id: stripeTestingRunForm.transaction_id,
        evidence_url: stripeTestingRunForm.evidence_url,
        gateway_message: stripeTestingRunForm.gateway_message,
        notes: stripeTestingRunForm.notes,
      });

      addToast('Evidencia de teste registrada com sucesso.', 'success');
      setStripeTestingRunScenario(null);
      setStripeTestingRuns((prev) => [payload, ...prev].slice(0, 120));
    } catch (error: any) {
      const message = String(error?.response?.data?.message || error?.message || 'Nao foi possivel registrar a evidencia do teste.');
      addToast(message, 'error');
    } finally {
      setStripeTestingRunSaving(false);
    }
  };

  const selectedSeller = viewingSellerDetails ? sellersMetrics.find(s => s.id === viewingSellerDetails) : null;

  return (
    <div className="space-y-5 animate-slide-up md:space-y-6">
      <AdminConfirmDialog
        isOpen={pendingRefundDecision !== null}
        title={pendingRefundDecision?.resolution === 'approved' ? 'Aprovar reembolso' : 'Enviar proposta para continuar'}
        description={
          pendingRefundDecision?.resolution === 'approved'
            ? 'A transacao selecionada sera marcada como reembolsada e o estado local sera recarregado pelo fluxo oficial.'
            : 'O usuario recebera um email com uma proposta de permanencia baseada no motivo informado. A solicitacao continuara em analise.'
        }
        confirmLabel={pendingRefundDecision?.resolution === 'approved' ? 'Aprovar reembolso' : 'Enviar proposta'}
        tone="primary"
        loading={refundActionKey !== null}
        onConfirm={() => void handleResolveRefund()}
        onCancel={() => {
          setPendingRefundDecision(null);
          setRefundActionKey(null);
        }}
      />

      {stripeTestingRunScenario && isAdminViewer && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className={`${ADMIN_MODAL_PANEL_CLASS} w-full max-w-3xl shadow-2xl`}>
            <div className={`${ADMIN_MODAL_HEADER_CLASS} sm:px-6 sm:py-5`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Execucao guiada</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{String(stripeTestingRunScenario.scenario || '-')}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Referencia Stripe: <span className="font-mono font-black text-sky-700 dark:text-sky-300">{String(stripeTestingRunScenario.stripe_reference || '-')}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeStripeTestingRunModal}
                className="rounded-sm p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(event) => void submitStripeTestingRun(event)} className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} px-4 py-3`}>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Resultado esperado</p>
                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">{String(stripeTestingRunScenario.expected_outcome || '-')}</p>
              </div>

              {Array.isArray(stripeTestingRunScenario.execution_steps) && stripeTestingRunScenario.execution_steps.length > 0 && (
                <div className="rounded-sm border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/30 dark:bg-sky-900/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Passo a passo</p>
                  <ul className="mt-2 list-decimal space-y-1.5 pl-4 text-xs font-medium text-sky-700/90 dark:text-sky-200">
                    {stripeTestingRunScenario.execution_steps.map((step: string, index: number) => (
                      <li key={`run-step-${index}`}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Resultado da execucao</label>
                  <select
                    value={stripeTestingRunForm.execution_result}
                    onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, execution_result: event.target.value as 'passed' | 'failed' | 'blocked' }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full text-xs font-black uppercase tracking-[0.1em]`}
                  >
                    <option value="passed">Passou</option>
                    <option value="failed">Falhou</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">URL da evidencia (opcional)</label>
                  <input
                    type="text"
                    value={stripeTestingRunForm.evidence_url}
                    onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, evidence_url: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full text-xs font-bold`}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">PaymentIntent</label>
                  <input
                    type="text"
                    value={stripeTestingRunForm.payment_intent_id}
                    onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, payment_intent_id: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-mono text-xs font-bold`}
                    placeholder="pi_..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Subscription</label>
                  <input
                    type="text"
                    value={stripeTestingRunForm.subscription_id}
                    onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, subscription_id: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-mono text-xs font-bold`}
                    placeholder="sub_..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Transaction local</label>
                  <input
                    type="text"
                    value={stripeTestingRunForm.transaction_id}
                    onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, transaction_id: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-mono text-xs font-bold`}
                    placeholder="tx_..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Mensagem observada no gateway (opcional)</label>
                <input
                  type="text"
                  value={stripeTestingRunForm.gateway_message}
                  onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, gateway_message: event.target.value }))}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full text-xs font-bold`}
                  placeholder="Ex.: generic_decline, authentication_required..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Notas da execucao</label>
                <textarea
                  value={stripeTestingRunForm.notes}
                  onChange={(event) => setStripeTestingRunForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={4}
                  className={`${ADMIN_TEXTAREA_CLASS} w-full text-xs font-medium`}
                  placeholder="Resumo objetivo da execucao e resultado."
                />
              </div>

              <div className={`${ADMIN_MODAL_FOOTER_CLASS} -mx-4 flex items-center justify-end gap-2 px-4 pt-4 sm:-mx-6 sm:px-6`}>
                <button
                  type="button"
                  onClick={closeStripeTestingRunModal}
                  disabled={stripeTestingRunSaving}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={stripeTestingRunSaving}
                  className={ADMIN_PRIMARY_BUTTON_CLASS}
                >
                  {stripeTestingRunSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Registrar evidencia
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {standaloneSection ? null : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {financeOverviewCards.map((card) => (
                <div
                  key={card.label}
                  className={"rounded-sm border px-4 py-4 transition-colors sm:px-5 " + (card.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10' : card.tone === 'rose' ? 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10' : card.tone === 'amber' ? 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10' : card.tone === 'indigo' ? 'border-sky-200 bg-sky-50 dark:border-sky-900/30 dark:bg-sky-900/10' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900')}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">{card.value}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{card.helper}</p>
                </div>
              ))}
            </div>
            <div className={`${ADMIN_PAGE_PANEL_CLASS} sm:p-5`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Dominio financeiro</p>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">Transacoes, planos, cupons e automacao</p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Acoes criticas exibem sucesso apenas apos persistencia real. Transacoes, automacao e configuracoes comerciais seguem o fluxo oficial.
              </p>
            </div>
          </div>
          <div className={`${ADMIN_SEGMENTED_TABS_CLASS} overflow-x-auto no-scrollbar`}>
            <button
              onClick={() => changeSection('transactions')}
              className={"rounded-md border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all " + (activeSection === 'transactions' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS)}
            >
              <div className="flex items-center gap-2"><FileText size={14} /> Transacoes</div>
            </button>
            <button
              onClick={() => changeSection('plans')}
              className={"rounded-md border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all " + (activeSection === 'plans' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS)}
            >
              <div className="flex items-center gap-2"><CreditCard size={14} /> Planos</div>
            </button>
            <button
              onClick={() => changeSection('coupons')}
              className={"rounded-md border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all " + (activeSection === 'coupons' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS)}
            >
              <div className="flex items-center gap-2"><Tag size={14} /> Cupons</div>
            </button>
            <button
              onClick={() => changeSection('analytics')}
              className={"rounded-md border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all " + (activeSection === 'analytics' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS)}
            >
              <div className="flex items-center gap-2"><TrendingUp size={14} /> Analytics</div>
            </button>
            <button
              onClick={() => changeSection('automation')}
              className={"rounded-md border px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all " + (activeSection === 'automation' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS)}
            >
              <div className="flex items-center gap-2"><Terminal size={14} /> Automacao</div>
            </button>
          </div>
        </>
      )}


      {activeSection === 'subscriptions' && (
        <div className="space-y-6">
          {/* LISTA DE REPASSES A VENDEDORES - Agora foco principal da aba "Vendedores" */}
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center`}>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><Users size={18} className="text-sky-700 dark:text-sky-300" /> Repasses a vendedores</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={`${ADMIN_FIELD_CLASS} w-[180px] py-0 pl-3 pr-8 text-xs font-bold`}
                >
                  <option value="available_desc">Maior Valor a Repassar</option>
                  <option value="available_asc">Menor Valor a Repassar</option>
                  <option value="date_asc">Data Próxima</option>
                  <option value="date_desc">Data Distante</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4 pl-4 sm:p-6 sm:pl-8">Vendedor</th>
                    <th className="p-4 text-right sm:p-6">Saldo Preso</th>
                    <th className="p-6 text-right">Disponível</th>
                    <th className="p-6 text-center">Dia Pagamento</th>
                    <th className="p-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {sortedSellers.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic sm:p-8">Nenhum vendedor com saldo encontrado.</td></tr>
                  ) : (
                    sortedSellers.map((seller: any) => (
                      <tr key={seller.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="p-4 pl-4 sm:p-6 sm:pl-8">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{seller.name}</div>
                          <div className="text-[10px] text-slate-400">{seller.email}</div>
                        </td>
                        <td className="p-4 text-right font-medium text-amber-600 dark:text-amber-500 sm:p-6">
                          R$ {seller.heldBalance.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm sm:p-6">
                          R$ {seller.availablePayout.toFixed(2)}
                        </td>
                        <td className="p-4 text-center sm:p-6">
                          <div className="inline-flex items-center gap-1 rounded-sm border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            <Calendar size={12} /> {seller.paymentDay ? `Dia ${seller.paymentDay}` : 'Nao definido'}
                          </div>
                        </td>
                        <td className="p-4 text-center sm:p-6">
                          <button
                            onClick={() => setViewingSellerDetails(seller.id)}
                            className="inline-flex items-center rounded-sm border border-slate-300 bg-white px-4 py-2 text-[10px] font-black uppercase text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-sky-900/20"
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
        <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-50 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300 dark:bg-slate-950">
          <div className={`${ADMIN_MODAL_PANEL_CLASS} flex-1 flex flex-col overflow-hidden`}>
            <div className={`${ADMIN_MODAL_HEADER_CLASS} sm:p-6 md:p-8`}>
              <div>
                <span className="mb-2 block w-fit rounded-sm bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Extrato do Vendedor</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedSeller.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedSeller.email}</p>
              </div>
              <button onClick={() => setViewingSellerDetails(null)} className="rounded-sm p-2 text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 md:p-8">
              <div className="rounded-sm border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/20">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">Disponível para Saque</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">R$ {selectedSeller.availablePayout.toFixed(2)}</p>
              </div>
              <div className="rounded-sm border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/20">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-1">Saldo Preso</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {selectedSeller.heldBalance.toFixed(2)}</p>
              </div>
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">Próximo Pagamento</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-200">{selectedSeller.paymentDay ? `Dia ${selectedSeller.paymentDay}` : 'Nao definido'}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-6">Data</th>
                    <th className="p-6">Protocolo</th>
                    <th className="p-6">Material</th>
                    <th className="p-6 text-right">Valor Venda</th>
                    <th className="p-6 text-right">Parte Vendedor</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedSeller.transactions.map((t: any) => {
                    const isHeld = isAdminTransactionHeld(t);
                    const amount = readTransactionAmount(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-6">{new Date(t.timestamp).toLocaleDateString()} <span className="text-[10px] text-slate-400 block">{new Date(t.timestamp).toLocaleTimeString()}</span></td>
                        <td className="p-6 font-mono text-[10px] text-slate-500">{t.id.substring(0, 12).toUpperCase()}...</td>
                        <td className="p-6 font-bold text-slate-800 dark:text-slate-200">{t.materialTitle}</td>
                        <td className="p-6 text-right">R$ {amount.toFixed(2)}</td>
                        <td className="p-6 text-right font-bold text-slate-900 dark:text-slate-100">R$ {Math.max(0, readTransactionAmount(t) - readTransactionPlatformFee(t)).toFixed(2)}</td>
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
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end sm:p-6">
              <button onClick={() => setViewingSellerDetails(null)} className="px-8 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeSection === 'refunds' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-sm border border-red-200 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10">
              <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Em analise (solicitados)</p>
              <h3 className="text-2xl font-black text-red-700 dark:text-red-300">R$ {totalInDispute.toFixed(2)}</h3>
            </div>
            <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-5`}>
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Devolvido</p>
              <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300">R$ {totalRefunded.toFixed(2)}</h3>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex justify-between items-center`}>
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
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
                        <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                          {t.refundReason || 'Não informado'}
                        </span>
                      </td>
                      <td className="p-6 text-right font-black">R$ {t.amount.toFixed(2)}</td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => requestResolveRefund(t.id, 'approved')}
                            className="rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                            title="Aprovar Devolução"
                          >
                            <Check size={16} strokeWidth={3} />
                          </button>
                          <button
                            onClick={() => requestResolveRefund(t.id, 'retention_offer')}
                            className="rounded-sm border border-slate-300 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Enviar proposta"
                          >
                            <MessageSquare size={16} strokeWidth={3} />
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Volume filtrado</p>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
                R$ {financeStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{filteredTransactions.length} registros no recorte atual.</p>
            </div>
            <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Taxa da plataforma</p>
              <p className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {financeStats.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Usa o valor real retornado pelo backend.</p>
            </div>
            <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Líquido consolidado</p>
              <p className="mt-3 text-2xl font-black text-sky-700 dark:text-sky-300">
                R$ {financeStats.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Inclui apenas transacoes pagas e aprovadas.</p>
            </div>
            <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Receita projetada</p>
              <p className="mt-3 text-2xl font-black text-violet-700 dark:text-violet-300">
                {isRevenueProjectionLoading ? '...' : formatAdminMoney(revenueProjection.totalProjectedAmount)}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {revenueProjection.totalRemainingInstallments} parcelas restantes em {revenueProjection.activeContracts} contrato(s), listadas como pre-aprovadas abaixo.
              </p>
            </div>
          </div>

          {projectionMonthRows.length > 0 ? (
            <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
              <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Projecao mes a mes</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Valores previstos das parcelas pre-aprovadas por competencia.
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {projectionMonthRows.length} mes(es) projetado(s)
                </span>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                {projectionMonthRows.slice(0, 12).map((month) => {
                  const amount = Number(month.amount || 0);
                  const atRiskAmount = Number(month.atRiskAmount || 0);
                  const barWidth = Math.max(8, Math.round((amount / maxProjectionMonthAmount) * 100));

                  return (
                    <div key={month.key} className="rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black capitalize text-slate-900 dark:text-slate-100">{month.label}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            {month.installments} parcela(s)
                          </p>
                        </div>
                        <p className="text-right text-sm font-black text-violet-700 dark:text-violet-300">
                          {formatAdminMoney(amount)}
                        </p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-violet-600 dark:bg-violet-400" style={{ width: `${barWidth}%` }} />
                      </div>
                      {atRiskAmount > 0 ? (
                        <p className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          Em risco: {formatAdminMoney(atRiskAmount)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden transition-colors duration-300`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between`}>
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
                    className={`${ADMIN_FIELD_CLASS} w-full pl-9 pr-4 text-xs font-bold sm:w-80`}
                  />
                </div>
                <select
                  value={financeFilters.status}
                  onChange={(e) => {
                    setFinanceFilters({ ...financeFilters, status: e.target.value });
                    setCurrentPage(1);
                  }}
                  className={`${ADMIN_FIELD_CLASS} py-0 pl-3 pr-8 text-xs font-bold`}
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
                  className={`${ADMIN_FIELD_CLASS} py-0 pl-3 pr-8 text-xs font-bold`}
                >
                  <option value="all">Todo o período</option>
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Últimos 30 dias</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportTransactionsCsv}
                  disabled={filteredTransactions.length === 0}
                  className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Download size={14} />
                  Exportar CSV
                </button>
                <div className="flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
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
                    <th className="p-4">Transação</th>
                    <th className="p-4">Data</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Pagamento</th>
                    <th className="p-4">Descrição</th>
                    <th className="p-4">Comprador</th>
                    <th className="p-4">Vendedor</th>
                    <th className="p-4 text-right">Bruto</th>
                    <th className="p-4 text-right">Taxa</th>
                    <th className="p-4 text-right">Líquido</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Fatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {currentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-12 text-center italic text-slate-400 dark:text-slate-600">
                        Nenhuma transação encontrada para os filtros atuais.
                      </td>
                    </tr>
                  ) : currentTransactions.map((transaction: any) => {
                    const referenceCode = transaction.providerTransactionId || transaction.referenceId || transaction.externalId || transaction.id;
                    const invoiceUrl = transaction.invoicePdfUrl || transaction.hostedInvoiceUrl || '';
                    const amount = readTransactionAmount(transaction);
                    const fee = isMarketplaceTransaction(transaction) ? readTransactionPlatformFee(transaction) : amount;
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
                            <div className="mt-1 text-[10px] font-bold text-sky-700 dark:text-sky-300">{transaction.scheduleLabel}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            transaction.type === 'plan'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
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
                              <CreditCard size={14} className="text-sky-700 dark:text-sky-300" />
                            )}
                            <div>
                              <div className="font-bold text-slate-700 dark:text-slate-200">
                                {transaction.paymentMethodLabel || transaction.paymentMethod || 'Cartão'}
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
                              {transaction.description || transaction.planName || transaction.materialTitle || 'Sem descrição adicional'}
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
                        <td className="p-4 text-right font-bold text-sky-700 dark:text-sky-300">
                          R$ {net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-center gap-2">
                            <span className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                              transaction.status === 'refund_requested'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : transaction.status === 'refunded'
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  : transaction.status === 'pre-approved' || transaction.status === 'scheduled'
                                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
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
                                    requestResolveRefund(transaction.id, 'approved');
                                  }}
                                  disabled={isRefundActionLocked}
                                  className="text-[9px] font-black uppercase text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200 underline disabled:opacity-50"
                                >
                                  {refundActionKey === `${transaction.id}:approved` ? 'Aprovando...' : 'Aprovar'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestResolveRefund(transaction.id, 'retention_offer');
                                  }}
                                  disabled={isRefundActionLocked}
                                  className="text-[9px] font-black uppercase text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 underline disabled:opacity-50"
                                >
                                  {refundActionKey === `${transaction.id}:retention_offer` ? 'Enviando...' : 'Enviar proposta'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {invoiceUrl ? (
                            <button
                              onClick={() => window.open(invoiceUrl, '_blank', 'noopener,noreferrer')}
                              className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Download size={12} />
                              PDF
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-600">Indisponível</span>
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
                    <td className="p-4 text-right text-sm font-black text-sky-700 dark:text-sky-300">
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
                  className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-xs font-bold transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-xs font-bold transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'plans' && (
        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden p-5 transition-all duration-300`}>
          <div className="mb-8 border-b border-slate-100 dark:border-slate-800/50 pb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">Configuração de Planos</h3>
            <p className="text-sm text-slate-500 font-medium">Defina preços, descontos e benefícios liberados para cada nível de assinatura.</p>
          </div>
          <div className="flex justify-end mb-6">
            <button
              onClick={() => void handleSavePricing()}
              disabled={isSavingPricing}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {isSavingPricing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSavingPricing ? 'Salvando...' : 'Salvar Planos'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {Object.entries(draftPricing).map(([plan, config]: any) => (
              <div key={plan} className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-6 p-5`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="text-lg font-black text-sky-700 dark:text-sky-300 uppercase tracking-tight">
                        {draftPlanDetails[plan as PlanName]?.displayName || plan}
                      </h4>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        ID canonico: {plan}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePlanEnabled(plan as PlanName)}
                      className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                        draftPlanDetails[plan as PlanName]?.enabled !== false
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {draftPlanDetails[plan as PlanName]?.enabled !== false ? <Check size={11} /> : <X size={11} />}
                      {draftPlanDetails[plan as PlanName]?.enabled !== false ? 'Ativo' : 'Desativado'}
                    </button>
                  </div>
                    <span className="rounded-sm bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-400 dark:bg-slate-700">Valores em Reais</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome exibido do plano</label>
                    <input
                      type="text"
                      value={draftPlanDetails[plan as PlanName]?.displayName || ''}
                      onChange={(e) => handlePlanDisplayNameChange(plan as PlanName, e.target.value)}
                      placeholder="Nome comercial mostrado na vitrine"
                      className={`${ADMIN_FIELD_CLASS} w-full text-xs font-bold`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Comercial</label>
                    <input
                      type="text"
                      value={config.description || ''}
                      onChange={e => handleDescriptionChange(plan, e.target.value)}
                      placeholder="Descrição breve do plano para atrair usuários..."
                      className={`${ADMIN_FIELD_CLASS} w-full text-xs font-bold`}
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
                        className={`${ADMIN_FIELD_CLASS} h-11 w-full pl-12 pr-4 text-lg font-black`}
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
                          className={`${ADMIN_FIELD_CLASS} w-full font-bold`}
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
                          className={`${ADMIN_FIELD_CLASS} w-full font-bold`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className={`${ADMIN_SURFACE_CLASS} space-y-1 p-4 dark:bg-slate-900/50`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Trimestral</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.quarterly.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">≈ R$ {(config.quarterly / 3).toFixed(2)}/mês</p>
                      <p className="text-[9px] text-emerald-500 font-bold">Economia de R$ {(config.monthly * 3 - config.quarterly).toFixed(2)}</p>
                    </div>
                    <div className={`${ADMIN_SURFACE_CLASS} space-y-1 p-4 dark:bg-slate-900/50`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Anual</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.annual.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">≈ R$ {(config.annual / 12).toFixed(2)}/mês</p>
                      <p className="text-[9px] font-bold text-sky-700 dark:text-sky-300">Economia de R$ {(config.monthly * 12 - config.annual).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Recursos do Plano</p>
                    {draftPlanDetails[plan].features.map((feature: any, idx: number) => (
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
                          className="flex-1 bg-transparent text-[11px] font-bold text-slate-600 outline-none transition-colors focus:text-sky-700 dark:text-slate-300 dark:focus:text-sky-300"
                        />
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/feature:opacity-100 transition-all">
                          <button
                            onClick={() => handleMovePlanFeature('up', idx)}
                            disabled={idx === 0}
                            className="p-1 text-slate-300 hover:text-sky-700 disabled:opacity-30 dark:hover:text-sky-300"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMovePlanFeature('down', idx)}
                            disabled={idx === draftPlanDetails[plan].features.length - 1}
                            className="p-1 text-slate-300 hover:text-sky-700 disabled:opacity-30 dark:hover:text-sky-300"
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
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-slate-300 py-2 text-[10px] font-bold text-slate-400 transition-all hover:border-sky-300 hover:text-sky-700 dark:border-slate-700"
                    >
                      <Plus size={12} /> Adicionar Recurso
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} mt-8 overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck size={18} className="text-sky-700 dark:text-sky-300" />
                Controle de Acesso por Plano
              </h4>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Esta matriz define os benefícios reais liberados para cada plano. A interface e os endpoints premium passam a confiar nela para evitar vazamento de recursos de planos superiores.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Benefício</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição</th>
                    {PLAN_ORDER.map((planName) => (
                      <th key={planName} className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {planName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PLAN_BENEFIT_DEFINITIONS.map((benefit) => {
                    const resolvedEntitlements = normalizePlanEntitlements(draftPlanEntitlements);

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
                          const enabled = resolvedEntitlements[planName][benefit.key].enabled;

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

            <div className="border-t border-slate-100 bg-slate-50/40 p-6 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="mb-4">
                <h5 className="text-sm font-black text-slate-900 dark:text-slate-100">Limites operacionais por plano</h5>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Defina numeros maximos ou marque como ilimitado para controlar uso de questoes, comentarios, simulados e IA.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Limite</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descricao</th>
                      {PLAN_ORDER.map((planName) => (
                        <th key={`limit-${planName}`} className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {planName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {PLAN_USAGE_LIMIT_DEFINITIONS.map((limitDefinition) => {
                      const resolvedLimits = normalizePlanUsageLimits(draftPlanUsageLimits);

                      return (
                        <tr key={limitDefinition.key} className="bg-white dark:bg-slate-900/40">
                          <td className="p-4 align-top">
                            <div className="text-sm font-black text-slate-900 dark:text-slate-100">{limitDefinition.label}</div>
                            <div className="mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">{limitDefinition.key}</div>
                          </td>
                          <td className="p-4 align-top text-xs font-medium text-slate-500 dark:text-slate-400">
                            {limitDefinition.description}
                          </td>
                          {PLAN_ORDER.map((planName) => {
                            const currentLimit = resolvedLimits[planName][limitDefinition.key];

                            return (
                              <td key={`${limitDefinition.key}-${planName}`} className="p-4 align-top">
                                <div className="mx-auto flex max-w-[170px] flex-col gap-2">
                                  <div className="inline-flex rounded-sm border border-slate-300 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                                    <button
                                      type="button"
                                      onClick={() => handlePlanUsageLimitModeChange(planName, limitDefinition.key, 'limited')}
                                      className={`flex-1 rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                                        currentLimit.mode === 'limited'
                                          ? 'bg-sky-700 text-white'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      Limite
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePlanUsageLimitModeChange(planName, limitDefinition.key, 'unlimited')}
                                      className={`flex-1 rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                                        currentLimit.mode === 'unlimited'
                                          ? 'bg-emerald-600 text-white'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      Ilimitado
                                    </button>
                                  </div>

                                  {currentLimit.mode === 'limited' ? (
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min={0}
                                        value={currentLimit.value ?? 0}
                                        onChange={(event) => handlePlanUsageLimitValueChange(planName, limitDefinition.key, Number(event.target.value))}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                      />
                                      <div className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                        {limitDefinition.inputLabel}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                                      Sem teto
                                    </div>
                                  )}
                                </div>
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

        </div>
      )}

      {activeSection === 'coupons' && (
        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden transition-all duration-300`}>
          <div className={ADMIN_SURFACE_HEADER_CLASS}>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Tag size={18} className="text-sky-700 dark:text-sky-300" />
              Configuracao de Cupons
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Gerencie cupons, promocao ativa, countdown e temas comerciais em uma pagina propria.
            </p>
          </div>
          <div className="p-5">
            <AdminMarketing
              systemSettings={financeSettings}
              updateSystemSettings={applyPersistedFinanceSettings}
              saveSystemSettingsNow={saveSystemSettingsNow}
              forcedSection="coupons"
              hideSectionTabs
            />
          </div>
        </div>
      )}

      {activeSection === 'analytics' && (
        <AdminFinanceAnalyticsPanel />
      )}
      
      {activeSection === 'automation' && (
        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden transition-colors duration-300`}>
          <div className={ADMIN_SURFACE_HEADER_CLASS}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  <Terminal size={18} className="text-sky-700 dark:text-sky-300" />
                  Automação de cobrança
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  A automação segue o gateway principal configurado no painel e centraliza conciliação, renovação e diagnóstico operacional.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <Cpu size={12} />
                Stripe ativo
              </span>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Provedor</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                  Stripe Billing + Reconciliacao
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  O cron revisa assinaturas, parcelas, invoices e divergencias entre gateway e base local.
                </p>
              </div>
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Frequência recomendada</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">1 vez por hora</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Essa cadência reduz divergências de renovação, conciliação e feedback operacional no financeiro.
                </p>
              </div>
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">URL monitorada</p>
                <p className="break-all text-sm font-black text-sky-700 dark:text-sky-300">{automationCronUrlLabel}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use a URL oficial retornada pelo backend para testes manuais e agendamento no servidor.</p>
              </div>
            </div>

            {automationHelperLoading && (
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Carregando instrucoes oficiais...
              </div>
            )}

            {stripeTestingMatrixLoading && (
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Carregando matriz oficial Stripe...
              </div>
            )}

            {stripeTestingMatrix && (
              <div className={`${ADMIN_SURFACE_CLASS} space-y-5 p-5`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Stripe testing matrix</p>
                    <h4 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Cobertura de cenarios oficiais de teste</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Esta grade consolida os casos da documentacao Stripe e mostra o status real de cobertura no produto.
                    </p>
                  </div>
                  <div className={`${ADMIN_MUTED_SURFACE_CLASS} px-4 py-3 text-right`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total de cenarios</p>
                    <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{stripeTestingSummary.total || stripeTestingCases.length}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Supported</p>
                    <p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-200">{stripeTestingSummary.supported || 0}</p>
                  </div>
                  <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Partial</p>
                    <p className="mt-1 text-xl font-black text-amber-700 dark:text-amber-200">{stripeTestingSummary.partial || 0}</p>
                  </div>
                  <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">Not supported</p>
                    <p className="mt-1 text-xl font-black text-rose-700 dark:text-rose-200">{stripeTestingSummary.not_supported || 0}</p>
                  </div>
                </div>

                {stripeTestingSources.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {stripeTestingSources.map((source: any, index: number) => (
                      <a
                        key={`stripe-source-${index}`}
                        href={String(source.url || '#')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-between gap-2 rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span>{String(source.title || 'Stripe docs')}</span>
                        <ArrowRight size={12} />
                      </a>
                    ))}
                  </div>
                )}

                <div className="rounded-sm border border-slate-300 overflow-hidden dark:border-slate-700">
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full text-left min-w-[980px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                        <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                          <th className="px-4 py-3">Categoria</th>
                          <th className="px-4 py-3">Cenario</th>
                          <th className="px-4 py-3">Referencia Stripe</th>
                          <th className="px-4 py-3">Resultado esperado</th>
                          <th className="px-4 py-3">Status plataforma</th>
                          <th className="px-4 py-3">Fluxo</th>
                          {isAdminViewer && <th className="px-4 py-3">Acao</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stripeTestingCases.map((testCase: any) => {
                          const status = String(testCase.platform_status || '').toLowerCase();
                          const statusTone =
                            status === 'supported'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : status === 'partial'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
                          const statusIcon =
                            status === 'supported'
                              ? <CheckCircle2 size={12} />
                              : status === 'partial'
                                ? <AlertTriangle size={12} />
                                : <XCircle size={12} />;

                          return (
                            <tr key={String(testCase.id)} className="align-top">
                              <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-300">{String(testCase.category_id || '-')}</td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-black text-slate-900 dark:text-slate-100">{String(testCase.scenario || '-')}</p>
                                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{String(testCase.notes || '-')}</p>
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-sky-700 dark:text-sky-300">{String(testCase.stripe_reference || '-')}</td>
                              <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">{String(testCase.expected_outcome || '-')}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone}`}>
                                  {statusIcon}
                                  {status || 'unknown'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{String(testCase.platform_flow || '-')}</td>
                              {isAdminViewer && (
                                <td className="px-4 py-3">
                                  {status === 'supported' ? (
                                    <button
                                      type="button"
                                      onClick={() => openStripeTestingRunModal(testCase)}
                                      className="inline-flex h-8 items-center gap-1 rounded-sm border border-sky-200 bg-sky-50 px-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-sky-700 transition-all hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                                    >
                                      <Play size={11} />
                                      Rodar teste
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {isAdminViewer && (
              <div className={`${ADMIN_SURFACE_CLASS} space-y-4 p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Evidencias registradas</p>
                    <h4 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Historico de execucao guiada</h4>
                  </div>
                  <span className="rounded-sm border border-slate-300 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {stripeTestingRuns.length} registros
                  </span>
                </div>

                {stripeTestingRunsLoading ? (
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    Carregando evidencias...
                  </div>
                ) : stripeTestingRuns.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-slate-300 px-4 py-8 text-center text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Nenhuma evidencia registrada ainda.
                  </div>
                ) : (
                  <div className="rounded-sm border border-slate-300 overflow-hidden dark:border-slate-700">
                    <div className="max-h-[320px] overflow-auto">
                      <table className="w-full text-left min-w-[920px]">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                          <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Cenario</th>
                            <th className="px-4 py-3">Resultado</th>
                            <th className="px-4 py-3">Evidencias</th>
                            <th className="px-4 py-3">Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {stripeTestingRuns.map((run: any) => {
                            const runResult = String(run.execution_result || '').toLowerCase();
                            const resultTone =
                              runResult === 'passed'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : runResult === 'failed'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
                            const evidence = run?.evidence || {};

                            return (
                              <tr key={String(run.run_id)} className="align-top">
                                <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-300">
                                  {run.created_at ? new Date(run.created_at).toLocaleString('pt-BR') : '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs font-black text-slate-900 dark:text-slate-100">{String(run.scenario_label || run.scenario_id || '-')}</p>
                                  <p className="mt-1 font-mono text-[11px] font-bold text-sky-700 dark:text-sky-300">{String(run.stripe_reference || '-')}</p>
                                  {String(run.notes || '').trim() !== '' && (
                                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{String(run.notes)}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${resultTone}`}>
                                    {runResult || 'unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                  <div className="space-y-1">
                                    {evidence.payment_intent_id ? <p><span className="font-black">PI:</span> <span className="font-mono">{String(evidence.payment_intent_id)}</span></p> : null}
                                    {evidence.subscription_id ? <p><span className="font-black">SUB:</span> <span className="font-mono">{String(evidence.subscription_id)}</span></p> : null}
                                    {evidence.transaction_id ? <p><span className="font-black">TX:</span> <span className="font-mono">{String(evidence.transaction_id)}</span></p> : null}
                                    {evidence.gateway_message ? <p><span className="font-black">Gateway:</span> {String(evidence.gateway_message)}</p> : null}
                                    {evidence.evidence_url ? (
                                      <a
                                        href={String(evidence.evidence_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-black text-sky-700 hover:underline dark:text-sky-300"
                                      >
                                        Abrir evidencia <ArrowRight size={11} />
                                      </a>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-300">
                                  <p>{String(run.executed_by_admin_name || run.executed_by_admin_email || run.executed_by_admin_id || '-')}</p>
                                  <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">{String(run.run_id || '-')}</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-4 p-5`}>
                <div className="flex items-center gap-3">
                  <div className="rounded-sm bg-sky-100 p-2 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                    <Cpu size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Windows / XAMPP</h4>
                </div>
                <ul className="list-decimal space-y-2 pl-4 text-xs font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400">
                  <li>Baixe o script auxiliar do cron.</li>
                  <li>Cadastre a tarefa no Agendador do Windows.</li>
                  <li>Programe a execução horária para manter a conciliação atualizada.</li>
                </ul>
                <button
                  onClick={() => {
                    if (!automationDownloadUrl) {
                      addToast('A URL oficial do helper ainda não foi carregada.', 'error');
                      return;
                    }

                    window.open(automationDownloadUrl, '_blank', 'noopener,noreferrer');
                  }}
                  disabled={!automationDownloadUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-4 py-3 text-[10px] font-black uppercase text-sky-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
                >
                  <Download size={14} />
                  Baixar script .bat
                </button>
              </div>

              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-4 p-5`}>
                <div className="flex items-center gap-3">
                  <div className="rounded-sm bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Globe size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Linux / cPanel</h4>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed text-slate-400">
                  Adicione este comando no gerenciador de cron jobs do servidor:
                </p>
                <div className="rounded-sm border border-slate-700 bg-slate-950 p-3 font-mono text-[10px] text-emerald-400 break-all">
                  {automationCronCommandLabel}
                </div>
                <button
                  onClick={() => {
                    if (!automationCronCommand) {
                      addToast('O comando oficial ainda não foi carregado.', 'error');
                      return;
                    }

                    navigator.clipboard.writeText(automationCronCommand);
                    addToast('Comando copiado!', 'success');
                  }}
                  disabled={!automationCronCommand}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-emerald-700 bg-emerald-700 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:border-emerald-800 hover:bg-emerald-800"
                >
                  <Copy size={14} />
                  Copiar comando
                </button>
              </div>
            </div>

            <div className="rounded-sm border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/30 dark:bg-sky-900/10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 text-sky-700 dark:text-sky-300" size={18} />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-sky-900 dark:text-sky-300">Fluxo operacional ativo</h4>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-sky-800/80 dark:text-sky-300/80">
                    A reconciliacao Stripe revisa invoices, pagamentos, renovacao, parcelas e divergencias entre o gateway e a base local antes de manter a assinatura ativa.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 border-t border-slate-100 dark:border-slate-800 py-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Execução manual para diagnóstico</p>
              <button
                type="button"
                onClick={() => {
                  if (!automationCronUrl) {
                    addToast('A URL oficial do cron ainda não foi carregada.', 'error');
                    return;
                  }

                  window.open(automationCronUrl, '_blank', 'noopener,noreferrer');
                }}
                disabled={!automationCronUrl}
                className={ADMIN_PRIMARY_BUTTON_CLASS + " px-8 py-3 text-[10px] font-black uppercase tracking-widest"}
              >
                <Zap size={14} />
                Executar rotina agora
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
