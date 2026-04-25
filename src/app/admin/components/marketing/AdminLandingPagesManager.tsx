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
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  LayoutTemplate,
  Plus,
  Rocket,
  Save,
  Trash2,
} from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type {
  MarketingLandingComparisonRow,
  MarketingLandingContentBlockItem,
  MarketingLandingFaqItem,
  MarketingLandingObjectionItem,
  MarketingLandingPage,
  MarketingLandingPlanCard,
  Plan,
  PlanName,
  SystemSettings,
} from '@types';
import { planService } from '@services/plans';
import {
  buildMarketingLandingPath,
  createDefaultPlansLandingPage,
  duplicateMarketingLandingPage,
  mergeMarketingLandingPages,
  normalizeLandingSlug,
} from '@services/marketing/landingPages';
import {
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

interface AdminLandingPagesManagerProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
}

const inputClassName = 'w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-sky-700 focus:ring-1 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';
const sectionClassName = ADMIN_PAGE_PANEL_CLASS;

const listToTextareaValue = (items?: string[] | null) => (Array.isArray(items) ? items.join('\n') : '');
const textAreaToList = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);

const buildUniqueSlug = (existingPages: MarketingLandingPage[], baseSlug: string) => {
  const normalizedBase = normalizeLandingSlug(baseSlug) || 'landing';
  const usedSlugs = new Set(existingPages.map((page) => normalizeLandingSlug(page.slug)));

  if (!usedSlugs.has(normalizedBase)) {
    return normalizedBase;
  }

  let suffix = 2;
  while (usedSlugs.has(`${normalizedBase}-${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedBase}-${suffix}`;
};

const updateLandingInCollection = (
  pages: MarketingLandingPage[],
  landingId: string,
  updater: (page: MarketingLandingPage) => MarketingLandingPage,
) => pages.map((page) => (page.id === landingId ? updater(page) : page));

const createNewLandingDraft = (siteName: string, existingPages: MarketingLandingPage[]) => {
  const now = new Date().toISOString();
  const baseLanding = createDefaultPlansLandingPage(siteName);
  return {
    ...baseLanding,
    id: `landing-${Date.now()}`,
    title: `Nova landing ${existingPages.length + 1}`,
    slug: buildUniqueSlug(existingPages, `${baseLanding.slug}-${existingPages.length + 1}`),
    status: 'draft' as const,
    createdAt: now,
    updatedAt: now,
  };
};

const createEmptyPlanCard = (): MarketingLandingPlanCard => ({
  id: `plan-card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'Novo card de plano',
  planName: 'Elite',
  badge: '',
  description: 'Descreva rapidamente o valor percebido do plano.',
  ctaLabel: 'Ir para o checkout',
  featured: false,
  summaryBenefits: ['Beneficio principal 1', 'Beneficio principal 2'],
});

const createEmptyAuthorityItem = (): MarketingLandingContentBlockItem => ({
  title: 'Novo bloco de autoridade',
  description: 'Explique o valor prático deste bloco.',
});

const createEmptyComparisonRow = (): MarketingLandingComparisonRow => ({
  id: `comparison-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: 'Novo diferencial',
  values: { Essencial: '', Pro: '', Elite: '' },
});

const createEmptyObjection = (): MarketingLandingObjectionItem => ({
  title: 'Nova objecao',
  description: 'Responda a inseguranca do usuario.',
});

const createEmptyFaq = (): MarketingLandingFaqItem => ({
  id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  question: 'Nova pergunta frequente',
  answer: 'Escreva a resposta oficial da campanha.',
});

/**
 * Editor oficial das landing pages comerciais.
 * O estado fica local ate o save explicito, e a persistencia usa o endpoint oficial de settings.
 *
 * @since v1.0.0
 */
const AdminLandingPagesManager: React.FC<AdminLandingPagesManagerProps> = ({
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
}) => {
  const { addToast } = useToast();
  const siteName = systemSettings.siteName || 'ConcursoMestre';
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [draftPages, setDraftPages] = useState<MarketingLandingPage[]>(() => mergeMarketingLandingPages(systemSettings.landingPages, siteName));
  const [selectedLandingId, setSelectedLandingId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<MarketingLandingPage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    planService.getPlans()
      .then((plans) => {
        if (mounted) {
          setAvailablePlans(Array.isArray(plans) ? plans : []);
        }
      })
      .catch(() => {
        if (mounted) {
          setAvailablePlans([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const mergedPages = mergeMarketingLandingPages(systemSettings.landingPages, siteName);
    setDraftPages(mergedPages);
    setSelectedLandingId((currentId) => (mergedPages.some((page) => page.id === currentId) ? currentId : (mergedPages[0]?.id || '')));
  }, [siteName, systemSettings.landingPages]);

  const selectedLanding = useMemo(
    () => draftPages.find((page) => page.id === selectedLandingId) || draftPages[0] || null,
    [draftPages, selectedLandingId],
  );

  const linkedPlanOptions = useMemo(() => availablePlans.map((plan) => ({
    value: String(plan.id),
    label: `${plan.name} (#${plan.id})`,
  })), [availablePlans]);

  const previewHref = selectedLanding ? `${buildMarketingLandingPath(selectedLanding.slug)}?preview=${selectedLanding.id}` : '#';
  const publishedHref = selectedLanding ? buildMarketingLandingPath(selectedLanding.slug) : '#';

  const persistLandingPages = async (nextPages: MarketingLandingPage[], successMessage: string) => {
    const normalizedSlugs = nextPages.map((page) => normalizeLandingSlug(page.slug));
    if (normalizedSlugs.some((slug, index) => normalizedSlugs.indexOf(slug) !== index)) {
      addToast('Os slugs das landing pages precisam ser unicos.', 'error');
      return false;
    }

    setIsSaving(true);

    try {
      const persisted = await saveSystemSettingsNow({
        ...systemSettings,
        landingPages: nextPages,
      });
      updateSystemSettings(persisted);
      addToast(successMessage, 'success');
      return true;
    } catch {
      addToast('Nao foi possivel salvar as landing pages.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const patchSelectedLanding = (updater: (landingPage: MarketingLandingPage) => MarketingLandingPage) => {
    if (!selectedLanding) {
      return;
    }

    setDraftPages((currentPages) => updateLandingInCollection(currentPages, selectedLanding.id, updater));
  };

  const handleCreateLanding = () => {
    const nextLanding = createNewLandingDraft(siteName, draftPages);
    setDraftPages((currentPages) => [...currentPages, nextLanding]);
    setSelectedLandingId(nextLanding.id);
  };

  const handleDuplicateLanding = () => {
    if (!selectedLanding) {
      return;
    }

    const duplicated = duplicateMarketingLandingPage(selectedLanding);
    const nextLanding = {
      ...duplicated,
      slug: buildUniqueSlug(draftPages, duplicated.slug),
    };

    setDraftPages((currentPages) => [...currentPages, nextLanding]);
    setSelectedLandingId(nextLanding.id);
  };

  const handleSaveSelectedLanding = async () => {
    if (!selectedLanding) {
      return;
    }

    const nextPages = draftPages.map((page) => (page.id === selectedLanding.id ? {
      ...page,
      slug: normalizeLandingSlug(page.slug) || buildUniqueSlug(draftPages.filter((item) => item.id !== page.id), page.title),
      updatedAt: new Date().toISOString(),
    } : page));

    if (await persistLandingPages(nextPages, 'Landing page salva com sucesso.')) {
      setDraftPages(nextPages);
    }
  };

  const handleTogglePublish = async () => {
    if (!selectedLanding) {
      return;
    }

    const nextPages: MarketingLandingPage[] = draftPages.map((page) => (page.id === selectedLanding.id ? {
      ...page,
      status: page.status === 'published' ? 'draft' as const : 'published' as const,
      updatedAt: new Date().toISOString(),
    } : page));

    if (await persistLandingPages(nextPages, selectedLanding.status === 'published' ? 'Landing despublicada.' : 'Landing publicada com sucesso.')) {
      setDraftPages(nextPages);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    const nextPages = draftPages.filter((page) => page.id !== pendingDelete.id);
    if (await persistLandingPages(nextPages, 'Landing removida com sucesso.')) {
      setDraftPages(nextPages);
      setSelectedLandingId(nextPages[0]?.id || '');
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <AdminConfirmDialog
        isOpen={!!pendingDelete}
        title="Excluir landing page"
        description={`A landing ${pendingDelete?.title || ''} sera removida do catalogo administrativo e deixara de ficar disponivel para campanhas.`}
        confirmLabel="Excluir landing"
        tone="danger"
        loading={isSaving}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <aside className={`${sectionClassName} space-y-4 xl:sticky xl:top-24 xl:self-start`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Landing pages</p>
              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Catalogo comercial</h3>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Crie e publique paginas de campanha com slug proprio, preview e CTA para checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateLanding}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
            >
              <Plus size={14} />
              Nova
            </button>
          </div>

          <div className="space-y-3">
            {draftPages.map((page) => {
              const isSelected = selectedLanding?.id === page.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedLandingId(page.id)}
                  className={`w-full rounded-sm border px-4 py-4 text-left transition-all ${
                    isSelected
                      ? 'border-sky-700 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20'
                      : 'border-slate-300 bg-slate-50 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{page.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${
                      page.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {page.status === 'published' ? 'Publicado' : 'Draft'}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">/{page.slug}</p>
                  <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    {page.hero.title}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDuplicateLanding}
              disabled={!selectedLanding}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center px-4 py-2 text-[10px] uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Copy size={14} />
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => selectedLanding && setPendingDelete(selectedLanding)}
              disabled={!selectedLanding}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-rose-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/30 dark:bg-slate-900 dark:text-rose-300"
            >
              <Trash2 size={14} />
              Remover
            </button>
          </div>
        </aside>

        <div className="space-y-6">
          {!selectedLanding ? (
            <div className={sectionClassName}>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nenhuma landing selecionada.</p>
            </div>
          ) : (
            <>
              <section className={sectionClassName}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Controle da campanha</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">{selectedLanding.title}</h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Gerencie slug, status, plano vinculado e acessos de preview/publicacao.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <a href={previewHref} target="_blank" rel="noreferrer" className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>
                      <Eye size={14} />
                      Preview
                    </a>
                    <a href={publishedHref} target="_blank" rel="noreferrer" className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>
                      <ExternalLink size={14} />
                      Publica
                    </a>
                    <button type="button" onClick={() => void handleTogglePublish()} disabled={isSaving} className={`inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-60 ${selectedLanding.status === 'published' ? 'border-slate-700 bg-slate-700 hover:bg-slate-800' : 'border-emerald-700 bg-emerald-700 hover:bg-emerald-800'}`}>
                      {selectedLanding.status === 'published' ? <EyeOff size={14} /> : <Rocket size={14} />}
                      {selectedLanding.status === 'published' ? 'Despublicar' : 'Publicar'}
                    </button>
                    <button type="button" onClick={() => void handleSaveSelectedLanding()} disabled={isSaving} className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center px-4 py-2 text-[10px] uppercase tracking-[0.18em] disabled:opacity-60`}>
                      <Save size={14} />
                      Salvar
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5 xl:col-span-2">
                    <label className={labelClassName}>Titulo da landing</label>
                    <input value={selectedLanding.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, title: event.target.value }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>Slug</label>
                    <input value={selectedLanding.slug} onChange={(event) => patchSelectedLanding((page) => ({ ...page, slug: normalizeLandingSlug(event.target.value) }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>Plano vinculado</label>
                    <select value={selectedLanding.linkedPlanId ? String(selectedLanding.linkedPlanId) : ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, linkedPlanId: event.target.value ? Number(event.target.value) : null }))} className={inputClassName}>
                      <option value="">Sem vinculo</option>
                      {linkedPlanOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className={sectionClassName}>
                <div className="mb-6 flex items-center gap-2">
                  <LayoutTemplate size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">Hero</h4>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelClassName}>Eyebrow</label>
                    <input value={selectedLanding.hero.eyebrow} onChange={(event) => patchSelectedLanding((page) => ({ ...page, hero: { ...page.hero, eyebrow: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>Prova social</label>
                    <input value={selectedLanding.hero.proof} onChange={(event) => patchSelectedLanding((page) => ({ ...page, hero: { ...page.hero, proof: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>Titulo</label>
                    <textarea value={selectedLanding.hero.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, hero: { ...page.hero, title: event.target.value } }))} className={`${inputClassName} min-h-[110px] resize-none`} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>Descricao</label>
                    <textarea value={selectedLanding.hero.description} onChange={(event) => patchSelectedLanding((page) => ({ ...page, hero: { ...page.hero, description: event.target.value } }))} className={`${inputClassName} min-h-[120px] resize-none`} />
                  </div>
                </div>
              </section>

              <section className={sectionClassName}>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Cards de planos</p>
                    <h4 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Vitrine comercial</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => patchSelectedLanding((page) => ({ ...page, planCards: [...page.planCards, createEmptyPlanCard()] }))}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
                  >
                    <Plus size={14} />
                    Adicionar card
                  </button>
                </div>

                <div className="space-y-5">
                  {selectedLanding.planCards.map((card, index) => (
                    <div key={card.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">Card {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => patchSelectedLanding((page) => ({ ...page, planCards: page.planCards.filter((item) => item.id !== card.id) }))}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:border-rose-900/30 dark:text-rose-300"
                        >
                          <Trash2 size={12} />
                          Remover
                        </button>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Titulo</label>
                          <input
                            value={card.title}
                            onChange={(event) => patchSelectedLanding((page) => ({
                              ...page,
                              planCards: page.planCards.map((item) => (item.id === card.id ? { ...item, title: event.target.value } : item)),
                            }))}
                            className={inputClassName}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Badge</label>
                          <input
                            value={card.badge || ''}
                            onChange={(event) => patchSelectedLanding((page) => ({
                              ...page,
                              planCards: page.planCards.map((item) => (item.id === card.id ? { ...item, badge: event.target.value } : item)),
                            }))}
                            className={inputClassName}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Plano</label>
                          <select
                            value={card.planName}
                            onChange={(event) => patchSelectedLanding((page) => ({
                              ...page,
                              planCards: page.planCards.map((item) => (item.id === card.id ? { ...item, planName: event.target.value as PlanName } : item)),
                            }))}
                            className={inputClassName}
                          >
                            <option value="Essencial">Essencial</option>
                            <option value="Pro">Pro</option>
                            <option value="Elite">Elite</option>
                            <option value="Gratuito">Gratuito</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>CTA</label>
                          <input
                            value={card.ctaLabel}
                            onChange={(event) => patchSelectedLanding((page) => ({
                              ...page,
                              planCards: page.planCards.map((item) => (item.id === card.id ? { ...item, ctaLabel: event.target.value } : item)),
                            }))}
                            className={inputClassName}
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className={labelClassName}>Descricao</label>
                          <textarea
                            value={card.description}
                            onChange={(event) => patchSelectedLanding((page) => ({
                              ...page,
                              planCards: page.planCards.map((item) => (item.id === card.id ? { ...item, description: event.target.value } : item)),
                            }))}
                            className={`${inputClassName} min-h-[96px] resize-none`}
                          />
                        </div>
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className={labelClassName}>Beneficios resumidos (1 por linha)</label>
                          <textarea
                            value={listToTextareaValue(card.summaryBenefits)}
                            onChange={(event) => patchSelectedLanding((page) => ({
                              ...page,
                              planCards: page.planCards.map((item) => (item.id === card.id ? { ...item, summaryBenefits: textAreaToList(event.target.value) } : item)),
                            }))}
                            className={`${inputClassName} min-h-[120px] resize-none`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={sectionClassName}>
                <div className="mb-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Blocos de valor</p>
                  <h4 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Autoridade, matriz de valor e destaque Elite</h4>
                </div>

                <div className="grid gap-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Autoridade - eyebrow</label>
                      <input value={selectedLanding.authoritySection.eyebrow} onChange={(event) => patchSelectedLanding((page) => ({ ...page, authoritySection: { ...page.authoritySection, eyebrow: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Matriz - eyebrow</label>
                      <input value={selectedLanding.valueMatrix.eyebrow} onChange={(event) => patchSelectedLanding((page) => ({ ...page, valueMatrix: { ...page.valueMatrix, eyebrow: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>Autoridade - titulo</label>
                      <input value={selectedLanding.authoritySection.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, authoritySection: { ...page.authoritySection, title: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>Autoridade - descricao</label>
                      <textarea value={selectedLanding.authoritySection.description} onChange={(event) => patchSelectedLanding((page) => ({ ...page, authoritySection: { ...page.authoritySection, description: event.target.value } }))} className={`${inputClassName} min-h-[96px] resize-none`} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>Matriz - titulo</label>
                      <input value={selectedLanding.valueMatrix.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, valueMatrix: { ...page.valueMatrix, title: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClassName}>O que voce faz</label>
                      <textarea value={listToTextareaValue(selectedLanding.valueMatrix.whatYouDo)} onChange={(event) => patchSelectedLanding((page) => ({ ...page, valueMatrix: { ...page.valueMatrix, whatYouDo: textAreaToList(event.target.value) } }))} className={`${inputClassName} min-h-[120px] resize-none`} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClassName}>O que voce recebe</label>
                      <textarea value={listToTextareaValue(selectedLanding.valueMatrix.whatYouReceive)} onChange={(event) => patchSelectedLanding((page) => ({ ...page, valueMatrix: { ...page.valueMatrix, whatYouReceive: textAreaToList(event.target.value) } }))} className={`${inputClassName} min-h-[120px] resize-none`} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>O que voce conquista</label>
                      <textarea value={listToTextareaValue(selectedLanding.valueMatrix.whatYouConquer)} onChange={(event) => patchSelectedLanding((page) => ({ ...page, valueMatrix: { ...page.valueMatrix, whatYouConquer: textAreaToList(event.target.value) } }))} className={`${inputClassName} min-h-[120px] resize-none`} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Elite - eyebrow</label>
                      <input value={selectedLanding.eliteSection.eyebrow} onChange={(event) => patchSelectedLanding((page) => ({ ...page, eliteSection: { ...page.eliteSection, eyebrow: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Elite - CTA</label>
                      <input value={selectedLanding.eliteSection.ctaLabel} onChange={(event) => patchSelectedLanding((page) => ({ ...page, eliteSection: { ...page.eliteSection, ctaLabel: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>Elite - titulo</label>
                      <input value={selectedLanding.eliteSection.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, eliteSection: { ...page.eliteSection, title: event.target.value } }))} className={inputClassName} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>Elite - descricao</label>
                      <textarea value={selectedLanding.eliteSection.description} onChange={(event) => patchSelectedLanding((page) => ({ ...page, eliteSection: { ...page.eliteSection, description: event.target.value } }))} className={`${inputClassName} min-h-[96px] resize-none`} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className={labelClassName}>Elite - bullets (1 por linha)</label>
                      <textarea value={listToTextareaValue(selectedLanding.eliteSection.bullets)} onChange={(event) => patchSelectedLanding((page) => ({ ...page, eliteSection: { ...page.eliteSection, bullets: textAreaToList(event.target.value) } }))} className={`${inputClassName} min-h-[120px] resize-none`} />
                    </div>
                  </div>
                </div>
              </section>

              <section className={sectionClassName}>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Comparacao e prova</p>
                    <h4 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Tabela comparativa, objecoes e FAQ</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => patchSelectedLanding((page) => ({ ...page, comparisonRows: [...page.comparisonRows, createEmptyComparisonRow()] }))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
                    >
                      <Plus size={14} />
                      Linha
                    </button>
                    <button
                      type="button"
                      onClick={() => patchSelectedLanding((page) => ({ ...page, faq: [...page.faq, createEmptyFaq()] }))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
                    >
                      <Plus size={14} />
                      FAQ
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  {selectedLanding.comparisonRows.map((row) => (
                    <div key={row.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">Linha comparativa</p>
                        <button
                          type="button"
                          onClick={() => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.filter((item) => item.id !== row.id) }))}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:border-rose-900/30 dark:text-rose-300"
                        >
                          <Trash2 size={12} />
                          Remover
                        </button>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-4">
                        <div className="space-y-1.5 lg:col-span-4">
                          <label className={labelClassName}>Rotulo</label>
                          <input value={row.label} onChange={(event) => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)) }))} className={inputClassName} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Essencial</label>
                          <input value={row.values.Essencial || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.map((item) => (item.id === row.id ? { ...item, values: { ...item.values, Essencial: event.target.value } } : item)) }))} className={inputClassName} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Pro</label>
                          <input value={row.values.Pro || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.map((item) => (item.id === row.id ? { ...item, values: { ...item.values, Pro: event.target.value } } : item)) }))} className={inputClassName} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Elite</label>
                          <input value={row.values.Elite || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.map((item) => (item.id === row.id ? { ...item, values: { ...item.values, Elite: event.target.value } } : item)) }))} className={inputClassName} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClassName}>Gratuito</label>
                          <input value={row.values.Gratuito || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.map((item) => (item.id === row.id ? { ...item, values: { ...item.values, Gratuito: event.target.value } } : item)) }))} className={inputClassName} />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Objecoes (formato: titulo :: descricao)</label>
                      <textarea
                        value={selectedLanding.objections.map((item) => `${item.title} :: ${item.description}`).join('\n')}
                        onChange={(event) => patchSelectedLanding((page) => ({
                          ...page,
                          objections: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
                            const [title, ...descriptionParts] = line.split('::');
                            return {
                              title: String(title || '').trim() || 'Objecao',
                              description: descriptionParts.join('::').trim() || 'Resposta em configuracao.',
                            };
                          }),
                        }))}
                        className={`${inputClassName} min-h-[180px] resize-none`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClassName}>FAQ (formato: pergunta :: resposta)</label>
                      <textarea
                        value={selectedLanding.faq.map((item) => `${item.question} :: ${item.answer}`).join('\n')}
                        onChange={(event) => patchSelectedLanding((page) => ({
                          ...page,
                          faq: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
                            const [question, ...answerParts] = line.split('::');
                            return {
                              id: page.faq[index]?.id || createEmptyFaq().id,
                              question: String(question || '').trim() || 'Pergunta frequente',
                              answer: answerParts.join('::').trim() || 'Resposta em configuracao.',
                            };
                          }),
                        }))}
                        className={`${inputClassName} min-h-[180px] resize-none`}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className={sectionClassName}>
                <div className="mb-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Fechamento da pagina</p>
                  <h4 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Garantia, CTA final e SEO</h4>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>Garantia - titulo</label>
                    <input value={selectedLanding.guarantee.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, guarantee: { ...page.guarantee, title: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>Garantia - descricao</label>
                    <textarea value={selectedLanding.guarantee.description} onChange={(event) => patchSelectedLanding((page) => ({ ...page, guarantee: { ...page.guarantee, description: event.target.value } }))} className={`${inputClassName} min-h-[96px] resize-none`} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>CTA final - titulo</label>
                    <input value={selectedLanding.finalCta.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, finalCta: { ...page.finalCta, title: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>CTA final - descricao</label>
                    <textarea value={selectedLanding.finalCta.description} onChange={(event) => patchSelectedLanding((page) => ({ ...page, finalCta: { ...page.finalCta, description: event.target.value } }))} className={`${inputClassName} min-h-[96px] resize-none`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>CTA primario</label>
                    <input value={selectedLanding.finalCta.primaryCtaLabel} onChange={(event) => patchSelectedLanding((page) => ({ ...page, finalCta: { ...page.finalCta, primaryCtaLabel: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>CTA secundario</label>
                    <input value={selectedLanding.finalCta.secondaryCtaLabel} onChange={(event) => patchSelectedLanding((page) => ({ ...page, finalCta: { ...page.finalCta, secondaryCtaLabel: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>SEO - titulo</label>
                    <input value={selectedLanding.seo.title} onChange={(event) => patchSelectedLanding((page) => ({ ...page, seo: { ...page.seo, title: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>SEO - meta description</label>
                    <textarea value={selectedLanding.seo.metaDescription} onChange={(event) => patchSelectedLanding((page) => ({ ...page, seo: { ...page.seo, metaDescription: event.target.value } }))} className={`${inputClassName} min-h-[96px] resize-none`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>SEO - canonical</label>
                    <input value={selectedLanding.seo.canonicalUrl || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, seo: { ...page.seo, canonicalUrl: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClassName}>SEO - OG title</label>
                    <input value={selectedLanding.seo.ogTitle || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, seo: { ...page.seo, ogTitle: event.target.value } }))} className={inputClassName} />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClassName}>SEO - OG description</label>
                    <textarea value={selectedLanding.seo.ogDescription || ''} onChange={(event) => patchSelectedLanding((page) => ({ ...page, seo: { ...page.seo, ogDescription: event.target.value } }))} className={`${inputClassName} min-h-[96px] resize-none`} />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLandingPagesManager;
