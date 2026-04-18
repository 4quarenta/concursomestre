'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  Loader2,
  Lock,
  Megaphone,
  Package,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { readApiErrorMessage } from '@/lib/browserApi';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import {
  ADMIN_SECTION_CONFIG,
  TAB_DESCRIPTIONS,
  TAB_LABELS,
  adminService,
  buildAdminPath,
  resolveAdminRoute,
  type AdminFeedbackThread,
  type AdminPageTab,
  type AdminStatsPayload,
  type ResolvedAdminRoute,
} from '@/services/admin';
import type { ErrorReport, Material, SeoSettings, SystemSettings, Transaction, UserProfile } from '@/types';

type AdminPlatformClientProps = {
  initialRoute: ResolvedAdminRoute;
  initialSettings: SystemSettings;
};

type Notice = {
  text: string;
  type: 'error' | 'success' | 'warning';
};

const tabIcons: Record<AdminPageTab, typeof Gauge> = {
  panel: Gauge,
  operation: Package,
  finance: CreditCard,
  marketing: Megaphone,
  support: AlertTriangle,
  settings: Settings,
};

const DEFAULT_SEO_SETTINGS: SeoSettings = {
  global: {
    site_title: 'ConcursoMestre',
    meta_description: 'Plataforma de estudos para concursos publicos.',
    canonical_base_url: 'http://localhost:3000',
    robots_default: 'index,follow',
    default_og_title: 'ConcursoMestre',
    default_og_description: 'Estude com questoes, simulados e analise de desempenho.',
    default_og_image: '',
    default_twitter_title: 'ConcursoMestre',
    default_twitter_description: 'Estude com questoes, simulados e analise de desempenho.',
    default_twitter_image: '',
    google_site_verification: '',
    bing_site_verification: '',
    noindex_non_production: true,
    enable_sitemap: true,
    enable_robots_txt_control: true,
  },
  pages: {
    landing: {},
    plans: {},
    faq: {},
    changelog: {},
    privacy: {},
    terms: {},
  },
};

const formatCurrency = (value: number | null | undefined) => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatDate = (value: string | number | null | undefined) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR');
};

const statusClass = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();

  if (['active', 'completed', 'approved', 'resolved', 'published'].includes(normalized)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200';
  }

  if (['pending', 'trialing', 'new', 'read', 'refund_requested'].includes(normalized)) {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200';
  }

  if (['rejected', 'cancelled', 'canceled', 'banned', 'suspended', 'refunded'].includes(normalized)) {
    return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300';
};

const isCompletedTransaction = (transaction: Transaction) => (
  transaction.status === 'completed'
  || transaction.status === 'approved'
);

const hasAdminAccess = (user?: UserProfile | null) => Boolean(
  user?.isAdmin
  || user?.isStaff
  || user?.canAccessAdmin
  || user?.role === 'admin'
  || user?.role === 'staff',
);

