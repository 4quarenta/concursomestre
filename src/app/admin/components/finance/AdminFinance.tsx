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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Calendar,
  Check,
  CheckCircle2,
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
  MessageSquare,
  Play,
  Plus,
  QrCode,
  Search,
  Save,
  ShieldAlert,
  ShieldCheck,
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
import { useMarketplace } from '@providers/MarketplaceProvider';
import { useToast } from '@providers/ToastProvider';
import type {
  DiscountCode,
  Material,
  PlanBenefitKey,
  PlanConfig,
  PlanName,
  PlanPricing,
  PlanUsageLimitKey,
  SystemSettings,
  Transaction,
  UserProfile,
} from '@types';
import { adminService, type AdminPlanCatalogItem, type AdminRevenueProjectionItem, type AdminRevenueProjectionPayload } from '@services/admin/adminService';
import { subscriptionsService } from '@services/subscriptions';
import { readApiErrorMessage } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';
import { PLAN_DETAILS, PRICING } from '@constants';
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  DEFAULT_PLAN_USAGE_LIMITS,
  PLAN_BENEFIT_DEFINITIONS,
  PLAN_ORDER,
  PLAN_USAGE_LIMIT_DEFINITIONS,
  getPublicPlanFeaturesForPlan,
  normalizePlanEntitlements,
  normalizePlanUsageLimits,
} from '@constants/subscriptions/planEntitlements';
import { buildAdminMarketplaceSellerMetrics, type AdminMarketplaceSellerMetric } from '../shared/adminMarketplaceMetrics';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import AdminMarketing from './AdminMarketing';
import AdminFinanceAnalyticsPanel from './AdminFinanceAnalyticsPanel';
import { buildAdminUserEditPath } from '../../config/adminPageNavigationConfig';
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
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
  allTransactions: Transaction[];
  allMaterials?: Material[];
  allUsers: UserProfile[];
  initialSection?: 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics' | 'balance' | 'prices' | 'marketing' | 'plans-coupons';
  onSectionChange?: (section: 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics') => void;
  standaloneSection?: boolean;
}

type FinanceSection = 'subscriptions' | 'transactions' | 'refunds' | 'plans' | 'coupons' | 'automation' | 'analytics';
type PlansPanelTab = 'configuration' | 'access';
type PlanAccessTab = 'general' | 'modules';

type ExtendedPlanPricing = PlanPricing & {
  description?: string;
};
type PricingByPlan = Record<PlanName, ExtendedPlanPricing>;
type PlanDetailsByPlan = Record<PlanName, PlanConfig>;
type CouponDraft = DiscountCode;

type AdminFinanceTransaction = {
  id?: string;
  buyerId?: string;
  buyerName?: string;
  materialId?: string;
  materialTitle?: string;
  sellerId?: string;
  amount?: number;
  platformFee?: number;
  status?: string;
  type?: string;
  paymentProvider?: string;
  timestamp?: number;
  internalId?: string;
  externalId?: string;
  referenceId?: string;
  providerTransactionId?: string;
  providerInvoiceId?: string;
  transactionName?: string;
  planName?: string;
  description?: string;
  buyerEmail?: string;
  sellerName?: string;
  sellerEmail?: string;
  paymentMethod?: string;
  paymentMethodLabel?: string;
  platform_fee?: number;
  invoiceNumber?: string;
  invoicePdfUrl?: string;
  hostedInvoiceUrl?: string;
  netAmount?: number;
  seller_id?: string;
  material_id?: string;
  scheduleLabel?: string;
  dateFormatted?: string;
  dateTimeFormatted?: string;
  installmentNumber?: number;
  installmentCount?: number;
  isRevenueProjection?: boolean;
};

type AutomationHelperData = {
  download_url?: string;
  cron_url?: string;
  linux_command?: string;
  message?: string;
  summary?: unknown;
  data?: {
    summary?: unknown;
  };
  [key: string]: unknown;
};

type AutomationHealthRecord = Record<string, unknown>;

type StripeTestingMatrixCase = Record<string, unknown>;
type StripeTestingSource = {
  url?: string;
  title?: string;
  label?: string;
};
type StripeTestingMatrixSummary = {
  total: number;
  supported: number;
  partial: number;
  not_supported: number;
};
type StripeTestingMatrixData = {
  cases?: StripeTestingMatrixCase[];
  summary?: Partial<StripeTestingMatrixSummary>;
  source?: StripeTestingSource[];
  [key: string]: unknown;
};

type StripeTestingRunEvidence = {
  payment_intent_id?: string;
  subscription_id?: string;
  transaction_id?: string;
  gateway_message?: string;
  evidence_url?: string;
};

type StripeTestingRun = {
  run_id?: string | number;
  created_at?: string;
  scenario_label?: string;
  scenario_id?: string;
  stripe_reference?: string;
  notes?: string;
  execution_result?: string;
  executed_by_admin_name?: string;
  executed_by_admin_email?: string;
  executed_by_admin_id?: string;
  evidence?: StripeTestingRunEvidence;
};

type ProjectionTransactionRow = AdminFinanceTransaction & {
  id: string;
  internalId: string;
  amount: number;
  platformFee: number;
  timestamp: number;
};

type SellerBulkAction = 'activate' | 'suspend' | 'ban';

type AdminCatalogPlanDraft = {
  price: number;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month' | 'year';
  active: boolean;
};

const clonePlanDetails = (source?: Partial<PlanDetailsByPlan>): PlanDetailsByPlan => Object.fromEntries(
  Object.entries(source || {}).map(([plan, config]) => [
    plan,
    {
      ...config,
      features: Array.isArray(config?.features)
        ? config.features.map((feature) => ({ ...feature }))
        : [],
    },
  ]),
) as PlanDetailsByPlan;

const mergePricingWithDefaults = (pricing?: Partial<PricingByPlan>): PricingByPlan => Object.fromEntries(
  Object.entries(PRICING).map(([plan, config]) => [
    plan,
    {
      ...config,
      ...(pricing?.[plan] || {}),
    },
  ]),
) as PricingByPlan;

const mergePlanDetailsWithDefaults = (planDetails?: Partial<PlanDetailsByPlan>): PlanDetailsByPlan => {
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
        ? current.features.map((feature) => ({ ...feature }))
        : defaults[plan].features,
    };
  });

  return defaults;
};

const planNames = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;
const PAID_TRANSACTION_STATUSES = new Set(['completed', 'approved']);
const PLAN_ACCESS_GENERAL_BENEFIT_KEYS: PlanBenefitKey[] = [
  'module.dashboard',
  'module.practice',
  'module.lei_comentada',
  'module.flashcards',
  'module.simulations',
  'module.xray',
  'module.schedule',
  'module.marketplace',
];

const PLAN_ACCESS_MODULE_GROUPS: Array<{
  id: string;
  label: string;
  description: string;
  strategy: string;
  benefitKeys: PlanBenefitKey[];
  limitKeys?: PlanUsageLimitKey[];
}> = [
  {
    id: 'practice',
    label: 'Pratica',
    description: 'Controla filtros, card da questao e recursos internos do modulo de pratica.',
    strategy: 'Trate a pratica como um unico produto: gratuito experimenta, Essencial libera o estudo comum, Pro libera inteligencia e Elite herda tudo.',
    benefitKeys: [
      'practice.filter_keyword',
      'practice.filter_subject',
      'practice.filter_difficulty',
      'practice.filter_bank',
      'practice.filter_organization',
      'practice.filter_year',
      'practice.filter_level',
      'practice.filter_role',
      'practice.filter_modality',
      'practice.filter_topic',
      'practice.filter_saved',
      'practice.filter_teacher_comment',
      'practice.filter_detailed_analysis',
      'practice.filter_answered_correct',
      'practice.filter_answered_wrong',
      'question.resolve',
      'question.answer_key',
      'teacher_comments',
      'question.detailed_analysis',
      'question.save',
      'question.notes',
      'question.share',
      'question.full_statistics',
    ],
    limitKeys: [
      'questions_per_day',
      'saved_questions_limit',
    ],
  },
  {
    id: 'legal-commentary',
    label: 'Lei comentada',
    description: 'Controla recursos editoriais, questoes, analise detalhada e anotacoes por artigo.',
    strategy: 'A lei pode ser uma vitrine no gratuito e virar ferramenta completa nos planos maiores.',
    benefitKeys: [
      'lei.comentario_basico',
      'lei.doutrina',
      'lei.macete',
      'lei.como_cai',
      'lei.jurisprudencia',
      'lei.sumulas',
      'lei.questoes',
      'lei.raiox',
      'lei.anotacoes',
      'lei.modo_foco',
      'lei.favoritos',
      'lei.solicitar_comentario',
    ],
    limitKeys: [
      'lei_related_questions_limit',
      'lei_annotations_limit',
      'lei_favorites_limit',
    ],
  },
  {
    id: 'simulations',
    label: 'Simulados',
    description: 'Controla simulados e recorrencia de criacao/execucao por plano.',
    strategy: 'Mantenha o gratuito como degustacao e libere volume maior conforme o plano avanca.',
    benefitKeys: [
      'exclusive_simulations',
    ],
    limitKeys: [
      'simulations_per_week',
      'simulations_per_month',
    ],
  },
  {
    id: 'community',
    label: 'Comentarios',
    description: 'Controla interacoes sociais e limites de participacao nos comentarios.',
    strategy: 'Comentarios ajudam engajamento, mas limites evitam spam nos planos menores.',
    benefitKeys: [
      'community_comments',
    ],
    limitKeys: [
      'comments_per_day',
    ],
  },
  {
    id: 'premium',
    label: 'Automacoes e premium',
    description: 'Recursos de alto valor percebido, melhores para Pro e Elite.',
    strategy: 'Elite deve vender inteligencia, prioridade, trilhas e novidades primeiro.',
    benefitKeys: [
      'xray_banca',
      'mentor_chat',
      'priority_support',
      'early_access',
    ],
  },
];

const isPaidTransactionStatus = (status: unknown) => PAID_TRANSACTION_STATUSES.has(String(status || '').toLowerCase());

const readTransactionAmount = (transaction: Partial<AdminFinanceTransaction>) => Number(transaction?.amount || 0);

const readRecordValue = (record: object | null | undefined, key: string) => (
  (record as Record<string, unknown> | null | undefined)?.[key]
);

const readMarketplaceMaterialSellerId = (material: Material | null | undefined) => String(
  material?.authorId
  || readRecordValue(material, 'author_id')
  || readRecordValue(material, 'sellerId')
  || readRecordValue(material, 'seller_id')
  || '',
).trim();

