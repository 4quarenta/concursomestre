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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  LayoutTemplate,
  Plus,
  Rocket,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type {
  MarketingLandingComparisonRow,
  MarketingLandingFaqItem,
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
import { buildAdminLandingPageEditPath } from '../../config/adminPageNavigationConfig';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

interface AdminLandingPagesManagerProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
  initialScreen?: 'list' | 'editor';
  initialLandingId?: string;
  editorOnly?: boolean;
  onReturnToList?: () => void;
  onSavedLanding?: (landingPage: MarketingLandingPage) => void;
}

const inputClassName = 'w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-sky-700 focus:ring-1 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';
const sectionClassName = ADMIN_PAGE_PANEL_CLASS;
type LandingAdminScreen = 'list' | 'editor';
type LandingStatusFilter = 'all' | 'published' | 'draft';
type LandingBulkAction = '' | 'publish' | 'draft' | 'delete';

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

const createEmptyComparisonRow = (): MarketingLandingComparisonRow => ({
  id: `comparison-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: 'Novo diferencial',
  values: { Essencial: '', Pro: '', Elite: '' },
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
  initialScreen = 'list',
  initialLandingId = '',
  editorOnly = false,
  onReturnToList,
  onSavedLanding,
}) => {
  const router = useRouter();
  const { addToast } = useToast();
  const siteName = systemSettings.siteName || 'ConcursoMestre';
  const normalizedInitialLandingId = String(initialLandingId || '').trim();
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [draftPages, setDraftPages] = useState<MarketingLandingPage[]>(() => mergeMarketingLandingPages(systemSettings.landingPages, siteName));
  const [selectedLandingId, setSelectedLandingId] = useState(normalizedInitialLandingId !== 'new' ? normalizedInitialLandingId : '');
  const [screen, setScreen] = useState<LandingAdminScreen>(initialScreen);
  const [landingSearch, setLandingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LandingStatusFilter>('all');
  const [selectedLandingIds, setSelectedLandingIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<LandingBulkAction>('');
  const [pendingDelete, setPendingDelete] = useState<MarketingLandingPage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const createdLandingIdRef = React.useRef('');
  const hasLoadedPlansRef = React.useRef(false);

  useEffect(() => {
    if (!editorOnly && screen !== 'editor') {
      return;
    }
    if (hasLoadedPlansRef.current) {
      return;
    }

    hasLoadedPlansRef.current = true;
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
  }, [editorOnly, screen]);

  useEffect(() => {
    const mergedPages = mergeMarketingLandingPages(systemSettings.landingPages, siteName);
    const timeout = window.setTimeout(() => {
      let nextPages = mergedPages;
      let preferredLandingId = '';

      if (initialScreen === 'editor') {
        if (normalizedInitialLandingId === 'new') {
          const existingDraft = createdLandingIdRef.current
            ? mergedPages.find((page) => page.id === createdLandingIdRef.current)
            : null;

          if (existingDraft) {
            preferredLandingId = existingDraft.id;
          } else {
            const nextLanding = createNewLandingDraft(siteName, mergedPages);
            createdLandingIdRef.current = nextLanding.id;
            nextPages = [...mergedPages, nextLanding];
            preferredLandingId = nextLanding.id;
          }
        } else if (normalizedInitialLandingId) {
          preferredLandingId = normalizedInitialLandingId;
        }
      }

      setDraftPages(nextPages);
      setScreen(initialScreen);
      setSelectedLandingId((currentId) => {
        if (preferredLandingId) {
          return nextPages.some((page) => page.id === preferredLandingId) ? preferredLandingId : '';
        }

        return nextPages.some((page) => page.id === currentId) ? currentId : (nextPages[0]?.id || '');
      });
      setSelectedLandingIds(new Set());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialScreen, normalizedInitialLandingId, siteName, systemSettings.landingPages]);

  const selectedLanding = useMemo(
    () => draftPages.find((page) => page.id === selectedLandingId) || (editorOnly ? null : draftPages[0] || null),
    [draftPages, editorOnly, selectedLandingId],
  );

  const linkedPlanOptions = useMemo(() => availablePlans.map((plan) => ({
    value: String(plan.id),
    label: `${plan.name} (#${plan.id})`,
  })), [availablePlans]);

  const landingCounts = useMemo(() => ({
    all: draftPages.length,
    published: draftPages.filter((page) => page.status === 'published').length,
    draft: draftPages.filter((page) => page.status !== 'published').length,
  }), [draftPages]);

  const filteredLandingPages = useMemo(() => {
    const needle = landingSearch.trim().toLowerCase();

    return draftPages.filter((page) => {
      if (statusFilter !== 'all' && page.status !== statusFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        page.title,
        page.slug,
        page.hero?.title,
        page.seo?.title,
        page.status,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [draftPages, landingSearch, statusFilter]);

  const allFilteredSelected = filteredLandingPages.length > 0
    && filteredLandingPages.every((page) => selectedLandingIds.has(page.id));

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

  const returnToLandingList = () => {
    if (onReturnToList) {
      onReturnToList();
      return;
    }

    setScreen('list');
    setSelectedLandingIds(new Set());
  };

  const toggleSelectedLanding = (landingId: string) => {
    setSelectedLandingIds((current) => {
      const next = new Set(current);
      if (next.has(landingId)) {
        next.delete(landingId);
      } else {
        next.add(landingId);
      }
      return next;
    });
  };

  const toggleAllFilteredLandings = () => {
    setSelectedLandingIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredLandingPages.forEach((page) => next.delete(page.id));
      } else {
        filteredLandingPages.forEach((page) => next.add(page.id));
      }
      return next;
    });
  };

  const patchSelectedLanding = (updater: (landingPage: MarketingLandingPage) => MarketingLandingPage) => {
    if (!selectedLanding) {
      return;
    }

    setDraftPages((currentPages) => updateLandingInCollection(currentPages, selectedLanding.id, updater));
  };

  const handleCreateLanding = () => {
    if (!editorOnly) {
      router.push(buildAdminLandingPageEditPath('new'));
      return;
    }

    const nextLanding = createNewLandingDraft(siteName, draftPages);
    createdLandingIdRef.current = nextLanding.id;
    setDraftPages((currentPages) => [...currentPages, nextLanding]);
    setSelectedLandingId(nextLanding.id);
    setScreen('editor');
  };

  const handleDuplicateLanding = async (landingPage = selectedLanding) => {
    if (!landingPage) {
      return;
    }

    const duplicated = duplicateMarketingLandingPage(landingPage);
    const nextLanding = {
      ...duplicated,
      slug: buildUniqueSlug(draftPages, duplicated.slug),
    };

    const nextPages = [...draftPages, nextLanding];
    if (await persistLandingPages(nextPages, 'Landing duplicada com sucesso.')) {
      setDraftPages(nextPages);
      router.push(buildAdminLandingPageEditPath(nextLanding.id));
    }
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
      const savedLanding = nextPages.find((page) => page.id === selectedLanding.id);
      if (savedLanding) {
        onSavedLanding?.(savedLanding);
      }
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
      const savedLanding = nextPages.find((page) => page.id === selectedLanding.id);
      if (savedLanding) {
        onSavedLanding?.(savedLanding);
      }
    }
  };

  const handleToggleLandingStatus = async (landingPage: MarketingLandingPage) => {
    const nextPages: MarketingLandingPage[] = draftPages.map((page) => (page.id === landingPage.id ? {
      ...page,
      status: page.status === 'published' ? 'draft' as const : 'published' as const,
      updatedAt: new Date().toISOString(),
    } : page));

    if (await persistLandingPages(nextPages, landingPage.status === 'published' ? 'Landing despublicada.' : 'Landing publicada com sucesso.')) {
      setDraftPages(nextPages);
    }
  };

  const handleApplyBulkAction = async () => {
    const selectedIds = Array.from(selectedLandingIds);
    if (!bulkAction || selectedIds.length === 0) {
      addToast('Selecione uma acao em massa e ao menos uma landing.', 'error');
      return;
    }

    if (bulkAction === 'delete') {
      const nextPages = draftPages.filter((page) => !selectedLandingIds.has(page.id));
      if (await persistLandingPages(nextPages, 'Landing pages removidas com sucesso.')) {
        setDraftPages(nextPages);
        setSelectedLandingIds(new Set());
        setBulkAction('');
      }
      return;
    }

    const nextStatus = bulkAction === 'publish' ? 'published' as const : 'draft' as const;
    const nextPages = draftPages.map((page) => (selectedLandingIds.has(page.id) ? {
      ...page,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    } : page));

    if (await persistLandingPages(nextPages, bulkAction === 'publish' ? 'Landing pages publicadas.' : 'Landing pages movidas para rascunho.')) {
      setDraftPages(nextPages);
      setSelectedLandingIds(new Set());
      setBulkAction('');
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
      setSelectedLandingIds(new Set());
      setScreen('list');
      setPendingDelete(null);
      if (editorOnly) {
        onReturnToList?.();
      }
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

      {screen === 'list' ? (
        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
          <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  <FileText size={18} className="text-sky-700 dark:text-sky-300" />
                  Landing pages
                </h3>
                <Link
                  href={buildAdminLandingPageEditPath('new')}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]`}
                >
                  <Plus size={13} />
                  Adicionar nova
                </Link>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Gerencie paginas comerciais publicadas, rascunhos, slugs e campanhas no mesmo padrao operacional do WordPress.
              </p>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={landingSearch}
                onChange={(event) => setLandingSearch(event.target.value)}
                className={`${ADMIN_FIELD_CLASS} w-full pl-9`}
                placeholder="Buscar landing..."
              />
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {[
                { key: 'all' as const, label: 'Todas', count: landingCounts.all },
                { key: 'published' as const, label: 'Publicadas', count: landingCounts.published },
                { key: 'draft' as const, label: 'Rascunhos', count: landingCounts.draft },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatusFilter(item.key)}
                  className={statusFilter === item.key
                    ? 'text-sky-700 underline underline-offset-4 dark:text-sky-300'
                    : 'text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300'
                  }
                >
                  {item.label} <span className="text-slate-400">({item.count})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as LandingBulkAction)}
                className={`${ADMIN_FIELD_CLASS} min-w-[180px]`}
              >
                <option value="">Acoes em massa</option>
                <option value="publish">Publicar</option>
                <option value="draft">Mover para rascunho</option>
                <option value="delete">Excluir</option>
              </select>
              <button
                type="button"
                onClick={() => void handleApplyBulkAction()}
                disabled={isSaving || selectedLandingIds.size === 0}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Aplicar
              </button>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {filteredLandingPages.length} item(ns)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                <tr className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFilteredLandings}
                      className="h-4 w-4 rounded-sm border-slate-300 text-sky-700"
                    />
                  </th>
                  <th className="px-4 py-3">Titulo</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Atualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredLandingPages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                      Nenhuma landing encontrada.
                    </td>
                  </tr>
                ) : filteredLandingPages.map((page) => {
                  const landingPath = buildMarketingLandingPath(page.slug);
                  const previewPath = `${landingPath}?preview=${page.id}`;
                  const linkedPlan = availablePlans.find((plan) => Number(plan.id) === Number(page.linkedPlanId));
                  const updatedAt = new Date(page.updatedAt || page.createdAt);

                  return (
                    <tr key={page.id} className="group bg-white align-top transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-950/60">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedLandingIds.has(page.id)}
                          onChange={() => toggleSelectedLanding(page.id)}
                          className="h-4 w-4 rounded-sm border-slate-300 text-sky-700"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={buildAdminLandingPageEditPath(page.id)}
                          className="text-left text-sm font-bold text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          {page.title}
                        </Link>
                        <p className="mt-1 line-clamp-2 max-w-xl text-xs font-medium text-slate-500 dark:text-slate-400">
                          {page.hero.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <Link href={buildAdminLandingPageEditPath(page.id)} className="text-sky-700 hover:underline dark:text-sky-300">
                            Editar
                          </Link>
                          <span className="text-slate-300">|</span>
                          <button type="button" onClick={() => void handleToggleLandingStatus(page)} className="text-sky-700 hover:underline dark:text-sky-300">
                            {page.status === 'published' ? 'Despublicar' : 'Publicar'}
                          </button>
                          <span className="text-slate-300">|</span>
                          <button type="button" onClick={() => void handleDuplicateLanding(page)} className="text-sky-700 hover:underline dark:text-sky-300">
                            Duplicar
                          </button>
                          <span className="text-slate-300">|</span>
                          <a href={previewPath} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-300">
                            Preview
                          </a>
                          <span className="text-slate-300">|</span>
                          <a href={landingPath} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-300">
                            Ver
                          </a>
                          <span className="text-slate-300">|</span>
                          <button type="button" onClick={() => setPendingDelete(page)} className="text-rose-600 hover:underline dark:text-rose-300">
                            Excluir
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">/{page.slug}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          page.status === 'published'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {page.status === 'published' ? 'Publicado' : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {linkedPlan ? `${linkedPlan.name} (#${linkedPlan.id})` : 'Sem vinculo'}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {Number.isNaN(updatedAt.getTime()) ? '-' : updatedAt.toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className={editorOnly ? 'space-y-6' : 'grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]'}>
        {!editorOnly ? (
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
                    <span className={`rounded-sm px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${
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
              onClick={() => void handleDuplicateLanding()}
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
        ) : null}

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

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <button type="button" onClick={returnToLandingList} className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>
                      <ArrowLeft size={14} />
                      Lista
                    </button>
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
                    className="inline-flex items-center gap-2 rounded-sm border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
                  >
                    <Plus size={14} />
                    Adicionar card
                  </button>
                </div>

                <div className="space-y-5">
                  {selectedLanding.planCards.map((card, index) => (
                    <div key={card.id} className="rounded-sm border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">Card {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => patchSelectedLanding((page) => ({ ...page, planCards: page.planCards.filter((item) => item.id !== card.id) }))}
                          className="inline-flex items-center gap-2 rounded-sm border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:border-rose-900/30 dark:text-rose-300"
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
                      className="inline-flex items-center gap-2 rounded-sm border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
                    >
                      <Plus size={14} />
                      Linha
                    </button>
                    <button
                      type="button"
                      onClick={() => patchSelectedLanding((page) => ({ ...page, faq: [...page.faq, createEmptyFaq()] }))}
                      className="inline-flex items-center gap-2 rounded-sm border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
                    >
                      <Plus size={14} />
                      FAQ
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  {selectedLanding.comparisonRows.map((row) => (
                    <div key={row.id} className="rounded-sm border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">Linha comparativa</p>
                        <button
                          type="button"
                          onClick={() => patchSelectedLanding((page) => ({ ...page, comparisonRows: page.comparisonRows.filter((item) => item.id !== row.id) }))}
                          className="inline-flex items-center gap-2 rounded-sm border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:border-rose-900/30 dark:text-rose-300"
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
      )}
    </div>
  );
};

export default AdminLandingPagesManager;
