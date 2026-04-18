'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Loader2,
  Lock,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  X,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import FeaturePlaceholderPage from '@/components/shared/FeaturePlaceholderPage';
import { getAssetUrl, readApiErrorMessage } from '@/lib/browserApi';
import { materialAccessService } from '@/services/materials/materialAccessService';
import { marketplaceService } from '@/services/marketplace/marketplaceService';
import type { Material, SystemSettings, Transaction } from '@/types';

type MarketplacePageClientProps = {
  initialMaterials: Material[];
  systemSettings: SystemSettings;
};

const formatCurrency = (value: number) => Number(value || 0) === 0
  ? 'Gratis'
  : `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getMaterialSubject = (material: Material) => material.subjectText || String(material.subject || 'Geral');

const isCompletedTransaction = (transaction: Transaction) => (
  transaction.status === 'completed'
  || transaction.status === 'approved'
);

export default function MarketplacePageClient({ initialMaterials, systemSettings }: MarketplacePageClientProps) {
  const { currentUser, isAuthenticated, isLoading: isAuthLoading } = useAuthSession();
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isAcquiringFree, setIsAcquiringFree] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'warning'; text: string } | null>(null);

  const featureEnabled = systemSettings.features.marketplaceEnabled !== false;

  useEffect(() => {
    let cancelled = false;

    const loadMaterials = async () => {
      setIsLoadingMaterials(true);

      try {
        const nextMaterials = await marketplaceService.listMaterials();
        if (!cancelled) {
          setMaterials(nextMaterials);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel carregar os materiais.') });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMaterials(false);
        }
      }
    };

    void loadMaterials();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    const loadTransactions = async () => {
      setIsLoadingTransactions(true);

      try {
        const nextTransactions = await marketplaceService.listTransactions({
          userId: currentUser.id,
          scope: 'buyer',
        });

        if (!cancelled) {
          setTransactions(nextTransactions);
        }
      } catch {
        if (!cancelled) {
          setTransactions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTransactions(false);
        }
      }
    };

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isAuthenticated]);

  const approvedMaterials = useMemo(
    () => materials.filter((material) => material.status === 'approved'),
    [materials],
  );

  const subjects = useMemo(() => {
    const uniqueSubjects = Array.from(new Set(
      approvedMaterials.map(getMaterialSubject).filter(Boolean),
    )).sort((left, right) => left.localeCompare(right, 'pt-BR'));

    return ['Todos', ...uniqueSubjects];
  }, [approvedMaterials]);

  const purchasedMaterialIds = useMemo(() => {
    const ids = new Set<string>();

    currentUser?.purchasedMaterialIds?.forEach((id) => ids.add(String(id)));
    transactions
      .filter(isCompletedTransaction)
      .forEach((transaction) => ids.add(String(transaction.materialId)));

    return ids;
  }, [currentUser?.purchasedMaterialIds, transactions]);

  const canAccessMaterial = (material: Material) => {
    if (!currentUser) {
      return false;
    }

    return purchasedMaterialIds.has(String(material.id))
      || material.authorId === currentUser.id
      || currentUser.isAdmin
      || currentUser.role === 'admin';
  };

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return approvedMaterials.filter((material) => {
      const subject = getMaterialSubject(material);
      const matchesSubject = selectedSubject === 'Todos' || subject === selectedSubject;
      const matchesSearch = !normalizedSearch
        || normalizeText(material.title).includes(normalizedSearch)
        || normalizeText(material.description || '').includes(normalizedSearch)
        || normalizeText(subject).includes(normalizedSearch)
        || normalizeText(material.topic || '').includes(normalizedSearch);

      return matchesSubject && matchesSearch;
    });
  }, [approvedMaterials, searchTerm, selectedSubject]);

  const myMaterials = useMemo(
    () => approvedMaterials.filter((material) => canAccessMaterial(material)),
    [approvedMaterials, currentUser, purchasedMaterialIds],
  );

  const handleDownload = async (material: Material) => {
    if (!canAccessMaterial(material)) {
      setNotice({ type: 'warning', text: 'Entre na sua conta e adquira o material antes de baixar.' });
      return;
    }

    setIsDownloading(material.id);
    setNotice(null);

    try {
      const file = await materialAccessService.downloadProtectedMaterial(material.id);
      const downloadUrl = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = file.fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel baixar este material.') });
    } finally {
      setIsDownloading(null);
    }
  };

  const handleAcquire = async (material: Material) => {
    if (!isAuthenticated || !currentUser) {
      setNotice({ type: 'warning', text: 'Entre na sua conta para adquirir este material.' });
      return;
    }

    if (Number(material.price || 0) > 0) {
      setSelectedMaterial(material);
      setNotice({
        type: 'warning',
        text: 'Novas compras pagas do marketplace seguem pausadas ate a auditoria do fluxo oficial de pagamentos.',
      });
      return;
    }

    setIsAcquiringFree(material.id);
    setNotice(null);

    try {
      const transaction = await marketplaceService.acquireFreeMaterial(material.id);
      if (transaction) {
        setTransactions((current) => [transaction, ...current]);
      }
      setNotice({ type: 'success', text: 'Material gratuito liberado na sua biblioteca.' });
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel liberar este material gratuito.') });
    } finally {
      setIsAcquiringFree(null);
    }
  };

  if (!featureEnabled) {
    return (
      <FeaturePlaceholderPage
        title="Marketplace"
        description="Vitrine de materiais de estudo produzidos por colaboradores da plataforma."
        icon={Store}
        isEnabled={false}
        featureLabel="Marketplace"
        backHref="/"
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Store size={13} />
              Marketplace
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Materiais para estudar com mais direcao
              </h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                Encontre PDFs, resumos e simulados publicados por colaboradores. Materiais ja adquiridos abrem no leitor protegido nativo da plataforma.
              </p>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Biblioteca
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-black">{approvedMaterials.length}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">materiais</p>
              </div>
              <div>
                <p className="text-2xl font-black">{myMaterials.length}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">liberados</p>
              </div>
            </div>
            <Link
              href="/partner-dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              <Package size={14} />
              Area do colaborador
            </Link>
          </aside>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por titulo, materia ou assunto..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <label className="relative block">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-black outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
        </section>

        {(isLoadingMaterials || isLoadingTransactions || isAuthLoading) ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <Loader2 className="animate-spin" size={18} />
            Atualizando catalogo...
          </div>
        ) : null}

        {filteredMaterials.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <FileText size={28} />
            </div>
            <h2 className="mt-5 text-xl font-black">Nenhum material encontrado</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Ajuste a busca ou remova o filtro de materia para ver outros materiais.
            </p>
          </section>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredMaterials.map((material) => {
              const hasAccess = canAccessMaterial(material);
              const coverUrl = getAssetUrl(material.coverUrl);

              return (
                <article key={material.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setSelectedMaterial(material)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={material.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                          <FileText size={48} />
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm dark:bg-slate-950/80 dark:text-slate-200">
                        {material.type}
                      </div>
                      {hasAccess ? (
                        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-sm">
                          <CheckCircle2 size={12} />
                          Liberado
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                          {getMaterialSubject(material)}
                        </p>
                        <h2 className="line-clamp-2 text-xl font-black leading-tight text-slate-900 dark:text-slate-100">
                          {material.title}
                        </h2>
                        <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                          {material.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star size={15} className="fill-current" />
                          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                            {Number(material.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {formatCurrency(material.price)}
                        </p>
                      </div>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
                    {hasAccess ? (
                      <Link
                        href={`/read/${material.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                      >
                        <BookOpen size={14} />
                        Ler
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcquire(material)}
                        disabled={isAcquiringFree === material.id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isAcquiringFree === material.id ? <Loader2 className="animate-spin" size={14} /> : <ShoppingBag size={14} />}
                        {Number(material.price || 0) === 0 ? 'Obter' : 'Comprar'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownload(material)}
                      disabled={!hasAccess || isDownloading === material.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {isDownloading === material.id ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      Baixar
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedMaterial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                  {getMaterialSubject(selectedMaterial)}
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {selectedMaterial.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMaterial(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {selectedMaterial.details || selectedMaterial.description}
              </p>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Valor</p>
                  <p className="mt-2 text-lg font-black">{formatCurrency(selectedMaterial.price)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Paginas</p>
                  <p className="mt-2 text-lg font-black">{selectedMaterial.pageCount || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Autor</p>
                  <p className="mt-2 text-lg font-black">{selectedMaterial.authorName || 'Colaborador'}</p>
                </div>
              </div>

              {Number(selectedMaterial.price || 0) > 0 && !canAccessMaterial(selectedMaterial) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 text-amber-700 dark:text-amber-300" size={18} />
                    <p className="text-sm font-medium leading-6 text-amber-800 dark:text-amber-200">
                      O checkout de novas compras pagas do marketplace esta pausado durante a transicao para a base Next e a auditoria de pagamentos.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {canAccessMaterial(selectedMaterial) ? (
                  <Link
                    href={`/read/${selectedMaterial.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                  >
                    <BookOpen size={15} />
                    Abrir leitor
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAcquire(selectedMaterial)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400"
                  >
                    {Number(selectedMaterial.price || 0) === 0 ? <ShieldCheck size={15} /> : <Lock size={15} />}
                    {Number(selectedMaterial.price || 0) === 0 ? 'Liberar gratis' : 'Checkout pausado'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDownload(selectedMaterial)}
                  disabled={!canAccessMaterial(selectedMaterial)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download size={15} />
                  Baixar PDF
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