const readMarketplaceMaterialTimestamp = (material: Material | null | undefined) => {
  const rawCreatedAt = material?.createdAt ?? readRecordValue(material, 'created_at');
  if (typeof rawCreatedAt === 'number' && Number.isFinite(rawCreatedAt)) {
    return rawCreatedAt;
  }

  const parsed = Date.parse(String(rawCreatedAt || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readTransactionPlatformFee = (transaction: Partial<AdminFinanceTransaction>) => {
  const amount = readTransactionAmount(transaction);
  const platformFee = Number(transaction?.platformFee ?? transaction?.platform_fee);
  return Number.isFinite(platformFee) && platformFee > 0 ? platformFee : amount * 0.20;
};

const isMarketplaceTransaction = (transaction: Partial<AdminFinanceTransaction>) => {
  const type = String(transaction?.type || '').toLowerCase();
  return type !== 'plan'
    && type !== 'subscription'
    && Boolean(transaction?.sellerId || transaction?.seller_id || transaction?.materialId || transaction?.material_id);
};

const isAdminTransactionHeld = (transaction: Partial<AdminFinanceTransaction>) => {
  const timestamp = Number(transaction?.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;

  return (Date.now() - timestamp) < (7 * 24 * 60 * 60 * 1000);
};

const EMPTY_REVENUE_PROJECTION: AdminRevenueProjectionPayload = {
  totalProjectedAmount: 0,
  totalRemainingInstallments: 0,
  activeContracts: 0,
  atRiskProjectedAmount: 0,
  overduePaymentCount: 0,
  overduePaymentAmount: 0,
  overduePayments: [],
  breakdownByCycle: [],
  breakdownByMonth: [],
  items: [],
};

const formatAdminMoney = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SELLER_BULK_ACTION_LABEL: Record<SellerBulkAction, string> = {
  activate: 'Ativar',
  suspend: 'Suspender',
  ban: 'Banir',
};

const SELLER_BULK_ACTION_STATUS: Record<SellerBulkAction, UserProfile['status']> = {
  activate: 'active',
  suspend: 'suspended',
  ban: 'banned',
};

const getSellerStatusLabel = (value: unknown) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'active') return 'Ativo';
  if (normalized === 'suspended') return 'Suspenso';
  if (normalized === 'banned') return 'Banido';
  if (normalized === 'pending') return 'Pendente';
  return normalized || 'Ativo';
};

const getSellerStatusBadgeClass = (value: unknown) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'banned') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300';
  }
  if (normalized === 'suspended') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (normalized === 'pending') {
    return 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300';
};

const readAutomationHealthRecord = (
  payload: AutomationHelperData | null | undefined,
  key: 'cron_health' | 'webhook_health',
): AutomationHealthRecord | null => {
  const value = payload?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AutomationHealthRecord
    : null;
};

const formatAutomationHealthDate = (value: unknown, fallback: string) => {
  const date = typeof value === 'string' && value.trim() !== '' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
    : fallback;
};

const getAutomationHealthCardClass = (tone: 'emerald' | 'amber' | 'rose' | 'slate') => {
  if (tone === 'emerald') {
    return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10';
  }
  if (tone === 'amber') {
    return 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10';
  }
  if (tone === 'rose') {
    return 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10';
  }
  return 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40';
};

const getAutomationHealthTextClass = (tone: 'emerald' | 'amber' | 'rose' | 'slate') => {
  if (tone === 'emerald') return 'text-emerald-700 dark:text-emerald-300';
  if (tone === 'amber') return 'text-amber-700 dark:text-amber-300';
  if (tone === 'rose') return 'text-rose-700 dark:text-rose-300';
  return 'text-slate-700 dark:text-slate-300';
};

