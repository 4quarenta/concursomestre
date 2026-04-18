'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  Package,
  ShieldCheck,
  Store,
  UploadCloud,
  Wallet,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { readApiErrorMessage } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';
import { marketplaceService } from '@/services/marketplace/marketplaceService';
import type { Material, SystemSettings, Transaction } from '@/types';

type PartnerDashboardClientProps = {
  systemSettings: SystemSettings;
};

const formatCurrency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const isPartnerUser = (user: ReturnType<typeof useAuthSession>['currentUser']) => Boolean(
  user?.isPartner
  || user?.isAdmin
  || user?.role === 'partner'
  || user?.role === 'admin',
);

const isCompletedTransaction = (transaction: Transaction) => (
  transaction.status === 'completed'
  || transaction.status === 'approved'
);

export default function PartnerDashboardClient({ systemSettings }: PartnerDashboardClientProps) {
  const { currentUser, isAuthenticated, isLoading, refreshUser } = useAuthSession();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isBecomingPartner, setIsBecomingPartner] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'warning'; text: string } | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '0',
    type: 'PDF' as Material['type'],
    subjectId: '',
    topicId: '',
    examTarget: '',
    pdfPassword: '',
  });

  const hasPartnerAccess = isPartnerUser(currentUser);
  const partnerRegistrationEnabled = systemSettings.features.partnerRegistrationEnabled !== false;

  useEffect(() => {
    if (!hasPartnerAccess || !currentUser) {
      setMaterials([]);
      setTransactions([]);
      return;
    }

    let cancelled = false;

    const loadPartnerData = async () => {
      setIsLoadingData(true);

      try {
        const [nextMaterials, nextTransactions] = await Promise.all([
          marketplaceService.listMaterials(),
          marketplaceService.listTransactions({
            userId: currentUser.id,
            scope: 'seller',
          }),
        ]);

        if (!cancelled) {
          setMaterials(nextMaterials.filter((material) => material.authorId === currentUser.id));
          setTransactions(nextTransactions);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel carregar o painel de colaborador.') });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    };

    void loadPartnerData();

    return () => {
      cancelled = true;
    };
  }, [currentUser, hasPartnerAccess]);

  const selectedSubject = useMemo(
    () => systemSettings.taxonomies?.subjects?.find((subject) => String(subject.id) === String(form.subjectId)) || null,
    [form.subjectId, systemSettings.taxonomies?.subjects],
  );

  const selectedTopic = useMemo(
    () => systemSettings.taxonomies?.topics?.find((topic) => String(topic.id) === String(form.topicId)) || null,
    [form.topicId, systemSettings.taxonomies?.topics],
  );

  const partnerStats = useMemo(() => {
    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;

    return transactions.reduce((accumulator, transaction) => {
      if (transaction.status === 'refunded') {
        return accumulator;
      }

      const netAmount = Number(transaction.amount || 0) - Number(transaction.platformFee || 0);
      const daysSincePurchase = (now - Number(transaction.timestamp || 0)) / msPerDay;
      const isUnderReview = transaction.status === 'refund_requested';

      accumulator.totalRevenue += netAmount;
      accumulator.totalSales += isCompletedTransaction(transaction) ? 1 : 0;

      if (isCompletedTransaction(transaction) && !isUnderReview && daysSincePurchase >= 7) {
        accumulator.availableBalance += netAmount;
      } else if (netAmount > 0) {
        accumulator.heldBalance += netAmount;
      }

      return accumulator;
    }, {
      availableBalance: 0,
      heldBalance: 0,
      totalRevenue: 0,
      totalSales: 0,
    });
  }, [transactions]);

  const handleBecomePartner = async () => {
    setIsBecomingPartner(true);
    setNotice(null);

    try {
      await requestAuthenticatedApi<any>('users/update.php', {
        method: 'POST',
        body: { role: 'partner' },
      });

      await refreshUser();
      setNotice({ type: 'success', text: 'Perfil de colaborador ativado.' });
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel ativar o perfil de colaborador.') });
    } finally {
      setIsBecomingPartner(false);
    }
  };

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      setNotice({ type: 'warning', text: 'Preencha titulo e descricao do material.' });
      return;
    }

    if (!fullFile) {
      setNotice({ type: 'warning', text: 'Envie o arquivo principal do material.' });
      return;
    }

    setIsPublishing(true);
    setNotice(null);

    try {
      const uploadedFile = await marketplaceService.uploadFile(fullFile, {
        password: form.pdfPassword || undefined,
      });

      if (!uploadedFile) {
        throw new Error('Upload do arquivo principal nao retornou URL.');
      }

      const uploadedCover = coverFile
        ? await marketplaceService.uploadFile(coverFile)
        : null;

      const material = await marketplaceService.createMaterial({
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price || 0),
        type: form.type,
        subject: selectedSubject?.name || form.subjectId || 'Geral',
        subjectId: selectedSubject ? Number(selectedSubject.id) : undefined,
        subjectText: selectedSubject?.name || '',
        topicId: selectedTopic ? Number(selectedTopic.id) : undefined,
        topic: selectedTopic?.name || '',
        examTarget: form.examTarget.trim(),
        fileUrl: uploadedFile.url,
        coverUrl: uploadedCover?.url || '',
        pageCount: uploadedFile.pageCount || 0,
        pdfPassword: form.pdfPassword || undefined,
        authorId: currentUser.id,
        authorName: currentUser.name,
        status: 'pending',
        salesCount: 0,
        rating: 0,
        createdAt: Date.now(),
        comments: [],
      });

      setMaterials((current) => [material, ...current]);
      setFullFile(null);
      setCoverFile(null);
      setForm({
        title: '',
        description: '',
        price: '0',
        type: 'PDF',
        subjectId: '',
        topicId: '',
        examTarget: '',
        pdfPassword: '',
      });
      setNotice({ type: 'success', text: 'Material enviado para moderacao.' });
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel publicar o material.') });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="animate-spin" size={18} />
          Validando acesso ao painel...
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
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Acesso de colaboradores</h1>
            <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Entre na sua conta para publicar materiais, acompanhar vendas e gerenciar seu financeiro.
            </p>
          </div>
          <Link
            href="/auth?next=%2Fpartner-dashboard"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            Entrar
          </Link>
        </section>
      </main>
    );
  }

  if (!hasPartnerAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Store size={34} />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
              Colaborador
            </p>
            <h1 className="text-4xl font-black tracking-tight">Publique materiais na plataforma</h1>
            <p className="mx-auto max-w-2xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Compartilhe PDFs, resumos e simulados com os alunos. Seus materiais passam por moderacao antes de aparecerem no marketplace.
            </p>
          </div>
          {notice ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
              {notice.text}
            </div>
          ) : null}
          {partnerRegistrationEnabled ? (
            <button
              type="button"
              onClick={handleBecomePartner}
              disabled={isBecomingPartner}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isBecomingPartner ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              Ativar perfil de colaborador
            </button>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
              O cadastro de novos colaboradores esta temporariamente fechado.
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
              Painel de colaborador
            </p>
            <h1 className="text-4xl font-black tracking-tight">Seus materiais e vendas</h1>
            <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Acompanhe publicacoes, saldo estimado e envie novos materiais para moderacao.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Store size={15} />
            Marketplace
          </Link>
        </header>

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Receita liquida', value: formatCurrency(partnerStats.totalRevenue), icon: DollarSign },
            { label: 'Disponivel', value: formatCurrency(partnerStats.availableBalance), icon: Wallet },
            { label: 'Retido', value: formatCurrency(partnerStats.heldBalance), icon: Clock },
            { label: 'Vendas', value: String(partnerStats.totalSales), icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    {item.label}
                  </p>
                  <Icon className="text-emerald-600 dark:text-emerald-300" size={18} />
                </div>
                <p className="mt-4 text-3xl font-black tracking-tight">{item.value}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Catalogo</p>
                <h2 className="text-2xl font-black">Materiais publicados</h2>
              </div>
              {isLoadingData ? (
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Loader2 className="animate-spin" size={16} />
                  Atualizando
                </div>
              ) : null}
            </div>

            {materials.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
                <FileText className="mx-auto text-slate-300 dark:text-slate-600" size={36} />
                <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum material publicado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => (
                  <article key={material.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black">{material.title}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {material.subjectText || material.subject} - {formatCurrency(material.price)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                        material.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : material.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                      }`}>
                        {material.status === 'approved' ? 'Aprovado' : material.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                      </span>
                      {material.status === 'approved' ? (
                        <Link href={`/read/${material.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">
                          Ler
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={handlePublish} className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">Publicar</p>
                <h2 className="text-2xl font-black">Novo material</h2>
                <p className="text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  O material entra como pendente e aparece no marketplace apos moderacao.
                </p>
              </div>

              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Titulo"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Descricao"
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  placeholder="Preco"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Material['type'] }))}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="PDF">PDF</option>
                  <option value="Resumo">Resumo</option>
                  <option value="Simulado">Simulado</option>
                </select>
              </div>

              <select
                value={form.subjectId}
                onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, topicId: '' }))}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Materia</option>
                {systemSettings.taxonomies?.subjects?.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>

              <select
                value={form.topicId}
                onChange={(event) => setForm((current) => ({ ...current, topicId: event.target.value }))}
                disabled={!form.subjectId}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Assunto</option>
                {systemSettings.taxonomies?.topics
                  ?.filter((topic) => String(topic.parentId || '') === String(form.subjectId))
                  .map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
              </select>

              <input
                value={form.pdfPassword}
                onChange={(event) => setForm((current) => ({ ...current, pdfPassword: event.target.value }))}
                placeholder="Senha do PDF, se houver"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-4 py-6 text-center transition hover:border-emerald-500 dark:border-slate-700">
                <UploadCloud className="text-slate-400" size={26} />
                <span className="mt-2 text-sm font-black">{fullFile ? fullFile.name : 'Arquivo principal'}</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">PDF ou arquivo aceito pelo backend</span>
                <input type="file" className="hidden" onChange={(event) => setFullFile(event.target.files?.[0] || null)} />
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-4 py-5 text-center transition hover:border-emerald-500 dark:border-slate-700">
                <Package className="text-slate-400" size={22} />
                <span className="mt-2 text-sm font-black">{coverFile ? coverFile.name : 'Capa opcional'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
              </label>

              <button
                type="submit"
                disabled={isPublishing}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
              >
                {isPublishing ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                Enviar para moderacao
              </button>
            </form>
          </aside>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-amber-700 dark:text-amber-300" size={20} />
            <p className="text-sm font-medium leading-7 text-amber-800 dark:text-amber-200">
              Saques, respostas a avaliacoes e automacoes financeiras avancadas continuam na auditoria de producao. Esta base Next ja cobre acesso, publicacao, listagem e indicadores principais.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
