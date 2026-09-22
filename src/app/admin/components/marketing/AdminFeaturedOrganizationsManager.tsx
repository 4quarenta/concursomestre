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
import { Building2, ChevronLeft, ChevronRight, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { filtersService, type AdminFilterListItem } from '@services/filters';
import type {
  LandingFeaturedOrganization,
  LandingFeaturedOrganizationIconKey,
  LandingFeaturedOrganizationStatus,
  SystemSettings,
} from '@types';
import {
  LANDING_FEATURED_ORGANIZATION_ICON_OPTIONS,
  LANDING_FEATURED_ORGANIZATION_STATUS_OPTIONS,
  landingFeaturedOrganizationIconMap,
  mergeLandingPageContent,
} from '../../../landing/landingContent';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

interface AdminFeaturedOrganizationsManagerProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
}

const inputClassName = `w-full ${ADMIN_FIELD_CLASS}`;
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';
const normalizeOrganizationSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const createDraftOrganization = (filterId: number): LandingFeaturedOrganization => ({
  id: `orgao-draft-${filterId}-${Date.now()}`,
  filterId,
  status: 'FEATURED',
  iconKey: 'building',
  enabled: true,
  order: 999,
});

/**
 * Editor editorial da vitrine de orgaos. O painel salva apenas IDs e
 * preferencias editoriais; nome, slug e exposicao continuam sob autoridade do diretorio publico.
 */