const parseProjectionTimestamp = (value?: string | null) => {
  if (!value) {
    return Date.now();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
};

const addProjectionInterval = (
  timestamp: number,
  offset: number,
  intervalUnit: string = 'month',
  intervalCount: number = 1,
) => {
  const date = new Date(timestamp);
  const amount = Math.max(1, Number(intervalCount || 1)) * offset;

  if (amount <= 0) {
    return date.getTime();
  }

  if (intervalUnit === 'day') {
    date.setDate(date.getDate() + amount);
  } else if (intervalUnit === 'week') {
    date.setDate(date.getDate() + (amount * 7));
  } else if (intervalUnit === 'year') {
    date.setFullYear(date.getFullYear() + amount);
  } else {
    date.setMonth(date.getMonth() + amount);
  }

  return date.getTime();
};

const resolveTransactionDisplayTimestamp = (transaction: Partial<AdminFinanceTransaction>, fallbackTimestamp: number) => {
  const timestamp = Number(transaction?.timestamp || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallbackTimestamp;
};

const getProjectionMonthKeyFromTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const isProjectionTimestampOverdue = (timestamp: number, referenceTimestamp: number = Date.now()) => (
  Number.isFinite(timestamp)
  && timestamp > 0
  && timestamp < referenceTimestamp
);

const resolveProjectionChargeInterval = (item: AdminRevenueProjectionItem): { unit: string; count: number } => {
  const projectionMode = String(item.projectionMode || '').trim();
  const explicitUnit = String(item.chargeIntervalUnit || '').trim().toLowerCase();
  const explicitCount = Number(item.chargeIntervalCount || 0);
  if (explicitUnit && explicitCount > 0) {
    return { unit: explicitUnit, count: explicitCount };
  }

  if (projectionMode === 'installments') {
    const totalInstallments = Math.max(1, Number(item.totalInstallments || item.remainingInstallments || 1));
    const intervalUnit = String(item.intervalUnit || 'month').trim().toLowerCase();
    const intervalCount = Math.max(1, Number(item.intervalCount || 1));

    if (intervalUnit === 'year') {
      return { unit: 'day', count: Math.max(1, Math.round((365 * intervalCount) / totalInstallments)) };
    }

    if (intervalUnit === 'month' && intervalCount > 1) {
      return { unit: 'day', count: Math.max(1, Math.round((30.4375 * intervalCount) / totalInstallments)) };
    }

    return { unit: 'month', count: 1 };
  }

  return {
    unit: String(item.intervalUnit || 'month').trim().toLowerCase() || 'month',
    count: Math.max(1, Number(item.intervalCount || 1)),
  };
};

const buildProjectedTransactionRows = (projection: AdminRevenueProjectionPayload): ProjectionTransactionRow[] => (
  (projection.items || []).flatMap((item) => {
    const remaining = Math.max(0, Number(item.remainingInstallments || 0));
    const installmentAmount = Number(item.installmentAmount || 0);
    const baseTimestamp = parseProjectionTimestamp(item.nextBillingAt || item.currentPeriodEnd || null);
    const chargeInterval = resolveProjectionChargeInterval(item);

    if (remaining <= 0 || installmentAmount <= 0) {
      return [];
    }

    return Array.from({ length: remaining }, (_, index) => {
      const installmentNumber = Number(item.paidInstallments || 0) + index + 1;
      const dueTimestamp = addProjectionInterval(
        baseTimestamp,
        index,
        chargeInterval.unit,
        chargeInterval.count,
      );
      const isAutoRenewProjection = item.projectionMode === 'auto_renew';
      if (isProjectionTimestampOverdue(dueTimestamp)) {
        return null;
      }

      return {
        id: `projection-${item.subscriptionId || item.userId}-${installmentNumber}`,
        internalId: `projection-${item.subscriptionId || item.userId}-${installmentNumber}`,
        referenceId: item.subscriptionId,
        providerTransactionId: item.subscriptionId,
        transactionName: `Receita projetada - ${item.planName || item.cycleLabel}`,
        planName: item.planName || item.cycleLabel,
        description: isAutoRenewProjection
          ? `Renovacao futura ${index + 1} (${item.cycleLabel}).`
          : `Parcela futura ${installmentNumber} de ${item.totalInstallments} (${item.cycleLabel}).`,
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
        scheduleLabel: item.status === 'past_due'
          ? 'Projecao em risco'
          : (isAutoRenewProjection ? 'Renovacao futura' : 'Parcela pre-aprovada'),
        installmentNumber,
        installmentCount: isAutoRenewProjection ? remaining : item.totalInstallments,
        isRevenueProjection: true,
      };
    }).filter(Boolean) as ProjectionTransactionRow[];
  })
);

const buildProjectionMonthBreakdownFromRows = (rows: ProjectionTransactionRow[]) => {
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
    const key = getProjectionMonthKeyFromTimestamp(timestamp);
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
  saveSystemSettingsNow,
  allTransactions,
  allMaterials = [],
  allUsers,
  initialSection = 'transactions',
  onSectionChange,
  standaloneSection = false,
}: AdminFinanceProps) => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
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
  const [plansPanelTab, setPlansPanelTab] = useState<PlansPanelTab>('configuration');
  const [planAccessTab, setPlanAccessTab] = useState<PlanAccessTab>('general');
  const [activePlanAccessModuleGroupId, setActivePlanAccessModuleGroupId] = useState(PLAN_ACCESS_MODULE_GROUPS[0]?.id || 'practice');
  const [financeFilters, setFinanceFilters] = useState({ search: '', status: 'all', dateRange: 'all' });
  const [currentPage, setCurrentPage] = useState(1);
  const [refundActionKey, setRefundActionKey] = useState<string | null>(null);
  const [pendingRefundDecision, setPendingRefundDecision] = useState<{
    transactionId: string;
    resolution: 'approved' | 'retention_offer';
  } | null>(null);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [automationHelper, setAutomationHelper] = useState<AutomationHelperData | null>(null);
  const [automationHelperLoading, setAutomationHelperLoading] = useState(false);
  const [automationHelperRequested, setAutomationHelperRequested] = useState(false);
  const automationHelperRequestRef = useRef(false);
  const [automationRunLoading, setAutomationRunLoading] = useState(false);
  const [automationRunResult, setAutomationRunResult] = useState<unknown>(null);
  const [stripeTestingMatrix, setStripeTestingMatrix] = useState<StripeTestingMatrixData | null>(null);
  const [stripeTestingMatrixLoading, setStripeTestingMatrixLoading] = useState(false);
  const stripeTestingMatrixRequestRef = useRef(false);
  const [stripeTestingRuns, setStripeTestingRuns] = useState<StripeTestingRun[]>([]);
  const [stripeTestingRunsLoading, setStripeTestingRunsLoading] = useState(false);
  const stripeTestingRunsRequestRef = useRef(false);
  const [stripeTestingRunSaving, setStripeTestingRunSaving] = useState(false);
  const [stripeTestingRunScenario, setStripeTestingRunScenario] = useState<StripeTestingMatrixCase | null>(null);
  const [revenueProjection, setRevenueProjection] = useState<AdminRevenueProjectionPayload>(EMPTY_REVENUE_PROJECTION);
  const [isRevenueProjectionLoading, setIsRevenueProjectionLoading] = useState(false);
  const [expandedProjectionMonthKey, setExpandedProjectionMonthKey] = useState<string | null>(null);
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
  const [draftCoupons, setDraftCoupons] = useState<CouponDraft[]>(() => Array.isArray(systemSettings.coupons) ? systemSettings.coupons : []);
  const [draftPlanEntitlements, setDraftPlanEntitlements] = useState(() => normalizePlanEntitlements(systemSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS));
  const [draftPlanUsageLimits, setDraftPlanUsageLimits] = useState(() => normalizePlanUsageLimits(systemSettings.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS));
  const [draftActiveTheme, setDraftActiveTheme] = useState(systemSettings.activeTheme || 'default');
  const [draftActivePromotion, setDraftActivePromotion] = useState(systemSettings.activePromotion || undefined);
  const [catalogPlans, setCatalogPlans] = useState<AdminPlanCatalogItem[]>([]);
  const [catalogPlansLoading, setCatalogPlansLoading] = useState(false);
  const [catalogPlanSavingId, setCatalogPlanSavingId] = useState<number | null>(null);
  const [catalogPlanDrafts, setCatalogPlanDrafts] = useState<Record<number, AdminCatalogPlanDraft>>({});
  const catalogPlansRequestRef = useRef(false);
  const [adminFinanceNowMs, setAdminFinanceNowMs] = useState(0);
  const refundRequests = useMemo(
    () => allTransactions?.filter((t) => String(t.status || '') === 'refund_requested') || [],
    [allTransactions],
  );

  const totalInDispute = useMemo(() => refundRequests.reduce((acc: number, t) => acc + readTransactionAmount(t), 0), [refundRequests]);
  const totalRefunded = useMemo(
    () => allTransactions?.filter((t) => String(t.status || '') === 'refunded').reduce((acc: number, t) => acc + readTransactionAmount(t), 0) || 0,
    [allTransactions],
  );

  // --- NOVOS CALCULOS POR VENDEDOR ---
  const [viewingSellerDetails, setViewingSellerDetails] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'available_desc' | 'available_asc' | 'date_asc' | 'date_desc'>('available_desc');
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatusFilter, setSellerStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned' | 'pending'>('all');
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [sellerBulkAction, setSellerBulkAction] = useState<SellerBulkAction>('activate');
  const [sellerActionLoading, setSellerActionLoading] = useState(false);
  const [sellerMaterialModerationLoadingId, setSellerMaterialModerationLoadingId] = useState<string | null>(null);
  const [pendingSellerBulkConfirmation, setPendingSellerBulkConfirmation] = useState<{
    action: SellerBulkAction;
    sellerIds: string[];
  } | null>(null);
  const [sellerStatusOverrides, setSellerStatusOverrides] = useState<Record<string, UserProfile['status']>>({});
  const automationDownloadUrl = automationHelper?.download_url || '';
  const automationCronUrl = automationHelper?.cron_url || '';
  const automationCronCommand = automationHelper?.linux_command || '';
  const automationHelperUnavailable = automationHelperRequested && !automationHelperLoading && !automationHelper;
  const automationCronUrlLabel = automationCronUrl || (automationHelperUnavailable ? 'URL oficial indisponivel no momento.' : 'Carregando URL oficial...');
  const automationCronCommandLabel = automationCronCommand || (automationHelperUnavailable ? 'Comando oficial indisponivel no momento.' : 'Carregando comando oficial...');
  const automationCronHealth = readAutomationHealthRecord(automationHelper, 'cron_health');
  const automationWebhookHealth = readAutomationHealthRecord(automationHelper, 'webhook_health');
  const automationCronStatus = String(automationCronHealth?.status || (automationHelper?.configured ? 'unknown' : 'error')).toLowerCase();
  const automationWebhookStatus = String(automationWebhookHealth?.status || 'unknown').toLowerCase();
  const automationCronTone = automationCronStatus === 'ok'
    ? 'emerald'
    : ['warning', 'stale', 'unknown'].includes(automationCronStatus)
      ? 'amber'
      : 'rose';
  const automationWebhookTone = ['processed', 'ignored', 'duplicate'].includes(automationWebhookStatus)
    ? 'emerald'
    : automationWebhookStatus === 'unknown'
      ? 'amber'
      : 'rose';
  const automationCronLastRunLabel = formatAutomationHealthDate(automationCronHealth?.last_run_at, 'Nunca executado');
  const automationWebhookLastEventLabel = formatAutomationHealthDate(automationWebhookHealth?.last_event_at, 'Nunca recebido');
  const automationWebhookNeverReceived = !automationWebhookHealth?.last_event_at && automationWebhookStatus === 'unknown';
  const automationCronNeedsAttention = automationCronStatus !== 'ok';
  const automationOperationalWarnings = [
    automationWebhookNeverReceived
      ? 'Webhook Stripe nunca recebido: em ambiente local use Stripe CLI/ngrok para entregar eventos; na VPS configure o endpoint publico e o STRIPE_WEBHOOK_SECRET.'
      : '',
    automationCronNeedsAttention
      ? 'Cron de reconciliacao sem status OK: agende a URL oficial com CRON_SECRET para materializar invoices pagas mesmo quando o aluno nao fizer login.'
      : '',
  ].filter(Boolean);
  const stripeTestingCases = Array.isArray(stripeTestingMatrix?.cases) ? stripeTestingMatrix.cases : [];
  const stripeTestingSummary: StripeTestingMatrixSummary = {
    total: Number(stripeTestingMatrix?.summary?.total || 0),
    supported: Number(stripeTestingMatrix?.summary?.supported || 0),
    partial: Number(stripeTestingMatrix?.summary?.partial || 0),
    not_supported: Number(stripeTestingMatrix?.summary?.not_supported || 0),
  };
  const stripeTestingSources = Array.isArray(stripeTestingMatrix?.source) ? stripeTestingMatrix.source : [];
  const isAdminViewer = String(currentUser?.role || '').toLowerCase() === 'admin';
  const financeSettings = useMemo<SystemSettings>(() => ({
    ...systemSettings,
    pricing: draftPricing,
    planDetails: draftPlanDetails,
    coupons: draftCoupons,
    planEntitlements: draftPlanEntitlements,
    planUsageLimits: draftPlanUsageLimits,
    activeTheme: draftActiveTheme,
    activePromotion: draftActivePromotion,
  }), [draftActivePromotion, draftActiveTheme, draftCoupons, draftPlanDetails, draftPlanEntitlements, draftPlanUsageLimits, draftPricing, systemSettings]);

  const testCatalogPlan = useMemo(() => (
    catalogPlans.find((plan) => plan.is_test_plan)
    || catalogPlans.find((plan) => {
      const intervalUnit = String(plan.interval_unit || '').toLowerCase();
      const intervalCount = Number(plan.interval_count || 0);
      return (intervalUnit === 'day' || intervalUnit === 'week') && intervalCount > 0 && intervalCount <= 7;
    })
    || null
  ), [catalogPlans]);

  const testCatalogPlanDraft = testCatalogPlan ? catalogPlanDrafts[testCatalogPlan.id] : null;

  const syncCatalogPlanDrafts = useCallback((plans: AdminPlanCatalogItem[]) => {
    setCatalogPlanDrafts(() => plans.reduce<Record<number, AdminCatalogPlanDraft>>((acc, plan) => {
      acc[plan.id] = {
        price: Number(plan.price || 0),
        interval_count: Math.max(1, Number(plan.interval_count || 1)),
        interval_unit: (['day', 'week', 'month', 'year'].includes(String(plan.interval_unit || 'month'))
          ? String(plan.interval_unit)
          : 'month') as 'day' | 'week' | 'month' | 'year',
        active: plan.active !== false,
      };
      return acc;
    }, {}));
  }, []);

  const loadPlanCatalog = useCallback(async (options?: { force?: boolean; silent?: boolean }) => {
    if (!options?.force && catalogPlansRequestRef.current) {
      return;
    }

    catalogPlansRequestRef.current = true;
    setCatalogPlansLoading(true);

    try {
      const items = await adminService.getPlanCatalog();
      setCatalogPlans(items);
      syncCatalogPlanDrafts(items);
    } catch (error) {
      if (!options?.silent) {
        const message = readApiErrorMessage(error, 'Nao foi possivel carregar o catalogo de planos.');
        addToast(message, 'error');
      }
    } finally {
      catalogPlansRequestRef.current = false;
      setCatalogPlansLoading(false);
    }
  }, [addToast, syncCatalogPlanDrafts]);

  const usersForSellerMetrics = useMemo<UserProfile[]>(() => (
    (allUsers || []).map((user) => {
      const overrideStatus = sellerStatusOverrides[String(user.id)];
      if (!overrideStatus || overrideStatus === user.status) {
        return user;
      }
      return {
        ...user,
        status: overrideStatus,
      };
    })
  ), [allUsers, sellerStatusOverrides]);

  const sellerUsersById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    usersForSellerMetrics.forEach((user) => {
      map.set(String(user.id), user);
    });
    return map;
  }, [usersForSellerMetrics]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraftPricing(mergePricingWithDefaults(systemSettings.pricing));
      setDraftPlanDetails(mergePlanDetailsWithDefaults(systemSettings.planDetails));
      setDraftCoupons(Array.isArray(systemSettings.coupons) ? systemSettings.coupons : []);
      setDraftPlanEntitlements(normalizePlanEntitlements(systemSettings.planEntitlements || DEFAULT_PLAN_ENTITLEMENTS));
      setDraftPlanUsageLimits(normalizePlanUsageLimits(systemSettings.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS));
      setDraftActiveTheme(systemSettings.activeTheme || 'default');
      setDraftActivePromotion(systemSettings.activePromotion || undefined);
    });

    return () => window.cancelAnimationFrame(frameId);
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
    const frameId = window.requestAnimationFrame(() => {
      setActiveSection(normalizeSection(initialSection));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialSection]);

  useEffect(() => {
    if (activeSection !== 'plans') {
      return;
    }

    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      void loadPlanCatalog();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [activeSection, loadPlanCatalog]);

  useEffect(() => {
    const updateNow = () => setAdminFinanceNowMs(Date.now());
    const frameId = window.requestAnimationFrame(updateNow);
    const intervalId = window.setInterval(updateNow, 60_000);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
    };
  }, []);

  const loadRevenueProjection = useCallback(async (options?: {
    silent?: boolean;
    isCancelled?: () => boolean;
  }) => {
    const isCancelled = options?.isCancelled || (() => false);

    if (!options?.silent && !isCancelled()) {
      setIsRevenueProjectionLoading(true);
    }

    try {
      const payload = await adminService.getFinanceAnalytics({ period: 'all' });
      if (!isCancelled()) {
        setRevenueProjection(payload.revenueProjection || EMPTY_REVENUE_PROJECTION);
      }
    } catch (error) {
      clientLog.warn('Failed to load confirmed revenue projection:', error);
      if (!isCancelled()) {
        setRevenueProjection(EMPTY_REVENUE_PROJECTION);
      }
    } finally {
      if (!options?.silent && !isCancelled()) {
        setIsRevenueProjectionLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'transactions') {
      return;
    }

    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      if (cancelled) return;

      void loadRevenueProjection({ isCancelled: () => cancelled });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [activeSection, loadRevenueProjection]);

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

  const sellersMetrics = useMemo(() => buildAdminMarketplaceSellerMetrics({
    users: usersForSellerMetrics || [],
    materials: allMaterials || [],
    transactions: (allTransactions || []) as unknown as Record<string, unknown>[],
  }), [allMaterials, allTransactions, usersForSellerMetrics]);

  useEffect(() => {
    if (activeSection !== 'automation' || automationHelper || automationHelperRequestRef.current) return;

    let cancelled = false;
    automationHelperRequestRef.current = true;
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
          automationHelperRequestRef.current = false;
          setAutomationHelperRequested(false);
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
      if (!automationHelper) {
        automationHelperRequestRef.current = false;
      }
    };
  }, [activeSection, automationHelper, addToast]);

  useEffect(() => {
    if (activeSection !== 'automation' || stripeTestingMatrix || stripeTestingMatrixRequestRef.current) return;

    let cancelled = false;
    stripeTestingMatrixRequestRef.current = true;
    setStripeTestingMatrixLoading(true);

    subscriptionsService.getStripeTestingMatrix()
      .then((payload) => {
        if (!cancelled) {
          setStripeTestingMatrix(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          stripeTestingMatrixRequestRef.current = false;
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
      if (!stripeTestingMatrix) {
        stripeTestingMatrixRequestRef.current = false;
      }
    };
  }, [activeSection, addToast, stripeTestingMatrix]);

  useEffect(() => {
    if (!isAdminViewer || activeSection !== 'automation' || stripeTestingRunsRequestRef.current) return;
    if (stripeTestingRuns.length > 0) return;

    let cancelled = false;
    stripeTestingRunsRequestRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      if (cancelled) return;

      setStripeTestingRunsLoading(true);

      subscriptionsService.getStripeTestingRuns(80)
        .then((payload) => {
          if (!cancelled) {
            setStripeTestingRuns(Array.isArray(payload?.runs) ? payload.runs : []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            stripeTestingRunsRequestRef.current = false;
            addToast('Nao foi possivel carregar o historico de evidencias dos testes Stripe.', 'error');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setStripeTestingRunsLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      if (stripeTestingRuns.length === 0) {
        stripeTestingRunsRequestRef.current = false;
      }
    };
  }, [activeSection, addToast, isAdminViewer, stripeTestingRuns.length]);

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

  const filteredSellers = useMemo(() => {
    const normalizedSearch = sellerSearch.trim().toLowerCase();

    return sortedSellers.filter((seller) => {
      const status = String(seller.status || 'active').toLowerCase();
      if (sellerStatusFilter !== 'all' && status !== sellerStatusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [seller.id, seller.name, seller.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [sellerSearch, sellerStatusFilter, sortedSellers]);

  const [sellerPage, setSellerPage] = useState(1);
  const SELLERS_PER_PAGE = 12;
  const sellerTotalPages = Math.max(1, Math.ceil(filteredSellers.length / SELLERS_PER_PAGE));
  const sellerPageSafe = Math.min(sellerPage, sellerTotalPages);
  const paginatedSellers = useMemo(
    () => filteredSellers.slice((sellerPageSafe - 1) * SELLERS_PER_PAGE, sellerPageSafe * SELLERS_PER_PAGE),
    [filteredSellers, sellerPageSafe],
  );

  const filteredSellerIds = useMemo(() => filteredSellers.map((seller) => seller.id), [filteredSellers]);
  const sellerIdSet = useMemo(() => new Set(sortedSellers.map((seller) => seller.id)), [sortedSellers]);
  const normalizedSelectedSellerIds = useMemo(
    () => selectedSellerIds.filter((sellerId) => sellerIdSet.has(sellerId)),
    [selectedSellerIds, sellerIdSet],
  );
  const selectedSellerIdsSet = useMemo(() => new Set(normalizedSelectedSellerIds), [normalizedSelectedSellerIds]);
  const allFilteredSelected = filteredSellerIds.length > 0 && filteredSellerIds.every((sellerId) => selectedSellerIdsSet.has(sellerId));

  const projectedTransactionRows = useMemo<ProjectionTransactionRow[]>(
    () => buildProjectedTransactionRows(revenueProjection),
    [revenueProjection],
  );

  const futureProjectedTransactionRows = useMemo(
    () => projectedTransactionRows,
    [projectedTransactionRows],
  );

  const futureProjectedAmount = useMemo(
    () => futureProjectedTransactionRows.reduce((total, row) => total + readTransactionAmount(row), 0),
    [futureProjectedTransactionRows],
  );

  const overduePaymentRows = useMemo(
    () => Array.isArray(revenueProjection.overduePayments) ? revenueProjection.overduePayments : [],
    [revenueProjection.overduePayments],
  );

  const overduePaymentAmount = useMemo(
    () => {
      const payloadAmount = Number(revenueProjection.overduePaymentAmount || 0);
      return payloadAmount > 0
        ? payloadAmount
        : overduePaymentRows.reduce((total, row) => total + Number(row.amount || 0), 0);
    },
    [overduePaymentRows, revenueProjection.overduePaymentAmount],
  );

  const projectionMonthRows = useMemo(() => {
    return buildProjectionMonthBreakdownFromRows(futureProjectedTransactionRows);
  }, [futureProjectedTransactionRows]);

  const maxProjectionMonthAmount = useMemo(
    () => Math.max(1, ...projectionMonthRows.map((month) => Number(month.amount || 0))),
    [projectionMonthRows],
  );

  const projectionRowsByMonth = useMemo(() => futureProjectedTransactionRows.reduce<Record<string, ProjectionTransactionRow[]>>((acc, row) => {
    const timestamp = Number(row.timestamp || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return acc;
    }

    const key = getProjectionMonthKeyFromTimestamp(timestamp);
    acc[key] = [...(acc[key] || []), row];
    return acc;
  }, {}), [futureProjectedTransactionRows]);

  const expandedProjectionMonth = useMemo(
    () => projectionMonthRows.find((month) => month.key === expandedProjectionMonthKey) || null,
    [expandedProjectionMonthKey, projectionMonthRows],
  );

  const expandedProjectionRows = useMemo(
    () => expandedProjectionMonthKey ? (projectionRowsByMonth[expandedProjectionMonthKey] || []) : [],
    [expandedProjectionMonthKey, projectionRowsByMonth],
  );

  const financeTransactionRows = useMemo<AdminFinanceTransaction[]>(
    () => (
      activeSection === 'transactions'
        ? [...((allTransactions || []) as AdminFinanceTransaction[]), ...projectedTransactionRows]
        : ((allTransactions || []) as AdminFinanceTransaction[])
    ),
    [activeSection, allTransactions, projectedTransactionRows],
  );

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>(['completed', 'approved', 'pending', 'pre-approved', 'refunded', 'refund_requested', 'cancelled']);
    (financeTransactionRows || []).forEach((transaction) => {
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
      .filter((transaction) => {
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
      .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));
  }, [activeSection, financeFilters, financeTransactionRows]);

  const financeStats = useMemo<{ totalRevenue: number; totalFees: number; netRevenue: number }>(() => filteredTransactions.reduce((accumulator, transaction) => {
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
      .filter((transaction) => ['approved', 'completed'].includes(String(transaction.status || '').toLowerCase()))
      .reduce((acc: number, transaction) => acc + Number(transaction.amount || 0), 0),
    [allTransactions],
  );
  const failedTransactionsCount = useMemo(
    () => (allTransactions || []).filter((transaction) => ['rejected', 'failed'].includes(String(transaction.status || '').toLowerCase())).length,
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
      const frameId = window.requestAnimationFrame(() => {
        setCurrentPage(totalPages);
      });

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [currentPage, totalPages]);

  const exportTransactionsCsv = () => {
    const rows = filteredTransactions.map((transaction) => ({
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
      ...rows.map((row) => {
        const record = row as Record<string, unknown>;
        return header.map((key) => `"${String(record[key] ?? '').replace(/"/g, '""')}"`).join(';');
      }),
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
      clientLog.warn('Error saving pricing settings:', error);
      addToast('Não foi possível salvar as configurações dos planos.', 'error');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleCatalogPlanDraftChange = (
    planId: number,
    patch: Partial<AdminCatalogPlanDraft>,
  ) => {
    setCatalogPlanDrafts((prev) => {
      const current = prev[planId];
      if (!current) {
        return prev;
      }

      const nextIntervalUnit = (patch.interval_unit ?? current.interval_unit) as AdminCatalogPlanDraft['interval_unit'];
      const nextIntervalCount = Math.max(
        1,
        Number(patch.interval_count ?? current.interval_count),
      );

      return {
        ...prev,
        [planId]: {
          ...current,
          ...patch,
          interval_unit: nextIntervalUnit,
          interval_count: nextIntervalCount,
          price: Number(patch.price ?? current.price),
          active: patch.active ?? current.active,
        },
      };
    });
  };

  const handleCatalogPlanIntervalStep = (planId: number, delta: number) => {
    const plan = catalogPlans.find((item) => item.id === planId);
    if (!plan || plan.can_edit_interval !== true) {
      return;
    }

    const current = catalogPlanDrafts[planId];
    if (!current) {
      return;
    }

    handleCatalogPlanDraftChange(planId, {
      interval_count: Math.min(30, Math.max(1, Number(current.interval_count || 1) + delta)),
      interval_unit: 'day',
    });
  };

  const handleSaveCatalogPlan = async (
    planId: number,
    overrides: Partial<AdminCatalogPlanDraft> = {},
    successMessage = 'Plano atualizado com sucesso.',
  ): Promise<boolean> => {
    const currentDraft = catalogPlanDrafts[planId];
    const draft = currentDraft ? { ...currentDraft, ...overrides } : undefined;
    const plan = catalogPlans.find((item) => item.id === planId);
    if (!draft || catalogPlanSavingId !== null) {
      return false;
    }
    if (!plan) {
      return false;
    }

    setCatalogPlanSavingId(planId);
    try {
      const payload: {
        plan_id: number;
        price: number;
        interval_count?: number;
        interval_unit?: 'day' | 'week' | 'month' | 'year';
        active?: boolean;
      } = {
        plan_id: planId,
        price: Number(draft.price || 0),
      };

      if (plan.can_edit_interval === true) {
        payload.interval_count = Math.max(1, Number(draft.interval_count || 1));
        payload.interval_unit = draft.interval_unit;
      }

      if (plan.can_toggle_active === true) {
        payload.active = draft.active;
      }

      const updatedPlan = await adminService.updatePlanCatalog(payload);

      setCatalogPlans((prev) => prev.map((plan) => (
        plan.id === planId ? updatedPlan : plan
      )));

      handleCatalogPlanDraftChange(planId, {
        price: Number(updatedPlan.price || 0),
        interval_count: Math.max(1, Number(updatedPlan.interval_count || 1)),
        interval_unit: updatedPlan.interval_unit,
        active: updatedPlan.active !== false,
      });

      addToast(successMessage, 'success');
      return true;
    } catch (error) {
      const message = readApiErrorMessage(error, 'Nao foi possivel atualizar o plano selecionado.');
      addToast(message, 'error');
      return false;
    } finally {
      setCatalogPlanSavingId(null);
    }
  };

  const handleToggleTestCatalogPlanActive = async () => {
    if (!testCatalogPlan || !testCatalogPlanDraft || catalogPlanSavingId !== null) {
      return;
    }

    if (testCatalogPlan.can_toggle_active !== true) {
      addToast('Este plano ainda nao permite ativar/desativar. Recarregue o painel apos a migracao do catalogo.', 'error');
      return;
    }

    const nextActive = !testCatalogPlanDraft.active;
    handleCatalogPlanDraftChange(testCatalogPlan.id, { active: nextActive });

    const saved = await handleSaveCatalogPlan(
      testCatalogPlan.id,
      { active: nextActive },
      nextActive ? 'Plano de teste ativado.' : 'Plano de teste desativado.',
    );

    if (!saved) {
      handleCatalogPlanDraftChange(testCatalogPlan.id, { active: testCatalogPlanDraft.active });
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
    const planConfig = { ...updatedPricing[plan] };
    const qDesc = Number(planConfig.quarterlyDiscountPercent ?? 10);
    const aDesc = Number(planConfig.annualDiscountPercent ?? 30);
    updatedPricing[plan] = {
      ...planConfig,
      monthly: monthlyValue,
      quarterly: (monthlyValue * 3) * (1 - qDesc / 100),
      annual: (monthlyValue * 12) * (1 - aDesc / 100),
    };
    setDraftPricing(updatedPricing);
  };

  const handleDiscountPercentChange = (plan: string, type: 'quarterly' | 'annual', percent: number) => {
    const updatedPricing = { ...draftPricing };
    const planConfig = { ...updatedPricing[plan] };
    if (type === 'quarterly') planConfig.quarterlyDiscountPercent = percent;
    else planConfig.annualDiscountPercent = percent;
    planConfig.quarterly = (planConfig.monthly * 3) * (1 - Number(planConfig.quarterlyDiscountPercent ?? 0) / 100);
    planConfig.annual = (planConfig.monthly * 12) * (1 - Number(planConfig.annualDiscountPercent ?? 0) / 100);
    updatedPricing[plan] = planConfig;
    setDraftPricing(updatedPricing);
  };

  const handleTogglePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;
    const planIndex = plans.indexOf(plan as PlanName);
    const newValue = !updatedPlanDetails[plan as keyof typeof updatedPlanDetails].features[featureIndex].included;

    plans.forEach((p, i) => {
      // If turning ON: also turn ON for all planes above
      if (newValue && i >= planIndex) {
        updatedPlanDetails[p] = {
          ...updatedPlanDetails[p],
          features: updatedPlanDetails[p].features.map((f, fi: number) =>
            fi === featureIndex ? { ...f, included: true } : f
          )
        };
      }
      // If turning OFF: also turn OFF for all planes below
      if (!newValue && i <= planIndex) {
        updatedPlanDetails[p] = {
          ...updatedPlanDetails[p],
          features: updatedPlanDetails[p].features.map((f, fi: number) =>
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
        features: updatedPlanDetails[p].features.map((f, i: number) =>
          i === featureIndex ? { ...f, text } : f
        )
      };
    });

    setDraftPlanDetails(updatedPlanDetails);
  };

  const handleAddPlanFeature = (plan: string) => {
    const updatedPlanDetails = clonePlanDetails(draftPlanDetails);
    const plans = planNames;
    const planIndex = plans.indexOf(plan as PlanName);
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
        features: updatedPlanDetails[p].features.filter((_, i: number) => i !== featureIndex)
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
        const originalFeature = currentPlanFeatures.find((orig) => orig.text === f.text);
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
  const { resolveRefund, moderateMaterial, isLoadingTransactions } = useMarketplace();
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

  const handleRunAutomationNow = async () => {
    if (!isAdminViewer || automationRunLoading) return;

    setAutomationRunLoading(true);
    setAutomationRunResult(null);

    try {
      const payload = await subscriptionsService.runAutomationNow();
      const nestedData = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : null;
      const summary = payload.summary ?? nestedData?.summary ?? payload;
      setAutomationRunResult(summary);
      const [refreshedHelper] = await Promise.all([
        subscriptionsService.getAutomationHelperInfo(),
        loadRevenueProjection({ silent: true }),
      ]);
      setAutomationHelper(refreshedHelper);
      addToast(typeof payload.message === 'string' ? payload.message : 'Rotina de automacao executada com sucesso.', 'success');
    } catch (error: unknown) {
      const message = readApiErrorMessage(error, 'Nao foi possivel executar a rotina de automacao.');
      addToast(message, 'error');
    } finally {
      setAutomationRunLoading(false);
    }
  };

  const openStripeTestingRunModal = (testCase: StripeTestingMatrixCase) => {
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
    } catch (error: unknown) {
      const message = readApiErrorMessage(error, 'Nao foi possivel registrar a evidencia do teste.');
      addToast(message, 'error');
    } finally {
      setStripeTestingRunSaving(false);
    }
  };

  const openSellerDetails = (sellerId: string) => {
    setViewingSellerDetails(sellerId);
  };

  const toggleSellerSelection = (sellerId: string) => {
    setSelectedSellerIds((currentIds) => (
      currentIds.includes(sellerId)
        ? currentIds.filter((id) => id !== sellerId)
        : [...currentIds, sellerId]
    ));
  };

  const toggleSelectAllFilteredSellers = () => {
    if (allFilteredSelected) {
      setSelectedSellerIds((currentIds) => currentIds.filter((sellerId) => !filteredSellerIds.includes(sellerId)));
      return;
    }

    setSelectedSellerIds((currentIds) => Array.from(new Set([...currentIds, ...filteredSellerIds])));
  };

  const requestBulkSellerAction = () => {
    if (sellerActionLoading) return;
    if (normalizedSelectedSellerIds.length === 0) {
      addToast('Selecione ao menos um vendedor para aplicar a acao em massa.', 'error');
      return;
    }

    setPendingSellerBulkConfirmation({
      action: sellerBulkAction,
      sellerIds: [...normalizedSelectedSellerIds],
    });
  };

  const runSellerStatusUpdate = async (action: SellerBulkAction, sellerIds: string[]) => {
    if (sellerActionLoading || sellerIds.length === 0) return;

    const nextStatus = SELLER_BULK_ACTION_STATUS[action];
    setSellerActionLoading(true);

    let successCount = 0;
    let failureCount = 0;

    for (const sellerId of sellerIds) {
      const user = sellerUsersById.get(sellerId);
      if (!user) {
        failureCount += 1;
        continue;
      }

      try {
        await adminService.performUserActionWithResult({
          user_id: String(user.id),
          action: 'update_profile',
          name: String(user.name || ''),
          email: String(user.email || ''),
          cpf: user.cpf || '',
          phone: user.phone || '',
          targetExam: user.targetExam || '',
          role: user.role || 'partner',
          status: nextStatus,
          reputation: Number(user.reputation ?? 100),
        });
        successCount += 1;
      } catch (error) {
        failureCount += 1;
        clientLog.warn('Failed to update seller status', error);
      }
    }

    if (successCount > 0) {
      setSellerStatusOverrides((current) => {
        const next = { ...current };
        sellerIds.forEach((sellerId) => {
          next[sellerId] = nextStatus;
        });
        return next;
      });

      addToast(`${successCount} vendedor(es) atualizado(s) para ${getSellerStatusLabel(nextStatus).toLowerCase()}.`, 'success');
    }

    if (failureCount > 0) {
      addToast(`${failureCount} vendedor(es) nao puderam ser atualizados.`, 'error');
    }

    setSelectedSellerIds((currentIds) => currentIds.filter((id) => !sellerIds.includes(id)));
    setPendingSellerBulkConfirmation(null);
    setSellerActionLoading(false);
  };

  const confirmBulkSellerAction = async () => {
    if (!pendingSellerBulkConfirmation) return;
    await runSellerStatusUpdate(
      pendingSellerBulkConfirmation.action,
      pendingSellerBulkConfirmation.sellerIds,
    );
  };

  const requestSingleSellerStatusAction = (sellerId: string, action: SellerBulkAction) => {
    if (sellerActionLoading) return;
    setPendingSellerBulkConfirmation({
      action,
      sellerIds: [sellerId],
    });
  };

  const handleModerateSellerMaterial = async (
    materialId: string,
    status: 'approved' | 'rejected',
  ) => {
    if (sellerMaterialModerationLoadingId) return;

    setSellerMaterialModerationLoadingId(materialId);
    try {
      await moderateMaterial(
        materialId,
        status,
        status === 'approved'
          ? 'Aprovado via painel de vendedores.'
          : 'Rejeitado via painel de vendedores para revisão do conteúdo.',
      );
    } finally {
      setSellerMaterialModerationLoadingId(null);
    }
  };

  const selectedSeller = viewingSellerDetails ? sellersMetrics.find(s => s.id === viewingSellerDetails) : null;
  const selectedSellerUser = selectedSeller ? (sellerUsersById.get(selectedSeller.id) || null) : null;
  const selectedSellerMaterials = useMemo(() => {
    if (!selectedSeller) return [];

    return (allMaterials || [])
      .filter((material) => readMarketplaceMaterialSellerId(material) === selectedSeller.id)
      .sort((left, right) => readMarketplaceMaterialTimestamp(right) - readMarketplaceMaterialTimestamp(left));
  }, [allMaterials, selectedSeller]);

  const activePlanAccessModuleGroup = PLAN_ACCESS_MODULE_GROUPS.find((group) => group.id === activePlanAccessModuleGroupId)
    || PLAN_ACCESS_MODULE_GROUPS[0];
  const activePlanAccessLimitDefinitions = PLAN_USAGE_LIMIT_DEFINITIONS.filter((definition) => (
    activePlanAccessModuleGroup.limitKeys?.includes(definition.key)
  ));

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

      <AdminConfirmDialog
        isOpen={pendingSellerBulkConfirmation !== null}
        title={`Confirmar acao: ${pendingSellerBulkConfirmation ? SELLER_BULK_ACTION_LABEL[pendingSellerBulkConfirmation.action] : ''}`}
        description={
          pendingSellerBulkConfirmation
            ? `${pendingSellerBulkConfirmation.sellerIds.length} vendedor(es) terao status atualizado para ${getSellerStatusLabel(SELLER_BULK_ACTION_STATUS[pendingSellerBulkConfirmation.action]).toLowerCase()}.`
            : ''
        }
        confirmLabel={pendingSellerBulkConfirmation ? SELLER_BULK_ACTION_LABEL[pendingSellerBulkConfirmation.action] : 'Confirmar'}
        cancelLabel="Cancelar"
        tone={pendingSellerBulkConfirmation?.action === 'ban' ? 'danger' : 'primary'}
        loading={sellerActionLoading}
        onConfirm={() => void confirmBulkSellerAction()}
        onCancel={() => {
          if (sellerActionLoading) return;
          setPendingSellerBulkConfirmation(null);
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
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><Users size={18} className="text-sky-700 dark:text-sky-300" /> Vendedores</h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Lista operacional no padrao WordPress com busca, acao em massa e moderacao.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {filteredSellers.length} vendedor(es)
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className={`${ADMIN_FIELD_CLASS} w-[180px] py-0 pl-3 pr-8 text-xs font-bold`}
                >
                  <option value="available_desc">Maior valor disponivel</option>
                  <option value="available_asc">Menor valor disponivel</option>
                  <option value="date_asc">Pagamento mais proximo</option>
                  <option value="date_desc">Pagamento mais distante</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-[320px]">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="search"
                    value={sellerSearch}
                    onChange={(event) => {
                      setSellerSearch(event.target.value);
                      setSellerPage(1);
                    }}
                    placeholder="Buscar vendedor..."
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-9 text-sm`}
                  />
                </div>

                <select
                  value={sellerStatusFilter}
                  onChange={(event) => {
                    setSellerStatusFilter(event.target.value as typeof sellerStatusFilter);
                    setSellerPage(1);
                  }}
                  className={`${ADMIN_FIELD_CLASS} h-10 min-w-[150px] py-0 text-xs font-bold`}
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativos</option>
                  <option value="suspended">Suspensos</option>
                  <option value="banned">Banidos</option>
                  <option value="pending">Pendentes</option>
                </select>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <select
                  value={sellerBulkAction}
                  onChange={(event) => setSellerBulkAction(event.target.value as SellerBulkAction)}
                  className={`${ADMIN_FIELD_CLASS} h-10 min-w-[170px] py-0 text-xs font-bold`}
                >
                  <option value="activate">Ativar selecionados</option>
                  <option value="suspend">Suspender selecionados</option>
                  <option value="ban">Banir selecionados</option>
                </select>
                <button
                  type="button"
                  onClick={requestBulkSellerAction}
                  disabled={sellerActionLoading || normalizedSelectedSellerIds.length === 0}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-10 justify-center px-4 text-xs font-black uppercase tracking-[0.12em]`}
                >
                  {sellerActionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Aplicar
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="w-[52px] p-4 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFilteredSellers}
                        className="h-4 w-4 rounded-sm border-slate-300 text-sky-700 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950"
                        aria-label="Selecionar vendedores filtrados"
                      />
                    </th>
                    <th className="p-4 pl-0 sm:p-6 sm:pl-0">Vendedor</th>
                    <th className="p-4 text-center sm:p-6">Status</th>
                    <th className="p-4 text-center sm:p-6">Materiais</th>
                    <th className="p-4 text-right sm:p-6">Vendas</th>
                    <th className="p-4 text-right sm:p-6">Saldo Preso</th>
                    <th className="p-6 text-right">Disponível</th>
                    <th className="p-6 text-center">Dia Pagamento</th>
                    <th className="p-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {paginatedSellers.length === 0 ? (
                    <tr><td colSpan={9} className="p-6 text-center text-slate-400 italic sm:p-8">Nenhum usuario vendedor encontrado com os filtros atuais.</td></tr>
                  ) : (
                    paginatedSellers.map((seller: AdminMarketplaceSellerMetric) => (
                      <tr key={seller.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="p-4 text-center sm:p-6">
                          <input
                            type="checkbox"
                            checked={selectedSellerIdsSet.has(seller.id)}
                            onChange={() => toggleSellerSelection(seller.id)}
                            className="h-4 w-4 rounded-sm border-slate-300 text-sky-700 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950"
                            aria-label={`Selecionar ${seller.name}`}
                          />
                        </td>
                        <td className="p-4 pl-0 sm:p-6 sm:pl-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{seller.name}</div>
                          <div className="text-[10px] text-slate-400">{seller.email}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => openSellerDetails(seller.id)}
                              className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                            >
                              Ver
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <Link
                              href={buildAdminUserEditPath(seller.id)}
                              className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                            >
                              Editar
                            </Link>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={() => openSellerDetails(seller.id)}
                              className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                            >
                              Vendas
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={() => openSellerDetails(seller.id)}
                              className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                            >
                              Produtos
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center sm:p-6">
                          <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getSellerStatusBadgeClass(seller.status)}`}>
                            {getSellerStatusLabel(seller.status)}
                          </span>
                        </td>
                        <td className="p-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 sm:p-6">
                          {seller.publishedMaterialsCount || 0}/{seller.materialsCount || 0}
                        </td>
                        <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300 sm:p-6">
                          R$ {seller.totalSales.toFixed(2)}
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openSellerDetails(seller.id)}
                              className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-sky-700 transition-colors hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-900/20"
                            >
                              Detalhes
                            </button>
                            {String(seller.status || '').toLowerCase() === 'banned' ? (
                              <button
                                type="button"
                                onClick={() => requestSingleSellerStatusAction(seller.id, 'activate')}
                                disabled={sellerActionLoading}
                                className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              >
                                Reativar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => requestSingleSellerStatusAction(seller.id, 'ban')}
                                disabled={sellerActionLoading}
                                className="rounded-sm border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                              >
                                Banir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-slate-500 dark:text-slate-400">Selecionados: {normalizedSelectedSellerIds.length}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSellerPage((current) => Math.max(1, Math.min(sellerTotalPages, current) - 1))}
                  disabled={sellerPageSafe === 1}
                  className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Anterior
                </button>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Pagina {sellerPageSafe} de {sellerTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setSellerPage((current) => Math.min(sellerTotalPages, Math.min(sellerTotalPages, current) + 1))}
                  disabled={sellerPageSafe === sellerTotalPages}
                  className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Proxima
                </button>
              </div>
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
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  CPF: {selectedSellerUser?.cpf || '-'} | Telefone: {selectedSellerUser?.phone || '-'}
                </p>
              </div>
              <button onClick={() => setViewingSellerDetails(null)} className="rounded-sm p-2 text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 md:p-8">
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
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">Materiais</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-200">{selectedSeller.publishedMaterialsCount || 0}/{selectedSellerMaterials.length || selectedSeller.materialsCount || 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-6 lg:grid-cols-3">
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Pagamentos</p>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Banco</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.bankAccount?.bankName || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Agencia</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.bankAccount?.agency || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Conta</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.bankAccount?.account || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Titular</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.bankAccount?.holderName || '-'}</dd></div>
                </dl>
              </div>
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Documentos</p>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">CPF</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.cpf || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Email verificado</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.emailVerified ? 'Sim' : 'Nao'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Telefone</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.phone || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Endereco</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{selectedSellerUser?.address?.city || '-'} {selectedSellerUser?.address?.state ? `- ${selectedSellerUser.address.state}` : ''}</dd></div>
                </dl>
              </div>
              <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Produtos</p>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedSellerMaterials.length} material(is) vinculado(s)</p>
                {selectedSellerMaterials.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Sem materiais cadastrados.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-xs">
                    {selectedSellerMaterials.slice(0, 4).map((material) => {
                      const status = String(material.status || 'pending');
                      const isModerating = sellerMaterialModerationLoadingId === material.id;
                      return (
                        <li key={`seller-material-preview-${material.id}`} className="rounded-sm border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900/60">
                          <div className="truncate font-semibold text-slate-700 dark:text-slate-200">{material.title}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              status === 'approved'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : status === 'rejected'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300'
                                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300'
                            }`}>
                              {status}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isModerating}
                                onClick={() => void handleModerateSellerMaterial(material.id, 'approved')}
                                className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              >
                                {isModerating ? '...' : 'Aprovar'}
                              </button>
                              <button
                                type="button"
                                disabled={isModerating}
                                onClick={() => void handleModerateSellerMaterial(material.id, 'rejected')}
                                className="rounded-sm border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                              >
                                {isModerating ? '...' : 'Rejeitar'}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-2">
                  <Link
                    href="/admin/marketplace/materials"
                    className="text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-300"
                  >
                    Abrir moderacao completa
                  </Link>
                </div>
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
                  {selectedSeller.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center italic text-slate-400 dark:text-slate-600">
                        Nenhuma venda registrada para este vendedor ainda.
                      </td>
                    </tr>
                  ) : selectedSeller.transactions.map((t) => {
                    const transaction = t as AdminFinanceTransaction;
                    const isHeld = isAdminTransactionHeld(transaction);
                    const amount = readTransactionAmount(transaction);
                    return (
                      <tr key={String(transaction.id || '')} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-6">{new Date(Number(transaction.timestamp || 0)).toLocaleDateString()} <span className="text-[10px] text-slate-400 block">{new Date(Number(transaction.timestamp || 0)).toLocaleTimeString()}</span></td>
                        <td className="p-6 font-mono text-[10px] text-slate-500">{String(transaction.id || '').substring(0, 12).toUpperCase()}...</td>
                        <td className="p-6 font-bold text-slate-800 dark:text-slate-200">{String(transaction.materialTitle || '')}</td>
                        <td className="p-6 text-right">R$ {amount.toFixed(2)}</td>
                        <td className="p-6 text-right font-bold text-slate-900 dark:text-slate-100">R$ {Math.max(0, readTransactionAmount(transaction) - readTransactionPlatformFee(transaction)).toFixed(2)}</td>
                        <td className="p-6 text-center">
                          {transaction.status === 'refunded' ? (
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
                {isLoadingTransactions ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      <span className="inline-flex items-center justify-center gap-2 font-bold">
                        <Loader2 size={16} className="animate-spin" />
                        Carregando solicitações de reembolso...
                      </span>
                    </td>
                  </tr>
                ) : refundRequests.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma solicitação de reembolso pendente.</td></tr>
                ) : (
                  refundRequests.map((t) => (
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
                {isRevenueProjectionLoading ? '...' : formatAdminMoney(futureProjectedAmount)}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {futureProjectedTransactionRows.length} parcela(s) futura(s) em {revenueProjection.activeContracts} contrato(s).
              </p>
            </div>
          </div>

          {overduePaymentRows.length > 0 ? (
            <div className="overflow-hidden rounded-sm border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/15">
              <div className="flex flex-col gap-2 border-b border-amber-200 px-4 py-3 dark:border-amber-900/40 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-black text-amber-900 dark:text-amber-100">
                    <AlertTriangle size={16} />
                    Pagamentos em atraso para averiguar
                  </p>
                  <p className="mt-1 text-xs font-semibold text-amber-800/80 dark:text-amber-200/80">
                    Parcelas que deveriam ter virado transacao real e nao podem permanecer como projecao futura.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center rounded-sm border border-amber-300 bg-white px-3 py-1 text-xs font-black text-amber-800 dark:border-amber-800 dark:bg-slate-950/40 dark:text-amber-200">
                  {overduePaymentRows.length} pendencia(s) - {formatAdminMoney(overduePaymentAmount)}
                </span>
              </div>
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="sticky top-0 z-10 bg-amber-100 dark:bg-amber-950">
                    <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-900 dark:text-amber-100">
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Aluno</th>
                      <th className="px-4 py-3">Plano</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 bg-white/70 dark:divide-amber-900/40 dark:bg-slate-950/20">
                    {overduePaymentRows.map((row, index) => {
                      const dueDate = row.dueAt ? new Date(row.dueAt) : null;
                      const dueLabel = dueDate && !Number.isNaN(dueDate.getTime())
                        ? dueDate.toLocaleString('pt-BR')
                        : row.dueAt || '-';

                      return (
                        <tr key={`${row.subscriptionId}-${row.installmentNumber}-${index}`}>
                          <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                            {dueLabel}
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                              {Number(row.daysOverdue || 0)} dia(s) em atraso
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-black text-slate-900 dark:text-slate-100">{row.userName || '-'}</p>
                            <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{row.userEmail || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{row.planName || '-'}</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                            {row.installmentNumber ? `${row.installmentNumber}/${row.installmentCount || '-'}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{row.reason || 'Pagamento em atraso'}</td>
                          <td className="px-4 py-3 text-right text-xs font-black text-amber-800 dark:text-amber-200">{formatAdminMoney(Number(row.amount || 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {projectionMonthRows.length > 0 ? (
            <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
              <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Projecao futura mes a mes</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Apenas parcelas futuras. Vencimentos passados aparecem no bloco de pagamentos em atraso para averiguacao.
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {projectionMonthRows.length} mes(es) projetado(s)
                </span>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                {projectionMonthRows.map((month) => {
                  const amount = Number(month.amount || 0);
                  const atRiskAmount = Number(month.atRiskAmount || 0);
                  const barWidth = Math.max(8, Math.round((amount / maxProjectionMonthAmount) * 100));
                  const isExpanded = expandedProjectionMonthKey === month.key;
                  const monthRowsCount = projectionRowsByMonth[month.key]?.length || 0;

                  return (
                    <div
                      key={month.key}
                      className={`rounded-sm border p-3 transition-colors ${
                        isExpanded
                          ? 'border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
                      }`}
                    >
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
                      <button
                        type="button"
                        onClick={() => setExpandedProjectionMonthKey((current) => (current === month.key ? null : month.key))}
                        disabled={monthRowsCount === 0}
                        className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-sm border border-violet-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 dark:border-violet-500/30 dark:bg-slate-950 dark:text-violet-300 dark:hover:bg-violet-500/10 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isExpanded ? 'Ocultar composicao' : 'Ver composicao'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {expandedProjectionMonth && expandedProjectionRows.length > 0 ? (
                <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black capitalize text-slate-900 dark:text-slate-100">
                        Composicao de {expandedProjectionMonth.label}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {expandedProjectionRows.length} cobranca(s) futuras somando {formatAdminMoney(Number(expandedProjectionMonth.amount || 0))}.
                      </p>
                    </div>
                    {Number(expandedProjectionMonth.atRiskAmount || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300">
                        <AlertTriangle size={12} />
                        {formatAdminMoney(Number(expandedProjectionMonth.atRiskAmount || 0))} em risco
                      </span>
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-sm border border-slate-200 dark:border-slate-800">
                    <div className="max-h-[360px] overflow-auto">
                      <table className="w-full min-w-[900px] text-left">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                          <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                            <th className="px-4 py-3">Data prevista</th>
                            <th className="px-4 py-3">Aluno</th>
                            <th className="px-4 py-3">Plano</th>
                            <th className="px-4 py-3">Parcela</th>
                            <th className="px-4 py-3">Origem</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {expandedProjectionRows
                            .slice()
                            .sort((left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0))
                            .map((row) => (
                              <tr key={row.id} className="align-top">
                                <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {row.dateTimeFormatted || new Date(row.timestamp).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs font-black text-slate-900 dark:text-slate-100">{row.buyerName || '-'}</p>
                                  <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{row.buyerEmail || '-'}</p>
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {row.planName || '-'}
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {row.installmentNumber ? `${row.installmentNumber}/${row.installmentCount || '-'}` : '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{row.scheduleLabel || formatTransactionStatusLabel(row.status || '')}</p>
                                  <p className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">{row.referenceId || row.providerTransactionId || row.internalId}</p>
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-black text-violet-700 dark:text-violet-300">
                                  {formatAdminMoney(readTransactionAmount(row))}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
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
                  ) : currentTransactions.map((transaction) => {
                    const referenceCode = transaction.providerTransactionId || transaction.referenceId || transaction.externalId || transaction.id;
                    const invoiceUrl = transaction.invoicePdfUrl || transaction.hostedInvoiceUrl || '';
                    const amount = readTransactionAmount(transaction);
                    const fee = isMarketplaceTransaction(transaction) ? readTransactionPlatformFee(transaction) : amount;
                    const net = Number(transaction.netAmount ?? (amount - fee));
                    const description = transaction.transactionName || transaction.materialTitle || transaction.planName || 'Plano de assinatura';
                    const statusLabel = formatTransactionStatusLabel(transaction.status || '');
                    const isRefundActionLocked = refundActionKey !== null;
                    const displayTimestamp = resolveTransactionDisplayTimestamp(transaction, adminFinanceNowMs);

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
                            {transaction.dateFormatted || (displayTimestamp ? new Date(displayTimestamp).toLocaleDateString() : '-')}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {transaction.dateTimeFormatted
                              ? transaction.dateTimeFormatted.split(' ').slice(1).join(' ')
                              : (displayTimestamp ? new Date(displayTimestamp).toLocaleTimeString() : '-')}
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
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className={ADMIN_SEGMENTED_TABS_CLASS}>
              {[
                { id: 'configuration' as const, label: 'Configuracao de Planos' },
                { id: 'access' as const, label: 'Controle de Acesso por Plano' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlansPanelTab(tab.id)}
                  className={`rounded-sm border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors ${
                    plansPanelTab === tab.id ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void handleSavePricing()}
              disabled={isSavingPricing}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {isSavingPricing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSavingPricing ? 'Salvando...' : 'Salvar Planos'}
            </button>
          </div>

          {plansPanelTab === 'configuration' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {(Object.entries(draftPricing) as Array<[PlanName, PlanPricing]>).map(([plan, config]) => (
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
                      value={(config as ExtendedPlanPricing).description || ''}
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
                    <div className="ml-1 mb-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recursos do Plano</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        Prévia gerada automaticamente pelo Controle de Acesso por Plano.
                      </p>
                    </div>
                    {getPublicPlanFeaturesForPlan(plan, draftPlanEntitlements, { maxItems: 12, includeDisabled: true, usageLimits: draftPlanUsageLimits }).map((feature, idx: number) => (
                      <div key={`${plan}-${feature.text}-${idx}`} className="flex items-center gap-2 rounded-sm bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60">
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${feature.included ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-500'}`}>
                          {feature.included ? <Check size={12} /> : <X size={12} />}
                        </span>
                        <span className={`text-[11px] font-bold ${feature.included ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600'}`}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                    <Link
                      href="/admin/finance/plans?tab=access"
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-slate-300 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition-all hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-sky-300"
                    >
                      Ajustar no controle de acesso <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-6 p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-black text-sky-700 dark:text-sky-300 uppercase tracking-tight">
                    Plano de teste
                  </h4>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Ciclo curto para validacao de checkout
                  </p>
                </div>

                {testCatalogPlanDraft ? (
                  <button
                    type="button"
                    onClick={() => void handleToggleTestCatalogPlanActive()}
                    className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                      testCatalogPlanDraft.active
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                    disabled={!testCatalogPlan?.can_toggle_active || catalogPlanSavingId === testCatalogPlan?.id}
                  >
                    {catalogPlanSavingId === testCatalogPlan?.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : testCatalogPlanDraft.active ? (
                      <Check size={11} />
                    ) : (
                      <X size={11} />
                    )}
                    {catalogPlanSavingId === testCatalogPlan?.id
                      ? 'Salvando...'
                      : testCatalogPlanDraft.active
                        ? 'Ativo'
                        : 'Desativado'}
                  </button>
                ) : null}
              </div>

              {catalogPlansLoading ? (
                <div className="flex min-h-[150px] items-center justify-center rounded-sm border border-slate-200 bg-white text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Carregando plano teste...
                </div>
              ) : testCatalogPlan && testCatalogPlanDraft ? (
                <div className="space-y-4">
                  <div className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{testCatalogPlan.name}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      ID {testCatalogPlan.id}. Aparece na tela de planos somente quando estiver ativo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Valor</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={testCatalogPlanDraft.price}
                          onChange={(event) => handleCatalogPlanDraftChange(testCatalogPlan.id, { price: Number(event.target.value) })}
                          className={`${ADMIN_FIELD_CLASS} h-11 w-full pl-12 pr-4 text-lg font-black`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Duracao</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCatalogPlanIntervalStep(testCatalogPlan.id, -1)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-slate-300 text-sm font-black text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Diminuir duracao"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={testCatalogPlanDraft.interval_count}
                          onChange={(event) => handleCatalogPlanDraftChange(testCatalogPlan.id, {
                            interval_count: Number(event.target.value),
                            interval_unit: 'day',
                          })}
                          className={`${ADMIN_FIELD_CLASS} h-11 w-24 px-2 text-center text-sm font-black`}
                        />
                        <button
                          type="button"
                          onClick={() => handleCatalogPlanIntervalStep(testCatalogPlan.id, 1)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-slate-300 text-sm font-black text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Aumentar duracao"
                        >
                          +
                        </button>
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">dias</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Use apenas para validar renovacao, webhook, reembolso e expiracao em sandbox.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSaveCatalogPlan(testCatalogPlan.id)}
                      disabled={catalogPlanSavingId === testCatalogPlan.id}
                      className={ADMIN_PRIMARY_BUTTON_CLASS}
                    >
                      {catalogPlanSavingId === testCatalogPlan.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {catalogPlanSavingId === testCatalogPlan.id ? 'Salvando...' : 'Salvar teste'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                  <p className="font-bold">Plano de teste nao encontrado.</p>
                  <p className="text-xs font-medium">
                    Recarregue o catalogo. Se o backend estiver atualizado, ele cria o teste padrao automaticamente.
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadPlanCatalog({ force: true })}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    <ArrowRight size={14} />
                    Recarregar plano teste
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {plansPanelTab === 'access' && (
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck size={18} className="text-sky-700 dark:text-sky-300" />
                Controle de Acesso por Plano
              </h4>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Esta matriz define os benefícios reais liberados para cada plano. A interface e os endpoints premium passam a confiar nela para evitar vazamento de recursos de planos superiores.
              </p>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div className={ADMIN_SEGMENTED_TABS_CLASS}>
                {[
                  { id: 'general' as const, label: 'Geral' },
                  { id: 'modules' as const, label: 'Por modulo' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPlanAccessTab(tab.id)}
                    className={`rounded-sm border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors ${
                      planAccessTab === tab.id ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {planAccessTab === 'general' ? (
            <>
            <div className="border-b border-slate-100 bg-slate-50/40 p-6 dark:border-slate-800 dark:bg-slate-950/30">
              <h5 className="text-sm font-black text-slate-900 dark:text-slate-100">Acesso completo por modulo</h5>
              <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Use esta area para liberar ou bloquear o modulo inteiro por plano. Recursos internos, filtros e acoes de tela ficam apenas em Por modulo.
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
                  {PLAN_ACCESS_GENERAL_BENEFIT_KEYS.map((benefitKey) => {
                    const resolvedEntitlements = normalizePlanEntitlements(draftPlanEntitlements);
                    const benefit = PLAN_BENEFIT_DEFINITIONS.find((item) => item.key === benefitKey);

                    if (!benefit) {
                      return null;
                    }

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

            </>
            ) : (
            <div className="space-y-5 border-t border-slate-100 bg-slate-50/40 p-5 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex max-w-full gap-2 overflow-x-auto rounded-sm border border-slate-200 bg-white p-2 no-scrollbar dark:border-slate-800 dark:bg-slate-900">
                {PLAN_ACCESS_MODULE_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActivePlanAccessModuleGroupId(group.id)}
                    className={`shrink-0 rounded-sm border px-4 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                      activePlanAccessModuleGroup.id === group.id
                        ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                        : ADMIN_TAB_BUTTON_IDLE_CLASS
                    }`}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
                <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between`}>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-slate-100">{activePlanAccessModuleGroup.label}</h5>
                    <p className="mt-1 max-w-3xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {activePlanAccessModuleGroup.description}
                    </p>
                    <p className="mt-2 max-w-3xl text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                      {activePlanAccessModuleGroup.strategy}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-sm border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">
                    {activePlanAccessModuleGroup.benefitKeys.length} regra(s)
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="hidden grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(92px,1fr))] gap-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 xl:grid">
                    <span>Feature</span>
                    {PLAN_ORDER.map((planName) => (
                      <span key={`${activePlanAccessModuleGroup.id}-header-${planName}`} className="text-center">{planName}</span>
                    ))}
                  </div>

                  {activePlanAccessModuleGroup.benefitKeys.map((benefitKey) => {
                    const resolvedEntitlements = normalizePlanEntitlements(draftPlanEntitlements);
                    const benefit = PLAN_BENEFIT_DEFINITIONS.find((item) => item.key === benefitKey);

                    return (
                      <div
                        key={`${activePlanAccessModuleGroup.id}-${benefitKey}`}
                        className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50 xl:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(92px,1fr))] xl:items-center"
                      >
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-slate-100">{benefit?.label || benefitKey}</div>
                          <div className="mt-1 break-all text-[10px] font-mono text-slate-400 dark:text-slate-500">{benefitKey}</div>
                          {benefit?.description ? (
                            <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">{benefit.description}</p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:contents">
                          {PLAN_ORDER.map((planName) => {
                            const enabled = resolvedEntitlements[planName][benefitKey].enabled;

                            return (
                              <button
                                key={`${activePlanAccessModuleGroup.id}-${benefitKey}-${planName}`}
                                type="button"
                                onClick={() => handleTogglePlanEntitlement(planName, benefitKey)}
                                className={`flex min-h-[52px] items-center justify-center gap-2 rounded-sm border px-2 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                                  enabled
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                                    : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                                }`}
                                title={`${enabled ? 'Bloquear' : 'Liberar'} ${benefit?.label || benefitKey} para ${planName}`}
                              >
                                {enabled ? <Check size={13} /> : <X size={13} />}
                                <span>{planName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {activePlanAccessLimitDefinitions.length > 0 ? (
                    <div className="mt-5 overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <h6 className="text-xs font-black uppercase tracking-[0.14em] text-slate-900 dark:text-slate-100">Limites deste modulo</h6>
                        <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                          Estes limites operacionais afetam apenas o modulo selecionado.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left">
                          <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Limite</th>
                              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descricao</th>
                              {PLAN_ORDER.map((planName) => (
                                <th key={`${activePlanAccessModuleGroup.id}-limit-${planName}`} className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                  {planName}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {activePlanAccessLimitDefinitions.map((limitDefinition) => {
                              const resolvedLimits = normalizePlanUsageLimits(draftPlanUsageLimits);

                              return (
                                <tr key={`${activePlanAccessModuleGroup.id}-${limitDefinition.key}`} className="bg-white dark:bg-slate-900/40">
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
                                      <td key={`${activePlanAccessModuleGroup.id}-${limitDefinition.key}-${planName}`} className="p-4 align-top">
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
                                            <div>
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
                  ) : null}
                </div>
              </div>
            </div>
            )}
          </div>
          )}

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
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">A cada 15 minutos</p>
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

            {automationHelper?.warning && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                {String(automationHelper.warning)}
              </div>
            )}

            {automationOperationalWarnings.length > 0 && (
              <div className="rounded-sm border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
                <div className="flex flex-col gap-2 md:flex-row md:items-start">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-black">Renovacoes nao dependem do login do aluno.</p>
                    {automationOperationalWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={`rounded-sm border p-4 ${getAutomationHealthCardClass(automationCronTone)}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Cron de reconciliacao</p>
                    <p className={`mt-2 text-lg font-black ${getAutomationHealthTextClass(automationCronTone)}`}>
                      {automationCronLastRunLabel}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {String(automationCronHealth?.message || 'Sem heartbeat registrado pelo backend.')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-sm border bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getAutomationHealthTextClass(automationCronTone)} dark:bg-slate-950/40`}>
                    {automationCronTone === 'emerald' ? <CheckCircle2 size={12} /> : automationCronTone === 'rose' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                    {automationCronStatus}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['Assinaturas', automationCronHealth?.checked ?? 0],
                    ['Issues', automationCronHealth?.issues ?? 0],
                    ['Invoices', automationCronHealth?.materialized_invoices ?? 0],
                    ['Periodos', automationCronHealth?.synced_periods ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-sm border border-white/70 bg-white/60 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-950/30">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{String(label)}</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-sm border p-4 ${getAutomationHealthCardClass(automationWebhookTone)}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Webhook Stripe</p>
                    <p className={`mt-2 text-lg font-black ${getAutomationHealthTextClass(automationWebhookTone)}`}>
                      {automationWebhookLastEventLabel}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {String(automationWebhookHealth?.message || 'Nenhum evento Stripe confirmado ainda.')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-sm border bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getAutomationHealthTextClass(automationWebhookTone)} dark:bg-slate-950/40`}>
                    {automationWebhookTone === 'emerald' ? <CheckCircle2 size={12} /> : automationWebhookTone === 'rose' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                    {automationWebhookStatus}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-sm border border-white/70 bg-white/60 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-950/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Evento</p>
                    <p className="mt-1 break-all text-xs font-black text-slate-900 dark:text-slate-100">{String(automationWebhookHealth?.event_type || 'NAO COMPROVADO')}</p>
                  </div>
                  <div className="rounded-sm border border-white/70 bg-white/60 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-950/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Objeto Stripe</p>
                    <p className="mt-1 break-all font-mono text-xs font-black text-slate-900 dark:text-slate-100">{String(automationWebhookHealth?.object_id || automationWebhookHealth?.event_id || 'NAO COMPROVADO')}</p>
                  </div>
                </div>
              </div>
            </div>

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
                    {stripeTestingSources.map((source, index: number) => (
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
                        {stripeTestingCases.map((testCase) => {
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
                          {stripeTestingRuns.map((run) => {
                            const runResult = String(run.execution_result || '').toLowerCase();
                            const resultTone =
                              runResult === 'passed'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : runResult === 'failed'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
                            const evidence: StripeTestingRunEvidence = run.evidence || {};

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
                onClick={() => void handleRunAutomationNow()}
                disabled={!isAdminViewer || automationRunLoading}
                className={ADMIN_PRIMARY_BUTTON_CLASS + " px-8 py-3 text-[10px] font-black uppercase tracking-widest"}
              >
                {automationRunLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {automationRunLoading ? 'Executando...' : 'Executar rotina agora'}
              </button>
              {automationRunResult && (
                <div className="mt-4 grid gap-2 rounded-sm border border-slate-300 bg-white p-4 text-xs dark:border-slate-700 dark:bg-slate-900 md:grid-cols-3">
                  {Object.entries(automationRunResult).slice(0, 6).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{key}</p>
                      <p className="mt-1 break-words font-black text-slate-900 dark:text-slate-100">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default AdminFinance;
