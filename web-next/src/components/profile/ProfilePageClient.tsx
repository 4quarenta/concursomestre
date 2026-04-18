'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Gift,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { readApiData, readApiErrorMessage } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';
import { marketplaceService } from '@/services/marketplace/marketplaceService';
import { statisticsService, type UserStatistics } from '@/services/statistics/statisticsService';
import type { Material, Transaction } from '@/types';

type ProfileTab = 'personal' | 'billing' | 'materials' | 'security' | 'referral';

type ProfilePageClientProps = {
  initialTab: ProfileTab;
};

const tabs: Array<{ key: ProfileTab; label: string; icon: typeof User }> = [
  { key: 'personal', label: 'Dados', icon: User },
  { key: 'billing', label: 'Assinatura', icon: CreditCard },
  { key: 'materials', label: 'Materiais', icon: BookOpen },
  { key: 'security', label: 'Seguranca', icon: ShieldCheck },
  { key: 'referral', label: 'Indicacoes', icon: Gift },
];

const formatDate = (value?: string | number | null) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('pt-BR');
};

const formatCurrency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const isCompletedTransaction = (transaction: Transaction) => (
  transaction.status === 'completed'
  || transaction.status === 'approved'
);

export default function ProfilePageClient({ initialTab }: ProfilePageClientProps) {
  const { currentUser, isAuthenticated, isLoading, refreshUser } = useAuthSession();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingProfileData, setIsLoadingProfileData] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'warning'; text: string } | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    targetExam: '',
  });

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setProfileForm({
      name: currentUser.name || '',
      targetExam: currentUser.targetExam || '',
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setStatistics(null);
      setMaterials([]);
      setTransactions([]);
      return;
    }

    let cancelled = false;

    const loadProfileData = async () => {
      setIsLoadingProfileData(true);

      try {
        const [nextStats, nextTransactions, nextMaterials] = await Promise.all([
          statisticsService.getUserStatistics(currentUser.id).catch(() => null),
          marketplaceService.listTransactions({
            userId: currentUser.id,
            scope: 'buyer',
          }).catch(() => []),
          marketplaceService.listMaterials().catch(() => []),
        ]);

        if (!cancelled) {
          setStatistics(nextStats);
          setTransactions(nextTransactions);
          setMaterials(nextMaterials);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfileData(false);
        }
      }
    };

    void loadProfileData();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const purchasedMaterialIds = useMemo(() => {
    const ids = new Set<string>();

    currentUser?.purchasedMaterialIds?.forEach((id) => ids.add(String(id)));
    transactions
      .filter(isCompletedTransaction)
      .forEach((transaction) => ids.add(String(transaction.materialId)));

    return ids;
  }, [currentUser?.purchasedMaterialIds, transactions]);

  const purchasedMaterials = useMemo(() => (
    materials.filter((material) => purchasedMaterialIds.has(String(material.id)))
  ), [materials, purchasedMaterialIds]);

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setNotice(null);

    try {
      await requestAuthenticatedApi<any>('users/update.php', {
        method: 'POST',
        body: {
          name: profileForm.name.trim(),
          targetExam: profileForm.targetExam.trim(),
        },
      });

      await refreshUser();
      setNotice({ type: 'success', text: 'Perfil atualizado com sucesso.' });
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel atualizar seu perfil.') });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setIsOpeningPortal(true);
    setNotice(null);

    try {
      const response = await requestAuthenticatedApi<any>('subscriptions/create_stripe_portal.php', {
        method: 'POST',
        body: {},
      });
      const payload = readApiData<any>(response, {});
      const portalUrl = response?.url || response?.portal_url || payload?.url || payload?.portal_url;

      if (!portalUrl) {
        throw new Error('O backend nao retornou a URL do portal.');
      }

      window.location.assign(portalUrl);
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel abrir o portal de assinatura.') });
      setIsOpeningPortal(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="animate-spin" size={18} />
          Carregando perfil...
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <section className="w-full max-w-xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Lock size={24} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Entre para acessar seu perfil</h1>
            <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Seus dados, assinatura, materiais e seguranca ficam protegidos pela sessao autenticada.
            </p>
          </div>
          <Link
            href="/auth?next=%2Fprofile"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-600 dark:text-indigo-300">
                Perfil
              </p>
              <h1 className="text-4xl font-black tracking-tight">{currentUser.name}</h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                Gerencie seus dados, acompanhe assinatura e acesse seus materiais comprados.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Nivel</p>
                <p className="mt-1 text-xl font-black">{currentUser.level || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">XP</p>
                <p className="mt-1 text-xl font-black">{currentUser.xp || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plano</p>
                <p className="mt-1 text-xl font-black">{currentUser.billing?.plan || currentUser.plan || 'Gratuito'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Acertos</p>
                <p className="mt-1 text-xl font-black">{Math.round(statistics?.accuracyRate || 0)}%</p>
              </div>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-indigo-600'
                    : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {notice ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
              : notice.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
          }`}>
            {notice.text}
          </div>
        ) : null}

        {activeTab === 'personal' ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={handleProfileSave} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Dados pessoais</p>
                <h2 className="mt-2 text-2xl font-black">Informacoes da conta</h2>
              </div>
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Nome</span>
                <input
                  value={profileForm.name}
                  onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Concurso alvo</span>
                <input
                  value={profileForm.targetExam}
                  onChange={(event) => setProfileForm((current) => ({ ...current, targetExam: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">E-mail</p>
                <p className="mt-1 text-sm font-bold">{currentUser.email}</p>
              </div>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                {isSavingProfile ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                Salvar dados
              </button>
            </form>

            <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-black">Resumo de estudo</h2>
              {isLoadingProfileData ? (
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Loader2 className="animate-spin" size={16} />
                  Atualizando estatisticas
                </div>
              ) : null}
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Questoes respondidas</p>
                  <p className="mt-2 text-3xl font-black">{statistics?.totalQuestionsAnswered || 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sequencia atual</p>
                  <p className="mt-2 text-3xl font-black">{statistics?.currentStreak || 0}</p>
                </div>
              </div>
            </aside>
          </section>
        ) : null}

        {activeTab === 'billing' ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Assinatura</p>
                <h2 className="mt-2 text-2xl font-black">{currentUser.subscription?.plan?.name || currentUser.billing?.plan || currentUser.plan || 'Gratuito'}</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</p>
                  <p className="mt-2 text-lg font-black">{currentUser.subscription?.status || 'sem assinatura ativa'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Proxima cobranca</p>
                  <p className="mt-2 text-lg font-black">{formatDate(currentUser.subscription?.current_period_end || currentUser.billing?.nextBilling)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenBillingPortal}
                disabled={isOpeningPortal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                {isOpeningPortal ? <Loader2 className="animate-spin" size={15} /> : <Wallet size={15} />}
                Abrir portal de billing
              </button>
            </div>
            <aside className="rounded-3xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-900/30 dark:bg-indigo-950/20">
              <CreditCard className="text-indigo-600 dark:text-indigo-300" size={28} />
              <h2 className="mt-4 text-xl font-black">Pagamentos Stripe</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                Cartoes, faturas e assinatura sao gerenciados pelo portal seguro conectado ao backend oficial.
              </p>
            </aside>
          </section>
        ) : null}

        {activeTab === 'materials' ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Biblioteca</p>
                <h2 className="mt-2 text-2xl font-black">Materiais liberados</h2>
              </div>
              <Link href="/marketplace" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                Marketplace
                <ArrowRight size={14} />
              </Link>
            </div>
            {purchasedMaterials.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
                <BookOpen className="mx-auto text-slate-300 dark:text-slate-600" size={36} />
                <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum material liberado ainda.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {purchasedMaterials.map((material) => (
                  <article key={material.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-base font-black">{material.title}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{material.subjectText || material.subject}</p>
                    <Link href={`/read/${material.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white dark:bg-indigo-600">
                      Ler
                      <ArrowRight size={12} />
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'security' ? (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <ShieldCheck className="text-emerald-600 dark:text-emerald-300" size={30} />
              <h2 className="mt-4 text-2xl font-black">Seguranca da conta</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                E-mail {currentUser.emailVerified ? 'confirmado' : 'pendente de confirmacao'} e sessao protegida por refresh token.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Lock className="text-indigo-600 dark:text-indigo-300" size={30} />
              <h2 className="mt-4 text-2xl font-black">Senha e 2FA</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                A gestao completa de senha e dois fatores fica na proxima rodada da auditoria de seguranca.
              </p>
            </div>
          </section>
        ) : null}

        {activeTab === 'referral' ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Gift className="text-emerald-600 dark:text-emerald-300" size={30} />
            <h2 className="mt-4 text-2xl font-black">Indicacoes</h2>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Compartilhe seu codigo quando o programa de indicacao estiver ativo.
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-black dark:border-slate-800 dark:bg-slate-950/40">
              {currentUser.referralCode || 'codigo-indisponivel'}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <BarChart3 className="mt-0.5 text-indigo-600 dark:text-indigo-300" size={20} />
            <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              A base Next ja cobre dados pessoais, assinatura, materiais, seguranca informativa e indicacoes. Historico financeiro granular, exclusao de conta e preferencias avancadas entram na auditoria final de producao.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