const AdminFeaturedOrganizationsManager = ({
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
}: AdminFeaturedOrganizationsManagerProps) => {
  const { addToast } = useToast();
  const [organizations, setOrganizations] = useState<AdminFilterListItem[]>([]);
  const [draftItems, setDraftItems] = useState<LandingFeaturedOrganization[]>(() => (
    mergeLandingPageContent(systemSettings.landingPageContent).featuredOrganizations
  ));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [organizationPage, setOrganizationPage] = useState(1);
  const [organizationPages, setOrganizationPages] = useState(1);

  useEffect(() => {
    let active = true;
    const timerId = window.setTimeout(() => {
      setIsLoading(true);
      void filtersService.listAdminPage({ page: organizationPage, perPage: 20, type: 'orgao', search: normalizeOrganizationSearch(organizationSearch) })
      .then((page) => {
        if (active) {
          setOrganizations(page.rows.filter((item) => item.type === 'orgao'));
          setOrganizationPages(Math.max(1, page.pages));
        }
      })
      .catch(() => {
        if (active) addToast('Nao foi possivel carregar os orgaos para configuracao.', 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    }, 250);

    return () => { active = false; window.clearTimeout(timerId); };
  }, [addToast, organizationPage, organizationSearch]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraftItems(mergeLandingPageContent(systemSettings.landingPageContent).featuredOrganizations);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [systemSettings.landingPageContent]);

  const selectedIds = useMemo(() => new Set(draftItems.map((item) => item.filterId)), [draftItems]);
  const enabledCount = draftItems.filter((item) => item.enabled).length;

  const patchItem = (id: string, patch: Partial<LandingFeaturedOrganization>) => {
    setDraftItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    const available = organizations.find((organization) => !selectedIds.has(Number(organization.id)));
    if (!available) {
      addToast('Todos os orgaos disponiveis ja estao selecionados.', 'info');
      return;
    }
    setDraftItems((current) => [...current, createDraftOrganization(Number(available.id))].slice(0, 6));
  };

  const save = async () => {
    const ids = draftItems.map((item) => item.filterId).filter((id) => id > 0);
    if (ids.length !== draftItems.length || new Set(ids).size !== ids.length) {
      addToast('Selecione órgãos canônicos sem repetir identificadores.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const current = mergeLandingPageContent(systemSettings.landingPageContent);
      const persisted = await saveSystemSettingsNow({
        ...systemSettings,
        landingPageContent: { ...current, featuredOrganizations: draftItems },
      });
      updateSystemSettings(persisted);
      addToast('Orgaos em destaque salvos com sucesso.', 'success');
    } catch {
      addToast('Nao foi possivel salvar os orgaos em destaque.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className={labelClassName}>Homepage</p>
            <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Orgaos em destaque</h3>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
              Selecione ate seis orgaos publicos. O nome, a sigla e o slug exibidos na Home vem do diretorio canonico.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-sm border border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
              {enabledCount} ativos
            </span>
            <button type="button" onClick={addItem} disabled={isLoading || organizations.length === 0 || draftItems.length >= 6} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>
              <Plus size={14} />
              Adicionar orgao
            </button>
          </div>
        </div>
        <div className={`mt-5 flex items-start gap-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
          <Building2 size={18} className="mt-0.5 shrink-0 text-sky-700 dark:text-sky-300" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            O logo oficial é resolvido pela taxonomia de órgão selecionada; esta configuração editorial não aceita slug livre nem hotlink.
          </p>
        </div>
      </section>

      <section className={ADMIN_PAGE_PANEL_CLASS}>
        <label className={labelClassName} htmlFor="featured-orgao-search">Buscar no diretório canônico</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="featured-orgao-search" value={organizationSearch} onChange={(event) => { setOrganizationSearch(event.target.value); setOrganizationPage(1); }} className={`${inputClassName} pl-9`} placeholder="Nome ou sigla, com ou sem acento" />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
            <button type="button" aria-label="Página anterior de órgãos" title="Página anterior" disabled={organizationPage <= 1 || isLoading} onClick={() => setOrganizationPage((page) => Math.max(1, page - 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronLeft size={15} /></button>
            <span>Página {organizationPage} de {organizationPages}</span>
            <button type="button" aria-label="Próxima página de órgãos" title="Próxima página" disabled={organizationPage >= organizationPages || isLoading} onClick={() => setOrganizationPage((page) => Math.min(organizationPages, page + 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronRight size={15} /></button>
          </div>
        </div>
        {!isLoading && organizations.length === 0 ? <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">Nenhum órgão aprovado foi encontrado no diretório atual. Não há dados suficientes para fabricar uma seleção.</p> : null}
      </section>

      {draftItems.map((item, index) => {
        const Icon = landingFeaturedOrganizationIconMap[item.iconKey];
        return (
          <section key={item.id} className={ADMIN_PAGE_PANEL_CLASS}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-sky-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-sky-300">
                  <Icon size={18} />
                </div>
                <div>
                  <p className={labelClassName}>Orgao {index + 1}</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                    {organizations.find((organization) => Number(organization.id) === item.filterId)?.name || 'Selecione um orgao'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setDraftItems((current) => current.filter((candidate) => candidate.id !== item.id))} className={`${ADMIN_SECONDARY_BUTTON_CLASS} text-rose-700 dark:text-rose-300`} title="Remover orgao">
                <Trash2 size={14} />
                Remover
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelClassName}>Orgao canonico</label>
                <select value={item.filterId || ''} onChange={(event) => patchItem(item.id, { filterId: Number(event.target.value) })} className={inputClassName}>
                  <option value="" disabled>Selecione...</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id} disabled={selectedIds.has(Number(organization.id)) && Number(organization.id) !== item.filterId}>
                      {organization.name}{organization.sigla ? ` (${organization.sigla})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClassName}>Status editorial</label>
                <select value={item.status} onChange={(event) => patchItem(item.id, { status: event.target.value as LandingFeaturedOrganizationStatus })} className={inputClassName}>
                  {LANDING_FEATURED_ORGANIZATION_STATUS_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClassName}>Icone</label>
                <select value={item.iconKey} onChange={(event) => patchItem(item.id, { iconKey: event.target.value as LandingFeaturedOrganizationIconKey })} className={inputClassName}>
                  {LANDING_FEATURED_ORGANIZATION_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClassName}>Ordem</label>
                <input type="number" min={0} max={9999} value={item.order} onChange={(event) => patchItem(item.id, { order: Number(event.target.value) || 0 })} className={inputClassName} />
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={item.enabled} onChange={(event) => patchItem(item.id, { enabled: event.target.checked })} />
                Exibir na Home
              </label>
            </div>
          </section>
        );
      })}

      {!isLoading && draftItems.length === 0 ? (
        <div className={`p-5 text-sm font-medium text-slate-600 dark:text-slate-300 ${ADMIN_MUTED_SURFACE_CLASS}`}>
          Nenhum órgão foi selecionado para a vitrine. A home permanecerá sem esta seção até que exista um órgão canônico aprovado.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={isLoading || isSaving} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-6 py-2 text-[10px] uppercase tracking-[0.18em]`}>
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar orgaos
        </button>
      </div>
    </div>
  );
};

export default AdminFeaturedOrganizationsManager;
