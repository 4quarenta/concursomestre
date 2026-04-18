'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Lock,
  RefreshCcw,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { readApiErrorMessage } from '@/lib/browserApi';
import { materialAccessService } from '@/services/materials/materialAccessService';

type MaterialReaderClientProps = {
  materialId: string;
};

type LoadedMaterial = {
  fileName: string;
  objectUrl: string;
};

export default function MaterialReaderClient({ materialId }: MaterialReaderClientProps) {
  const { currentUser, isAuthenticated, isLoading } = useAuthSession();
  const [loadedMaterial, setLoadedMaterial] = useState<LoadedMaterial | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const title = useMemo(
    () => loadedMaterial?.fileName || `Material ${materialId}`,
    [loadedMaterial?.fileName, materialId],
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated || !currentUser) {
      return;
    }

    let cancelled = false;
    let objectUrlToRelease = '';

    const loadMaterial = async () => {
      setIsFetching(true);
      setErrorMessage('');

      try {
        const file = await materialAccessService.openProtectedMaterial(materialId);
        if (cancelled) {
          return;
        }

        const objectUrl = URL.createObjectURL(file.blob);
        objectUrlToRelease = objectUrl;
        setLoadedMaterial({
          fileName: file.fileName,
          objectUrl,
        });
      } catch (error) {
        if (!cancelled) {
          setLoadedMaterial(null);
          setErrorMessage(readApiErrorMessage(error, 'Nao foi possivel abrir este material.'));
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    void loadMaterial();

    return () => {
      cancelled = true;

      if (objectUrlToRelease) {
        URL.revokeObjectURL(objectUrlToRelease);
      }
    };
  }, [currentUser, isAuthenticated, isLoading, materialId, retryToken]);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const file = await materialAccessService.downloadProtectedMaterial(materialId);
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
      setErrorMessage(readApiErrorMessage(error, 'Nao foi possivel baixar este material.'));
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-medium">
          <Loader2 className="animate-spin" size={18} />
          Validando sessao de leitura...
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <section className="w-full max-w-lg space-y-6 rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-amber-950">
            <Lock size={24} />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
              Leitor protegido
            </p>
            <h1 className="text-3xl font-black tracking-tight">
              Entre para acessar este material
            </h1>
            <p className="text-sm font-medium leading-7 text-slate-300">
              O arquivo e aberto por um endpoint autenticado, com validacao de permissao no backend antes de liberar a visualizacao.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/auth?next=${encodeURIComponent(`/read/${materialId}`)}`}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-amber-950 transition hover:bg-amber-300"
            >
              Entrar
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
            >
              Ver materiais
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex flex-none flex-col gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/marketplace"
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Voltar para materiais"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Leitor protegido
            </p>
            <h1 className="truncate text-sm font-black text-white md:text-base">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRetryToken((current) => current + 1)}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCcw size={14} />
            Recarregar
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || isFetching}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
          >
            {isDownloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            Baixar
          </button>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 bg-slate-900">
        {isFetching ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/90">
            <Loader2 className="animate-spin text-emerald-400" size={42} />
            <div className="space-y-1 text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
                Abrindo material
              </p>
              <p className="text-sm font-medium text-slate-400">
                Validando permissao e preparando o PDF protegido.
              </p>
            </div>
          </div>
        ) : null}

        {errorMessage && !isFetching ? (
          <div className="m-auto w-full max-w-xl px-4">
            <div className="space-y-5 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500 text-white">
                <AlertTriangle size={28} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black">Nao foi possivel abrir o material</h2>
                <p className="text-sm font-medium leading-7 text-rose-100">{errorMessage}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRetryToken((current) => current + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-slate-100"
                >
                  <RefreshCcw size={14} />
                  Tentar novamente
                </button>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                >
                  <FileText size={14} />
                  Ver materiais
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {loadedMaterial && !errorMessage ? (
          <iframe
            src={loadedMaterial.objectUrl}
            title={title}
            className="h-full w-full border-0 bg-white"
          />
        ) : null}
      </section>
    </main>
  );
}
