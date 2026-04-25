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
import { Check, Link2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type { LandingSocialLink, SystemSettings } from '@types';
import {
  LANDING_SOCIAL_ICON_OPTIONS,
  createLandingSocialLink,
  landingSocialIconMap,
  mergeLandingPageContent,
} from '../../../landing/landingContent';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

interface AdminSocialLinksManagerProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
}

const inputClassName = `w-full ${ADMIN_FIELD_CLASS}`;
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';

/**
 * Editor oficial das redes sociais da homepage.
 * Persiste no campo landingPageContent.socialLinks para a home refletir exatamente o acervo salvo.
 *
 * @since 1.0.0
 */
const AdminSocialLinksManager = ({
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
}: AdminSocialLinksManagerProps) => {
  const { addToast } = useToast();
  const [draftLinks, setDraftLinks] = useState<LandingSocialLink[]>(() => mergeLandingPageContent(systemSettings.landingPageContent).socialLinks);
  const [pendingDelete, setPendingDelete] = useState<LandingSocialLink | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftLinks(mergeLandingPageContent(systemSettings.landingPageContent).socialLinks);
  }, [systemSettings.landingPageContent]);

  const enabledCount = useMemo(
    () => draftLinks.filter((link) => link.enabled && link.url.trim()).length,
    [draftLinks],
  );

  const persistSocialLinks = async (nextLinks: LandingSocialLink[], successMessage: string) => {
    setIsSaving(true);

    try {
      const currentLandingContent = mergeLandingPageContent(systemSettings.landingPageContent);
      const persisted = await saveSystemSettingsNow({
        ...systemSettings,
        landingPageContent: {
          ...currentLandingContent,
          socialLinks: nextLinks,
        },
      });
      updateSystemSettings(persisted);
      addToast(successMessage, 'success');
      return true;
    } catch {
      addToast('Nao foi possivel salvar as redes sociais da homepage.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const patchLink = (linkId: string, updater: (link: LandingSocialLink) => LandingSocialLink) => {
    setDraftLinks((current) => current.map((link) => (link.id === linkId ? updater(link) : link)));
  };

  const handleAddLink = () => {
    setDraftLinks((current) => [...current, createLandingSocialLink()]);
  };

  const handleDeleteLink = async () => {
    if (!pendingDelete) return;

    const nextLinks = draftLinks.filter((link) => link.id !== pendingDelete.id);
    if (await persistSocialLinks(nextLinks, 'Rede social removida com sucesso.')) {
      setDraftLinks(nextLinks);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <AdminConfirmDialog
        isOpen={!!pendingDelete}
        title="Excluir rede social"
        description={`O item ${pendingDelete?.label || ''} sera removido da homepage.`}
        confirmLabel="Excluir rede"
        tone="danger"
        loading={isSaving}
        onConfirm={() => void handleDeleteLink()}
        onCancel={() => setPendingDelete(null)}
      />

      <section className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Homepage</p>
            <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Redes sociais</h3>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
              Configure os links sociais exibidos na homepage. O que estiver ativo e com URL valida aparece na secao publica.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-sm border border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
              {enabledCount} ativos
            </span>
            <button
              type="button"
              onClick={handleAddLink}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
            >
              <Plus size={14} />
              Nova rede
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {draftLinks.map((link, index) => {
          const Icon = landingSocialIconMap[link.iconKey];

          return (
            <section
              key={link.id}
              className={ADMIN_PAGE_PANEL_CLASS}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-sky-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-sky-300">
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Rede {index + 1}
                    </p>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                      {link.label || 'Nova rede social'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => patchLink(link.id, (current) => ({ ...current, enabled: !current.enabled }))}
                    className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                      link.enabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {link.enabled ? <Check size={12} /> : <Link2 size={12} />}
                    {link.enabled ? 'Ativa' : 'Inativa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(link)}
                    className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 dark:border-rose-900/30 dark:bg-slate-900 dark:text-rose-300"
                  >
                    <Trash2 size={12} />
                    Remover
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className={labelClassName}>Nome exibido</label>
                  <input
                    value={link.label}
                    onChange={(event) => patchLink(link.id, (current) => ({ ...current, label: event.target.value }))}
                    className={inputClassName}
                    placeholder="Instagram"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClassName}>Handle</label>
                  <input
                    value={link.handle}
                    onChange={(event) => patchLink(link.id, (current) => ({ ...current, handle: event.target.value }))}
                    className={inputClassName}
                    placeholder="@concursomestre"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClassName}>Icone</label>
                  <select
                    value={link.iconKey}
                    onChange={(event) => patchLink(link.id, (current) => ({ ...current, iconKey: event.target.value as LandingSocialLink['iconKey'] }))}
                    className={inputClassName}
                  >
                    {LANDING_SOCIAL_ICON_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 xl:col-span-1">
                  <label className={labelClassName}>Status</label>
                  <div className={`flex h-[36px] items-center px-3 text-sm font-medium text-slate-600 dark:text-slate-200 ${ADMIN_MUTED_SURFACE_CLASS}`}>
                    {link.enabled ? 'Exibida na home' : 'Oculta na home'}
                  </div>
                </div>

                <div className="space-y-1.5 lg:col-span-2 xl:col-span-4">
                  <label className={labelClassName}>URL</label>
                  <input
                    value={link.url}
                    onChange={(event) => patchLink(link.id, (current) => ({ ...current, url: event.target.value }))}
                    className={inputClassName}
                    placeholder="https://instagram.com/concursomestre"
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void persistSocialLinks(draftLinks, 'Redes sociais salvas com sucesso.')}
          disabled={isSaving}
          className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-6 py-2 text-[10px] uppercase tracking-[0.18em] disabled:cursor-not-allowed`}
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar redes sociais
        </button>
      </div>
    </div>
  );
};

export default AdminSocialLinksManager;
