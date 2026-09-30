'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Code2, Copy, ExternalLink, LoaderCircle, Power } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type { MarketingLandingPage, SystemSettings } from '@types';
import {
  MARKETING_LANDING_SCRIPT_REGISTRY,
  createDefaultEliteLandingPage,
  mergeMarketingLandingPages,
  normalizeLandingSlug,
} from '@services/marketing/landingPages';
import { ADMIN_PRIMARY_BUTTON_CLASS, ADMIN_SECONDARY_BUTTON_CLASS, ADMIN_SURFACE_CLASS } from '../shared/adminPanelStyles';

interface AdminLandingPagesManagerProps {
  systemSettings: SystemSettings;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
}

const AdminLandingPagesManager: React.FC<AdminLandingPagesManagerProps> = ({
  systemSettings,
  saveSystemSettingsNow,
}) => {
  const { addToast } = useToast();
  const [isSavingScript, setIsSavingScript] = useState<string | null>(null);
  const pages = useMemo(
    () => mergeMarketingLandingPages(systemSettings.landingPages, systemSettings.siteName || 'ConcursoMestre'),
    [systemSettings.landingPages, systemSettings.siteName],
  );

  const getPageForScript = (scriptId: string) => {
    const definition = MARKETING_LANDING_SCRIPT_REGISTRY.find((script) => script.id === scriptId);
    if (!definition) return null;
    return pages.find((page) => page.scriptId === scriptId)
      || pages.find((page) => normalizeLandingSlug(page.slug) === definition.slug)
      || null;
  };

  const toggleAvailability = async (scriptId: string, enabled: boolean) => {
    const definition = MARKETING_LANDING_SCRIPT_REGISTRY.find((script) => script.id === scriptId);
    if (!definition || isSavingScript) return;

    setIsSavingScript(scriptId);
    try {
      const currentPage = getPageForScript(scriptId);
      const basePage = currentPage || createDefaultEliteLandingPage(systemSettings.siteName || 'ConcursoMestre');
      const pageToSave: MarketingLandingPage = {
        ...basePage,
        scriptId,
        slug: definition.slug,
        status: enabled ? 'published' : 'draft',
        updatedAt: new Date().toISOString(),
      };
      const nextPages = currentPage
        ? pages.map((page) => page.id === currentPage.id ? pageToSave : page)
        : [...pages, pageToSave];

      await saveSystemSettingsNow({ ...systemSettings, landingPages: nextPages });
      addToast(enabled ? 'Landing page ativada.' : 'Landing page desativada.', 'success');
    } catch {
      addToast('Nao foi possivel atualizar a disponibilidade da landing page.', 'error');
    } finally {
      setIsSavingScript(null);
    }
  };

  const copyLink = async (path: string) => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      addToast('Link copiado.', 'success');
    } catch {
      addToast('Nao foi possivel copiar o link.', 'error');
    }
  };

  return (
    <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
      <header className="border-b border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/40 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Code2 size={19} className="text-sky-700 dark:text-sky-300" />
              <h2 className="text-lg font-bold">Landing pages</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Acesse e compartilhe as páginas comerciais implementadas no código. Novas páginas aparecem aqui quando forem registradas pela equipe.
            </p>
          </div>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
            {MARKETING_LANDING_SCRIPT_REGISTRY.length} página(s) no catálogo
          </span>
        </div>
      </header>

      <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
        {MARKETING_LANDING_SCRIPT_REGISTRY.map((script) => {
          const page = getPageForScript(script.id);
          const published = page?.status === 'published';
          const busy = isSavingScript === script.id;

          return (
            <article key={script.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{script.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{script.description}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${published
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {published ? 'Disponível' : 'Indisponível'}
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Link da landing</p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={script.path}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
                  >
                    {script.path}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void copyLink(script.path)}
                    aria-label={`Copiar link de ${script.title}`}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-sky-300"
                  >
                    <Copy size={15} />
                  </button>
                  <Link
                    href={script.path}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${script.title}`}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-sky-300"
                  >
                    <ExternalLink size={15} />
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Componente: <code className="text-slate-700 dark:text-slate-200">{script.id}</code></span>
                <span>Arquivo: <code className="text-slate-700 dark:text-slate-200">{script.componentPath}</code></span>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Link href={script.path} target="_blank" rel="noreferrer" className={`${ADMIN_SECONDARY_BUTTON_CLASS} flex-1 justify-center px-4 py-2.5`}>
                  Ver landing <ArrowUpRight size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleAvailability(script.id, !published)}
                  disabled={busy}
                  className={`${published ? ADMIN_SECONDARY_BUTTON_CLASS : ADMIN_PRIMARY_BUTTON_CLASS} flex-1 justify-center px-4 py-2.5 disabled:cursor-wait disabled:opacity-60`}
                >
                  {busy ? <LoaderCircle size={15} className="animate-spin" /> : published ? <Power size={15} /> : <Check size={15} />}
                  {busy ? 'Salvando...' : published ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:px-7">
        Landings são implementadas e associadas ao componente no código. Esta área centraliza os links e permite controlar a disponibilidade; não cria nem edita páginas.
      </footer>
    </section>
  );
};

export default AdminLandingPagesManager;
