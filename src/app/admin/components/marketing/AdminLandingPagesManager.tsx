'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Code2, LoaderCircle, Search } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type { MarketingLandingPage, SystemSettings } from '@types';
import {
  MARKETING_LANDING_SCRIPT_REGISTRY,
  createDefaultEliteLandingPage,
  mergeMarketingLandingPages,
  normalizeLandingSlug,
} from '@services/marketing/landingPages';
import { ADMIN_SURFACE_CLASS } from '../shared/adminPanelStyles';

interface AdminLandingPagesManagerProps {
  systemSettings: SystemSettings;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
}

const AdminLandingPagesManager: React.FC<AdminLandingPagesManagerProps> = ({
  systemSettings,
  saveSystemSettingsNow,
}) => {
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <nav aria-label="Filtrar landing pages" className="flex gap-4 text-sm">
          {([
            ['all', 'Todas'], ['published', 'Disponíveis'], ['draft', 'Indisponíveis'],
          ] as const).map(([value, label]) => {
            const count = MARKETING_LANDING_SCRIPT_REGISTRY.filter((script) => value === 'all' || (getPageForScript(script.id)?.status === 'published' ? 'published' : 'draft') === value).length;
            return <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`border-b-2 pb-1 ${filter === value ? 'border-sky-600 text-sky-700 dark:text-sky-300' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>{label} ({count})</button>;
          })}
        </nav>
        <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <Search size={16} className="text-slate-400" />
          <input aria-label="Buscar landing pages" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar landing..." className="w-52 bg-transparent text-sm outline-none dark:text-slate-200" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
            <tr><th scope="col" className="px-5 py-4">Título</th><th scope="col" className="px-5 py-4">Link</th><th scope="col" className="px-5 py-4">Status</th><th scope="col" className="px-5 py-4">Componente</th><th scope="col" className="px-5 py-4">Atualizada</th></tr>
          </thead>
          <tbody>
            {MARKETING_LANDING_SCRIPT_REGISTRY.filter((script) => {
              const status = getPageForScript(script.id)?.status === 'published' ? 'published' : 'draft';
              return (filter === 'all' || filter === status) && `${script.title} ${script.path} ${script.id}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
            }).map((script) => {
              const page = getPageForScript(script.id);
              const published = page?.status === 'published';
              const busy = isSavingScript === script.id;
              return (
                <tr key={script.id} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/60 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-950/30">
                  <td className="px-5 py-5 align-top">
                    <Link href={script.path} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline dark:text-sky-300">{script.title}</Link>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">{script.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
                      <Link href={script.path} target="_blank" rel="noreferrer" className="hover:underline">Ver</Link>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <button type="button" onClick={() => void copyLink(script.path)} className="hover:underline">Copiar link</button>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <button type="button" onClick={() => void toggleAvailability(script.id, !published)} disabled={isSavingScript !== null} className="inline-flex items-center gap-1 hover:underline disabled:opacity-50">
                        {busy && <LoaderCircle size={12} className="animate-spin" />}{busy ? 'Salvando...' : published ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-5 align-top"><code className="text-xs text-slate-600 dark:text-slate-300">{script.path}</code></td>
                  <td className="px-5 py-5 align-top"><span className={`rounded px-2 py-1 text-xs font-semibold ${published ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{published ? 'Disponível' : 'Indisponível'}</span></td>
                  <td className="px-5 py-5 align-top"><code title={script.componentPath} className="text-xs text-slate-600 dark:text-slate-300">{script.id}</code></td>
                  <td className="whitespace-nowrap px-5 py-5 align-top text-slate-500 dark:text-slate-400">{page?.updatedAt && !Number.isNaN(Date.parse(page.updatedAt)) ? new Date(page.updatedAt).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              );
            })}
            {!MARKETING_LANDING_SCRIPT_REGISTRY.some((script) => (filter === 'all' || (getPageForScript(script.id)?.status === 'published' ? 'published' : 'draft') === filter) && `${script.title} ${script.path} ${script.id}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))) && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Nenhuma landing page encontrada.</td></tr>}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:px-7">
        Landings são implementadas e associadas ao componente no código. Esta área centraliza os links e permite controlar a disponibilidade; não cria nem edita páginas.
      </footer>
    </section>
  );
};

export default AdminLandingPagesManager;