const mergeSeoSettings = (settings: SystemSettings): SeoSettings => ({
  global: {
    ...DEFAULT_SEO_SETTINGS.global,
    ...(settings.seo?.global || {}),
  },
  pages: {
    ...DEFAULT_SEO_SETTINGS.pages,
    ...(settings.seo?.pages || {}),
  },
});

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: typeof Gauge;
  label: string;
  tone?: 'amber' | 'emerald' | 'rose' | 'sky' | 'slate';
  value: string | number;
}) {
  const toneClass = {
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  }[tone];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClass(value)}`}>
      {value || 'indefinido'}
    </span>
  );
}

function DataTable<T>({
  columns,
  empty,
  rows,
}: {
  columns: Array<{ key: string; label: string; render: (item: T) => React.ReactNode }>;
  empty: string;
  rows: T[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, index) => (
              <tr key={index} className="align-top">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPlatformClient({ initialRoute, initialSettings }: AdminPlatformClientProps) {
  const { currentUser, isLoading: isAuthLoading } = useAuthSession();
  const [route, setRoute] = useState<ResolvedAdminRoute>(initialRoute);
  const [stats, setStats] = useState<AdminStatsPayload | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [feedbackThreads, setFeedbackThreads] = useState<AdminFeedbackThread[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const canAccessAdmin = hasAdminAccess(currentUser);
  const seoSettings = useMemo(() => mergeSeoSettings(settings), [settings]);

  const financeOverview = useMemo(() => {
    const completedTransactions = transactions.filter(isCompletedTransaction);
    const grossRevenue = completedTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const platformFees = completedTransactions.reduce((sum, transaction) => sum + Number(transaction.platformFee || 0), 0);
    const refunds = transactions.filter((transaction) => transaction.status === 'refund_requested' || transaction.status === 'refunded');

    return {
      completedCount: completedTransactions.length,
      grossRevenue,
      platformFees,
      refundsCount: refunds.length,
    };
  }, [transactions]);

  const productionReadiness = useMemo(() => ([
    {
      label: 'SEO global configurado',
      ok: Boolean(seoSettings.global.site_title && seoSettings.global.meta_description && seoSettings.global.canonical_base_url),
    },
    {
      label: 'Sitemap controlado',
      ok: Boolean(seoSettings.global.enable_sitemap),
    },
    {
      label: 'Robots controlado',
      ok: Boolean(seoSettings.global.enable_robots_txt_control),
    },
    {
      label: 'Stripe secret configurado',
      ok: Boolean(settings.hasStripeSecretConfigured || settings.stripeSecretKey),
    },
    {
      label: 'Stripe webhook configurado',
      ok: Boolean(settings.hasStripeWebhookConfigured || settings.stripeWebhookSecret),
    },
    {
      label: 'SMTP configurado',
      ok: Boolean(settings.smtpHost && settings.mailFromAddress),
    },
  ]), [seoSettings.global, settings]);

  const loadAdminData = async () => {
    if (!canAccessAdmin) {
      return;
    }

    setIsLoadingData(true);
    setNotice(null);

    const [
      statsResult,
      usersResult,
      materialsResult,
      transactionsResult,
      reportsResult,
      feedbackResult,
      settingsResult,
      logsResult,
    ] = await Promise.allSettled([
      adminService.getStats('month'),
      adminService.getUsers(),
      adminService.getMaterials(),
      adminService.getTransactions(),
      adminService.getReports(),
      adminService.getFeedbackThreads(),
      adminService.getSettings(),
      adminService.getSystemLogs(),
    ]);

    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
    if (materialsResult.status === 'fulfilled') setMaterials(materialsResult.value);
    if (transactionsResult.status === 'fulfilled') setTransactions(transactionsResult.value);
    if (reportsResult.status === 'fulfilled') setReports(reportsResult.value);
    if (feedbackResult.status === 'fulfilled') setFeedbackThreads(feedbackResult.value);
    if (settingsResult.status === 'fulfilled') {
      setSettings(mergePublicSystemSettings(settingsResult.value));
    }
    if (logsResult.status === 'fulfilled') setLogs(logsResult.value);

    const firstRejected = [
      statsResult,
      usersResult,
      materialsResult,
      transactionsResult,
      reportsResult,
      feedbackResult,
      settingsResult,
      logsResult,
    ].find((result) => result.status === 'rejected');

    if (firstRejected?.status === 'rejected') {
      setNotice({
        type: 'warning',
        text: readApiErrorMessage(firstRejected.reason, 'Alguns dados administrativos nao puderam ser carregados agora.'),
      });
    }

    setIsLoadingData(false);
  };

  useEffect(() => {
    if (canAccessAdmin) {
      void loadAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessAdmin]);

  const navigate = (tab: AdminPageTab, section?: string) => {
    const nextRoute = resolveAdminRoute(tab, section);
    setRoute(nextRoute);
    window.history.pushState(null, '', buildAdminPath(nextRoute.tab, nextRoute.section));
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    setNotice(null);

    try {
      const savedSettings = await adminService.saveSettings(settings);
      setSettings(mergePublicSystemSettings(savedSettings));
      setNotice({ type: 'success', text: 'Configuracoes salvas com sucesso.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: readApiErrorMessage(error, 'Nao foi possivel salvar as configuracoes.'),
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateSeoGlobal = <K extends keyof SeoSettings['global']>(key: K, value: SeoSettings['global'][K]) => {
    setSettings((current) => {
      const currentSeo = mergeSeoSettings(current);
      return {
        ...current,
        seo: {
          ...currentSeo,
          global: {
            ...currentSeo.global,
            [key]: value,
          },
        },
      };
    });
  };

  const updateFeatureFlag = (key: keyof SystemSettings['features'], value: boolean) => {
    setSettings((current) => ({
      ...current,
      features: {
        ...current.features,
        [key]: value,
      },
    }));
  };

  const updateSettingField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="animate-spin" size={18} />
          Validando sessao administrativa...
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Lock className="text-slate-700 dark:text-slate-200" size={30} />
          <h1 className="mt-4 text-3xl font-black text-slate-900 dark:text-slate-100">Acesso administrativo</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Entre com uma conta autorizada para acessar operacao, financeiro, SEO e configuracoes de producao.
          </p>
          <Link
            href="/auth?next=%2Fadmin"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white dark:bg-emerald-700"
          >
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  if (!canAccessAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <section className="w-full max-w-xl rounded-lg border border-rose-200 bg-white p-7 shadow-sm dark:border-rose-900/40 dark:bg-slate-900">
          <ShieldCheck className="text-rose-700 dark:text-rose-300" size={30} />
          <h1 className="mt-4 text-3xl font-black text-slate-900 dark:text-slate-100">Permissao insuficiente</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Sua conta esta autenticada, mas nao possui permissao administrativa para este painel.
          </p>
        </section>
      </main>
    );
  }

  const activeSections = ADMIN_SECTION_CONFIG[route.tab];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                Admin Next
              </p>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Painel administrativo consolidado.
              </h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                Operacao, receita, SEO, seguranca e preparacao de producao agora rodam dentro da base Next principal.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAdminData}
              disabled={isLoadingData}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isLoadingData ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Atualizar
            </button>
          </div>
        </header>

        <nav className="grid gap-3 lg:grid-cols-6">
          {(Object.keys(TAB_LABELS) as AdminPageTab[]).map((tab) => {
            const Icon = tabIcons[tab];
            const active = route.tab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => navigate(tab)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  active
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
                <p className="mt-2 text-sm font-black">{TAB_LABELS[tab]}</p>
              </button>
            );
          })}
        </nav>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">{TAB_LABELS[route.tab]}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {TAB_DESCRIPTIONS[route.tab]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => navigate(route.tab, section.key)}
                  className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    route.section === section.key
                      ? 'bg-slate-900 text-white dark:bg-emerald-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {notice ? (
          <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
              : notice.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'
          }`}>
            {notice.text}
          </div>
        ) : null}

        {route.tab === 'panel' ? (
          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Users} label="Usuarios" value={stats?.users_count ?? users.length} tone="sky" />
              <StatCard icon={Package} label="Materiais" value={stats?.materials_count ?? materials.length} tone="emerald" />
              <StatCard icon={CreditCard} label="MRR" value={formatCurrency(stats?.mrr)} tone="amber" />
              <StatCard icon={AlertTriangle} label="Reembolsos pendentes" value={stats?.refund_requests_count ?? financeOverview.refundsCount} tone="rose" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Receita e pagamentos</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatCard icon={BarChart3} label="Receita total" value={formatCurrency(stats?.total_revenue ?? financeOverview.grossRevenue)} tone="emerald" />
                  <StatCard icon={CreditCard} label="Taxas plataforma" value={formatCurrency(stats?.platform_revenue ?? financeOverview.platformFees)} tone="sky" />
                  <StatCard icon={Package} label="Marketplace" value={formatCurrency(stats?.marketplace_revenue)} tone="amber" />
                  <StatCard icon={ShieldCheck} label="Saldo retido" value={formatCurrency(stats?.held_balance)} tone="rose" />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black">Checklist de producao</h2>
                <div className="mt-4 space-y-3">
                  {productionReadiness.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                      {item.ok ? (
                        <CheckCircle2 className="text-emerald-600 dark:text-emerald-300" size={18} />
                      ) : (
                        <AlertTriangle className="text-amber-600 dark:text-amber-300" size={18} />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {route.tab === 'operation' && route.section === 'users' ? (
          <DataTable
            rows={users.slice(0, 40)}
            empty="Nenhum usuario retornado pelo backend."
            columns={[
              { key: 'name', label: 'Usuario', render: (user) => <div><p className="font-black">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></div> },
              { key: 'role', label: 'Perfil', render: (user) => <StatusPill value={user.role} /> },
              { key: 'status', label: 'Status', render: (user) => <StatusPill value={user.status} /> },
              { key: 'plan', label: 'Plano', render: (user) => user.subscription?.plan?.name || user.billing?.plan || user.plan || 'Gratuito' },
              { key: 'metrics', label: 'Estudo', render: (user) => `${user.xp || 0} XP / nivel ${user.level || 0}` },
            ]}
          />
        ) : null}

        {route.tab === 'operation' && route.section === 'materials' ? (
          <DataTable
            rows={materials.slice(0, 40)}
            empty="Nenhum material retornado pelo backend."
            columns={[
              { key: 'title', label: 'Material', render: (material) => <div><p className="font-black">{material.title}</p><p className="text-xs text-slate-500">{material.authorName}</p></div> },
              { key: 'status', label: 'Status', render: (material) => <StatusPill value={material.status} /> },
              { key: 'price', label: 'Preco', render: (material) => formatCurrency(material.price) },
              { key: 'sales', label: 'Vendas', render: (material) => material.salesCount || 0 },
              { key: 'rating', label: 'Nota', render: (material) => Number(material.rating || 0).toFixed(1) },
            ]}
          />
        ) : null}

        {route.tab === 'operation' && !['users', 'materials'].includes(route.section) ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Search className="text-emerald-700 dark:text-emerald-300" size={24} />
            <h2 className="mt-4 text-xl font-black">Modulo operacional em auditoria</h2>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Esta secao ja esta roteada nativamente no Next. A proxima rodada aprofunda CRUD, importacao, taxonomias e moderacao completa antes da limpeza definitiva do legado.
            </p>
          </section>
        ) : null}

        {route.tab === 'finance' ? (
          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={CreditCard} label="Transacoes concluídas" value={financeOverview.completedCount} tone="emerald" />
              <StatCard icon={BarChart3} label="Receita bruta" value={formatCurrency(financeOverview.grossRevenue)} tone="sky" />
              <StatCard icon={Package} label="Taxa plataforma" value={formatCurrency(financeOverview.platformFees)} tone="amber" />
              <StatCard icon={AlertTriangle} label="Reembolsos" value={financeOverview.refundsCount} tone="rose" />
            </div>
            <DataTable
              rows={(route.section === 'refunds'
                ? transactions.filter((transaction) => transaction.status === 'refund_requested' || transaction.status === 'refunded')
                : transactions
              ).slice(0, 60)}
              empty="Nenhuma transacao retornada pelo backend."
              columns={[
                { key: 'id', label: 'ID', render: (transaction) => transaction.id },
                { key: 'buyer', label: 'Comprador', render: (transaction) => transaction.buyerName || transaction.buyerId },
                { key: 'item', label: 'Item', render: (transaction) => transaction.materialTitle || transaction.type || 'Plano' },
                { key: 'amount', label: 'Valor', render: (transaction) => formatCurrency(transaction.amount) },
                { key: 'status', label: 'Status', render: (transaction) => <StatusPill value={transaction.status} /> },
                { key: 'date', label: 'Data', render: (transaction) => formatDate(transaction.timestamp) },
              ]}
            />
          </section>
        ) : null}

        {route.tab === 'marketing' ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-black">Landing pages</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(settings.landingPages || []).map((page) => (
                <article key={page.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="font-black">{page.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{page.slug}</p>
                  <div className="mt-3"><StatusPill value={page.status} /></div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {route.tab === 'support' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-black">Feedbacks</h2>
              <DataTable
                rows={feedbackThreads.slice(0, 20)}
                empty="Nenhum feedback retornado pelo backend."
                columns={[
                  { key: 'user', label: 'Usuario', render: (item) => <div><p className="font-black">{item.user_name}</p><p className="text-xs text-slate-500">{item.user_email}</p></div> },
                  { key: 'reason', label: 'Motivo', render: (item) => item.reason || item.type },
                  { key: 'status', label: 'Status', render: (item) => <StatusPill value={item.status} /> },
                ]}
              />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-black">Denuncias</h2>
              <DataTable
                rows={reports.slice(0, 20)}
                empty="Nenhuma denuncia retornada pelo backend."
                columns={[
                  { key: 'target', label: 'Alvo', render: (item) => item.targetType },
                  { key: 'reason', label: 'Motivo', render: (item) => item.reason },
                  { key: 'status', label: 'Status', render: (item) => <StatusPill value={item.status} /> },
                ]}
              />
            </div>
          </section>
        ) : null}

        {route.tab === 'settings' ? (
          <section className="space-y-6">
            {route.section === 'seo' ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-black">SEO global</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Preparacao de visibilidade Google para dominio, sitemap, robots e metatags.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={isSavingSettings}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Salvar SEO
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Titulo do site</span>
                    <input value={seoSettings.global.site_title} onChange={(event) => updateSeoGlobal('site_title', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Canonical base URL</span>
                    <input value={seoSettings.global.canonical_base_url} onChange={(event) => updateSeoGlobal('canonical_base_url', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Meta description</span>
                    <textarea value={seoSettings.global.meta_description} onChange={(event) => updateSeoGlobal('meta_description', event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Google verification</span>
                    <input value={seoSettings.global.google_site_verification || ''} onChange={(event) => updateSeoGlobal('google_site_verification', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Bing verification</span>
                    <input value={seoSettings.global.bing_site_verification || ''} onChange={(event) => updateSeoGlobal('bing_site_verification', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    ['enable_sitemap', 'Sitemap ativo'],
                    ['enable_robots_txt_control', 'Robots controlado'],
                    ['noindex_non_production', 'Noindex fora de producao'],
                  ].map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] dark:border-slate-800 dark:bg-slate-950/40">
                      <input
                        type="checkbox"
                        checked={Boolean(seoSettings.global[key as keyof SeoSettings['global']])}
                        onChange={(event) => updateSeoGlobal(key as keyof SeoSettings['global'], event.target.checked as never)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {route.section === 'modules' ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-xl font-black">Modulos ativos</h2>
                  <button type="button" onClick={saveSettings} disabled={isSavingSettings} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                    {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Salvar modulos
                  </button>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(Object.keys(settings.features) as Array<keyof SystemSettings['features']>).map((key) => (
                    <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                      <input type="checkbox" checked={Boolean(settings.features[key])} onChange={(event) => updateFeatureFlag(key, event.target.checked)} className="h-4 w-4 accent-emerald-700" />
                      {key}
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {route.section === 'general' ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-xl font-black">Configuracoes gerais</h2>
                  <button type="button" onClick={saveSettings} disabled={isSavingSettings} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                    {isSavingSettings ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Salvar geral
                  </button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Nome do site</span>
                    <input value={settings.siteName || ''} onChange={(event) => updateSettingField('siteName', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Modo</span>
                    <select value={settings.appMode || 'development'} onChange={(event) => updateSettingField('appMode', event.target.value as SystemSettings['appMode'])} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">
                      <option value="development">development</option>
                      <option value="production">production</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Telefone suporte</span>
                    <input value={settings.supportPhone || ''} onChange={(event) => updateSettingField('supportPhone', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">PIX</span>
                    <input value={settings.pixKey || ''} onChange={(event) => updateSettingField('pixKey', event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                </div>
              </section>
            ) : null}

            {!['seo', 'modules', 'general'].includes(route.section) ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <FileText className="text-emerald-700 dark:text-emerald-300" size={24} />
                <h2 className="mt-4 text-xl font-black">Secao de configuracao nativa</h2>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                  Esta area ja esta roteada pelo admin Next. A auditoria de producao vai detalhar validacoes, testes de integracao, logs e controles especificos.
                </p>
                {route.section === 'logs' ? (
                  <pre className="mt-5 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                    {(logs.length ? logs : ['Nenhuma linha de log retornada.']).join('\n')}
                  </pre>
                ) : null}
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
