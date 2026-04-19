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
import { ExternalLink, Globe, RefreshCcw, Search, Sparkles } from 'lucide-react';
import type { SeoPageSettings, SeoSettings } from '@types';
import { seoService, type SitemapStatusPayload } from '@services/seo';
import {
  buildSeoOgPreview,
  buildSeoSerpPreview,
  calculateSeoCompletenessScore,
  SEO_PAGE_LABELS,
  SEO_PAGE_ORDER,
  SEO_ROBOTS_OPTIONS,
} from './seoSettings';

interface AdminSeoSettingsSectionProps {
  seoSettings: SeoSettings;
  onChange: (next: SeoSettings) => void;
}

const inputClassName = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';

/**
 * Editor oficial das configuracoes de SEO do admin.
 * Mantem o estado local controlado e deixa o save explicito no shell de settings.
 */
const AdminSeoSettingsSection = ({
  seoSettings,
  onChange,
}: AdminSeoSettingsSectionProps) => {
  const [activePage, setActivePage] = useState<keyof SeoSettings['pages']>('landing');
  const [sitemapStatus, setSitemapStatus] = useState<SitemapStatusPayload | null>(null);
  const [isLoadingSitemapStatus, setIsLoadingSitemapStatus] = useState(true);

  const completenessScore = useMemo(() => calculateSeoCompletenessScore(seoSettings), [seoSettings]);
  const serpPreview = useMemo(() => buildSeoSerpPreview(seoSettings, activePage), [activePage, seoSettings]);
  const ogPreview = useMemo(() => buildSeoOgPreview(seoSettings, activePage), [activePage, seoSettings]);
  const coverageCards = useMemo(() => {
    if (!sitemapStatus) {
      return [];
    }

    return [
      { label: 'Institucionais', bucket: sitemapStatus.coverage.institutional },
      { label: 'Questoes', bucket: sitemapStatus.coverage.questions },
      { label: 'Rankings', bucket: sitemapStatus.coverage.rankings },
      { label: 'Materiais', bucket: sitemapStatus.coverage.materials },
    ];
  }, [sitemapStatus]);

  const loadSitemapStatus = React.useCallback(async () => {
    setIsLoadingSitemapStatus(true);
    try {
      const payload = await seoService.getSitemapStatus();
      setSitemapStatus(payload);
    } finally {
      setIsLoadingSitemapStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadSitemapStatus();
  }, [loadSitemapStatus]);

  const updateGlobalField = (field: keyof SeoSettings['global'], value: string | boolean) => {
    onChange({
      ...seoSettings,
      global: {
        ...seoSettings.global,
        [field]: value,
      },
    });
  };

  const updatePageField = (pageKey: keyof SeoSettings['pages'], field: keyof SeoPageSettings, value: string) => {
    onChange({
      ...seoSettings,
      pages: {
        ...seoSettings.pages,
        [pageKey]: {
          ...seoSettings.pages[pageKey],
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
              <Globe size={20} className="text-emerald-600 dark:text-emerald-300" />
              Cobertura do sitemap
            </h3>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Visualize quantas URLs publicas ja foram materializadas no sitemap oficial. Isso mede cobertura operacional, nao confirmacao do Google.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSitemapStatus()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
          >
            <RefreshCcw size={14} />
            Atualizar cobertura
          </button>
        </div>

        {isLoadingSitemapStatus ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            Carregando status do sitemap...
          </div>
        ) : !sitemapStatus ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm font-semibold text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
            Nenhum `sitemap-status.json` foi encontrado. Execute `npm run seo:generate` para gerar o sitemap, o robots.txt e a cobertura operacional.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {coverageCards.map((card) => {
                const percent = card.bucket.total > 0 ? Math.round((card.bucket.indexed / card.bucket.total) * 100) : 100;

                return (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{card.label}</p>
                    <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">{percent}%</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {card.bucket.indexed} de {card.bucket.total} URLs geradas
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),320px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status atual</p>
                <div className="mt-3 space-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <p>Total de URLs no sitemap: <span className="font-black text-slate-900 dark:text-slate-100">{sitemapStatus.totalUrls}</span></p>
                  <p>Gerado em: <span className="font-black text-slate-900 dark:text-slate-100">{new Date(sitemapStatus.generatedAt).toLocaleString('pt-BR')}</span></p>
                  <p>Base canonica: <span className="font-black text-slate-900 dark:text-slate-100">{sitemapStatus.canonicalBaseUrl}</span></p>
                </div>
                {sitemapStatus.note ? (
                  <p className="mt-4 text-xs font-medium leading-6 text-slate-500 dark:text-slate-400">{sitemapStatus.note}</p>
                ) : null}
                {(sitemapStatus.missingSamples.questions.length > 0 || sitemapStatus.missingSamples.rankings.length > 0 || sitemapStatus.missingSamples.materials.length > 0) ? (
                  <div className="mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Pendencias de cobertura</p>
                    {sitemapStatus.missingSamples.questions.length > 0 ? (
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Questoes sem URL: {sitemapStatus.missingSamples.questions.join(', ')}</p>
                    ) : null}
                    {sitemapStatus.missingSamples.rankings.length > 0 ? (
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Rankings sem URL: {sitemapStatus.missingSamples.rankings.join(', ')}</p>
                    ) : null}
                    {sitemapStatus.missingSamples.materials.length > 0 ? (
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Materiais sem URL: {sitemapStatus.missingSamples.materials.join(', ')}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Arquivos gerados</p>
                <div className="mt-4 flex flex-col gap-3">
                  <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600">
                    Sitemap.xml <ExternalLink size={14} />
                  </a>
                  <a href="/robots.txt" target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600">
                    Robots.txt <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr),320px]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
                <Globe size={20} className="text-indigo-600 dark:text-indigo-400" />
                SEO global
              </h3>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Defina o padrão de indexação, Open Graph e verificação do domínio.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right dark:border-emerald-900/30 dark:bg-emerald-900/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Completude SEO</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{completenessScore}%</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClassName}>Site title</label>
              <input value={seoSettings.global.site_title} onChange={(event) => updateGlobalField('site_title', event.target.value)} className={inputClassName} maxLength={65} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Canonical base URL</label>
              <input value={seoSettings.global.canonical_base_url} onChange={(event) => updateGlobalField('canonical_base_url', event.target.value)} className={inputClassName} placeholder="https://concursomestre.com.br" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelClassName}>Meta description</label>
              <textarea value={seoSettings.global.meta_description} onChange={(event) => updateGlobalField('meta_description', event.target.value)} className={`${inputClassName} min-h-[96px] resize-none`} maxLength={170} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Robots default</label>
              <select value={seoSettings.global.robots_default} onChange={(event) => updateGlobalField('robots_default', event.target.value)} className={inputClassName}>
                {SEO_ROBOTS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Default OG image</label>
              <input value={seoSettings.global.default_og_image} onChange={(event) => updateGlobalField('default_og_image', event.target.value)} className={inputClassName} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Default OG title</label>
              <input value={seoSettings.global.default_og_title} onChange={(event) => updateGlobalField('default_og_title', event.target.value)} className={inputClassName} maxLength={95} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Default Twitter title</label>
              <input value={seoSettings.global.default_twitter_title} onChange={(event) => updateGlobalField('default_twitter_title', event.target.value)} className={inputClassName} maxLength={95} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Default OG description</label>
              <textarea value={seoSettings.global.default_og_description} onChange={(event) => updateGlobalField('default_og_description', event.target.value)} className={`${inputClassName} min-h-[96px] resize-none`} maxLength={220} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Default Twitter description</label>
              <textarea value={seoSettings.global.default_twitter_description} onChange={(event) => updateGlobalField('default_twitter_description', event.target.value)} className={`${inputClassName} min-h-[96px] resize-none`} maxLength={220} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Default Twitter image</label>
              <input value={seoSettings.global.default_twitter_image} onChange={(event) => updateGlobalField('default_twitter_image', event.target.value)} className={inputClassName} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Google site verification</label>
              <input value={seoSettings.global.google_site_verification || ''} onChange={(event) => updateGlobalField('google_site_verification', event.target.value)} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClassName}>Bing site verification</label>
              <input value={seoSettings.global.bing_site_verification || ''} onChange={(event) => updateGlobalField('bing_site_verification', event.target.value)} className={inputClassName} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Noindex fora de produção</p>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Protege staging e ambientes internos.</p>
              </div>
              <input type="checkbox" checked={seoSettings.global.noindex_non_production} onChange={(event) => updateGlobalField('noindex_non_production', event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Sitemap ativo</p>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Controla a geração oficial do sitemap.</p>
              </div>
              <input type="checkbox" checked={seoSettings.global.enable_sitemap} onChange={(event) => updateGlobalField('enable_sitemap', event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Robots.txt customizado</p>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Permite overrides operacionais de robots.</p>
              </div>
              <input type="checkbox" checked={seoSettings.global.enable_robots_txt_control} onChange={(event) => updateGlobalField('enable_robots_txt_control', event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">Preview SERP</p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{serpPreview.canonical}</p>
              <p className="mt-2 text-lg font-semibold text-indigo-700 dark:text-indigo-300">{serpPreview.title || 'Sem title definido'}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{serpPreview.description || 'Sem meta description definida.'}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-fuchsia-600 dark:text-fuchsia-400" />
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">Preview Open Graph</p>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-indigo-100 to-fuchsia-100 text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:from-indigo-950 dark:to-fuchsia-950 dark:text-slate-400">
                {ogPreview.image ? 'Imagem OG definida' : 'Sem imagem OG'}
              </div>
              <div className="space-y-2 p-4">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">{ogPreview.title || 'Sem OG title definido'}</p>
                <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{ogPreview.description || 'Sem OG description definida.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
          {SEO_PAGE_ORDER.map((pageKey) => (
            <button
              key={pageKey}
              type="button"
              onClick={() => setActivePage(pageKey)}
              className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                activePage === pageKey
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {SEO_PAGE_LABELS[pageKey]}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClassName}>Title</label>
            <input value={seoSettings.pages[activePage].title || ''} onChange={(event) => updatePageField(activePage, 'title', event.target.value)} className={inputClassName} maxLength={65} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClassName}>Canonical URL</label>
            <input value={seoSettings.pages[activePage].canonical_url || ''} onChange={(event) => updatePageField(activePage, 'canonical_url', event.target.value)} className={inputClassName} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelClassName}>Meta description</label>
            <textarea value={seoSettings.pages[activePage].meta_description || ''} onChange={(event) => updatePageField(activePage, 'meta_description', event.target.value)} className={`${inputClassName} min-h-[96px] resize-none`} maxLength={170} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClassName}>OG title</label>
            <input value={seoSettings.pages[activePage].og_title || ''} onChange={(event) => updatePageField(activePage, 'og_title', event.target.value)} className={inputClassName} maxLength={95} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClassName}>OG image</label>
            <input value={seoSettings.pages[activePage].og_image || ''} onChange={(event) => updatePageField(activePage, 'og_image', event.target.value)} className={inputClassName} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelClassName}>OG description</label>
            <textarea value={seoSettings.pages[activePage].og_description || ''} onChange={(event) => updatePageField(activePage, 'og_description', event.target.value)} className={`${inputClassName} min-h-[96px] resize-none`} maxLength={220} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClassName}>Robots override</label>
            <select value={seoSettings.pages[activePage].robots_override || ''} onChange={(event) => updatePageField(activePage, 'robots_override', event.target.value)} className={inputClassName}>
              <option value="">Usar padrão global</option>
              {SEO_ROBOTS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSeoSettingsSection;
