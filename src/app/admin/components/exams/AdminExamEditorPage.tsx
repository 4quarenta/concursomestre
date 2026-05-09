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

import React from 'react';
import { ArrowLeft, CalendarClock, Check, FileText, Link2, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { Prova } from '@types';
import type { ExamDraftState } from './useAdminExamBankWorkflow';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';

interface AdminExamEditorPageProps {
  draft: ExamDraftState;
  setDraft: React.Dispatch<React.SetStateAction<ExamDraftState>>;
  linkedQuestionsCount: number;
  examPreview: Prova | null;
  agencyOptions?: ExamTaxonomyOption[];
  organizationOptions?: ExamTaxonomyOption[];
  isNew: boolean;
  isSaving: boolean;
  isDeleting?: boolean;
  onCreateAgency?: (payload: { name: string; sigla: string }) => Promise<ExamTaxonomyOption | null>;
  onCreateOrganization?: (payload: { name: string; sigla: string }) => Promise<ExamTaxonomyOption | null>;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface ExamTaxonomyOption {
  id?: string | number;
  name?: string;
  nome?: string;
  sigla?: string;
  slug?: string;
}

const EditorPanel = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
    <div className={ADMIN_SURFACE_HEADER_CLASS}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const MetaBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
    <div className={ADMIN_SURFACE_HEADER_CLASS}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{children}</label>
);

const TextInput = ({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}) => (
  <input
    type={type}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
  />
);

const SelectInput = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
  >
    {children}
  </select>
);

const getTaxonomyName = (item?: ExamTaxonomyOption | null) => String(item?.name || item?.nome || item?.sigla || '').trim();
const getTaxonomySigla = (item?: ExamTaxonomyOption | null) => String(item?.sigla || item?.name || item?.nome || '').trim();
const getTaxonomyLabel = (item: ExamTaxonomyOption) => {
  const sigla = getTaxonomySigla(item);
  const name = getTaxonomyName(item);
  return sigla && name && sigla !== name ? `${sigla} - ${name}` : name || sigla || String(item.id || '');
};

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const SearchableTaxonomySelect = ({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ExamTaxonomyOption[];
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedOption = React.useMemo(
    () => options.find((item) => String(item.id || '') === value) || null,
    [options, value],
  );
  const selectedLabel = selectedOption ? getTaxonomyLabel(selectedOption) : '';
  const displayValue = isOpen ? searchTerm : selectedLabel;
  const filteredOptions = React.useMemo(() => {
    const needle = normalizeSearchText(searchTerm);
    if (!needle) {
      return options.slice(0, 80);
    }

    return options
      .filter((option) => normalizeSearchText(getTaxonomyLabel(option)).includes(needle))
      .slice(0, 80);
  }, [options, searchTerm]);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setSearchTerm('');
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={displayValue}
        onFocus={() => {
          setIsOpen(true);
          setSearchTerm('');
        }}
        onChange={(event) => {
          setSearchTerm(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
          }
          if (event.key === 'Enter' && filteredOptions[0]) {
            event.preventDefault();
            handleSelect(String(filteredOptions[0].id || ''));
          }
        }}
        placeholder={placeholder}
        className={`h-10 w-full ${ADMIN_FIELD_CLASS} pl-9 pr-10`}
      />
      {value ? (
        <button
          type="button"
          onClick={clearSelection}
          className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Limpar banca"
        >
          <X size={14} />
        </button>
      ) : null}
      {isOpen ? (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-sm border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const optionId = String(option.id || '');
              const isSelected = optionId === value;

              return (
                <button
                  key={String(option.id || getTaxonomyLabel(option))}
                  type="button"
                  onClick={() => handleSelect(optionId)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0 truncate">{getTaxonomyLabel(option)}</span>
                  {isSelected ? <Check size={14} className="shrink-0 text-sky-700" /> : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Nenhuma banca encontrada.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

const findSelectedTaxonomyId = (options: ExamTaxonomyOption[], id: string, sigla: string, name: string) => {
  const normalizedId = String(id || '');
  if (normalizedId && options.some((item) => String(item.id || '') === normalizedId)) {
    return normalizedId;
  }

  const normalizedSigla = String(sigla || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  const selected = options.find((item) => {
    const itemSigla = getTaxonomySigla(item).toLowerCase();
    const itemName = getTaxonomyName(item).toLowerCase();
    return Boolean(
      (normalizedSigla && (itemSigla === normalizedSigla || itemName === normalizedSigla))
      || (normalizedName && (itemName === normalizedName || itemSigla === normalizedName)),
    );
  });

  return selected?.id ? String(selected.id) : '';
};

const AdminExamEditorPage = ({
  draft,
  setDraft,
  linkedQuestionsCount,
  examPreview,
  agencyOptions = [],
  organizationOptions = [],
  isNew,
  isSaving,
  isDeleting = false,
  onCreateAgency,
  onCreateOrganization,
  onSave,
  onDelete,
  onClose,
}: AdminExamEditorPageProps) => {
  const [creatingTaxonomy, setCreatingTaxonomy] = React.useState<'agency' | 'organization' | null>(null);

  const updateDraft = (patch: Partial<ExamDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handlePersistWithPatch = (patch: Partial<ExamDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
    requestAnimationFrame(() => {
      onSave();
    });
  };

  const publishPreview = examPreview || ({
    id: Number(draft.id || 0),
    nome: draft.nome,
    slug: '',
    ano: Number(draft.ano || 0),
    tipo: 0,
    index: draft.index,
    nivel: draft.nivel,
    publishStatus: draft.publishStatus,
    visibilityStatus: draft.visibilityStatus,
    scheduledAt: draft.scheduledAt,
    banca: { id: Number(draft.bancaId || 0), nome: draft.bancaNome, name: draft.bancaNome, sigla: draft.bancaSigla },
    orgao: { id: Number(draft.orgaoId || 0), nome: draft.orgaoNome, name: draft.orgaoNome, sigla: draft.orgaoSigla },
    cargo: { id: 0, descricao: draft.cargoDescricao, name: draft.cargoDescricao },
  } as unknown as Prova);

  const publishState = resolveAdminPublishState(publishPreview as unknown as Record<string, unknown>);
  const publishActionLabel = publishState === 'scheduled'
    ? 'Programar prova'
    : isNew
      ? 'Publicar prova'
      : 'Atualizar prova';

  const selectedAgencyId = findSelectedTaxonomyId(agencyOptions, draft.bancaId, draft.bancaSigla, draft.bancaNome);
  const selectedOrganizationId = findSelectedTaxonomyId(organizationOptions, draft.orgaoId, draft.orgaoSigla, draft.orgaoNome);

  const selectAgency = (optionId: string) => {
    const option = agencyOptions.find((item) => String(item.id || '') === optionId);
    updateDraft({
      bancaId: optionId,
      bancaSigla: option ? getTaxonomySigla(option) : '',
      bancaNome: option ? getTaxonomyName(option) : '',
    });
  };

  const selectOrganization = (optionId: string) => {
    const option = organizationOptions.find((item) => String(item.id || '') === optionId);
    updateDraft({
      orgaoId: optionId,
      orgaoSigla: option ? getTaxonomySigla(option) : '',
      orgaoNome: option ? getTaxonomyName(option) : '',
    });
  };

  const createAgency = async () => {
    if (!onCreateAgency) return;
    const name = (draft.bancaNome || draft.bancaSigla).trim();
    if (!name) return;

    setCreatingTaxonomy('agency');
    try {
      const created = await onCreateAgency({ name, sigla: draft.bancaSigla.trim() });
      if (created) {
        updateDraft({
          bancaId: String(created.id || ''),
          bancaSigla: getTaxonomySigla(created),
          bancaNome: getTaxonomyName(created),
        });
      }
    } finally {
      setCreatingTaxonomy(null);
    }
  };

  const createOrganization = async () => {
    if (!onCreateOrganization) return;
    const name = (draft.orgaoNome || draft.orgaoSigla).trim();
    if (!name) return;

    setCreatingTaxonomy('organization');
    try {
      const created = await onCreateOrganization({ name, sigla: draft.orgaoSigla.trim() });
      if (created) {
        updateDraft({
          orgaoId: String(created.id || ''),
          orgaoSigla: getTaxonomySigla(created),
          orgaoNome: getTaxonomyName(created),
        });
      }
    } finally {
      setCreatingTaxonomy(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-start">
        <main className="min-w-0 flex-1 space-y-6">
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} mt-0.5 h-9 w-9 justify-center p-0`}
                >
                  <ArrowLeft size={14} />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {isNew ? 'Adicionar nova prova' : draft.nome || 'Editar prova'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Cadastro global usado no banco de questoes, filtros editoriais e vinculos de prova.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminPublishStateBadge state={publishState} />
              </div>
            </div>
          </div>

          <EditorPanel
            title="Dados da prova"
            description="Identificacao principal, banca, orgao e cargo usados pela plataforma."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <FieldLabel>ID</FieldLabel>
                <TextInput value={draft.id} onChange={(value) => updateDraft({ id: value })} placeholder="54321" />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Nome</FieldLabel>
                <TextInput value={draft.nome} onChange={(value) => updateDraft({ nome: value })} placeholder="Nome da prova" />
              </div>
              <div>
                <FieldLabel>Ano</FieldLabel>
                <TextInput value={draft.ano} onChange={(value) => updateDraft({ ano: value })} placeholder="2025" />
              </div>
              <div>
                <FieldLabel>Nivel</FieldLabel>
                <TextInput value={draft.nivel} onChange={(value) => updateDraft({ nivel: value })} placeholder="Superior" />
              </div>
              <div>
                <FieldLabel>Indice</FieldLabel>
                <TextInput value={draft.index} onChange={(value) => updateDraft({ index: value })} placeholder="TJSP-2025-01" />
              </div>
              <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2 xl:col-span-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <FieldLabel>Banca cadastrada</FieldLabel>
                    <SearchableTaxonomySelect
                      value={selectedAgencyId}
                      onChange={selectAgency}
                      options={agencyOptions}
                      placeholder="Buscar banca da taxonomia"
                    />
                  </div>
                  <div>
                    <FieldLabel>Banca sigla</FieldLabel>
                    <TextInput
                      value={draft.bancaSigla}
                      onChange={(value) => updateDraft({ bancaId: '', bancaSigla: value })}
                      placeholder="FGV"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Banca nome</FieldLabel>
                    <TextInput
                      value={draft.bancaNome}
                      onChange={(value) => updateDraft({ bancaId: '', bancaNome: value })}
                      placeholder="Fundacao Getulio Vargas"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Use uma banca existente ou cadastre a nova banca na taxonomia global.
                  </p>
                  <button
                    type="button"
                    onClick={() => void createAgency()}
                    disabled={creatingTaxonomy === 'agency' || !(draft.bancaNome || draft.bancaSigla).trim()}
                    className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center`}
                  >
                    {creatingTaxonomy === 'agency' ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                    Adicionar banca
                  </button>
                </div>
              </div>
              <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2 xl:col-span-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <FieldLabel>Orgao cadastrado</FieldLabel>
                    <SelectInput value={selectedOrganizationId} onChange={selectOrganization}>
                      <option value="">Selecionar orgao da taxonomia</option>
                      {organizationOptions.map((organization) => (
                        <option key={String(organization.id || getTaxonomyLabel(organization))} value={String(organization.id || '')}>
                          {getTaxonomyLabel(organization)}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Orgao sigla</FieldLabel>
                    <TextInput
                      value={draft.orgaoSigla}
                      onChange={(value) => updateDraft({ orgaoId: '', orgaoSigla: value })}
                      placeholder="TJ-SP"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Orgao nome</FieldLabel>
                    <TextInput
                      value={draft.orgaoNome}
                      onChange={(value) => updateDraft({ orgaoId: '', orgaoNome: value })}
                      placeholder="Tribunal de Justica de Sao Paulo"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Orgao selecionado aqui tambem alimenta filtros e vinculos das questoes.
                  </p>
                  <button
                    type="button"
                    onClick={() => void createOrganization()}
                    disabled={creatingTaxonomy === 'organization' || !(draft.orgaoNome || draft.orgaoSigla).trim()}
                    className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center`}
                  >
                    {creatingTaxonomy === 'organization' ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                    Adicionar orgao
                  </button>
                </div>
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>Cargo</FieldLabel>
                <TextInput value={draft.cargoDescricao} onChange={(value) => updateDraft({ cargoDescricao: value })} placeholder="Analista Judiciario" />
              </div>
            </div>
          </EditorPanel>
        </main>

        <aside className="w-full space-y-5 xl:sticky xl:top-6 xl:w-[320px]">
          <MetaBox title="Publicar">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</span>
                <AdminPublishStateBadge state={publishState} />
              </div>

              <div>
                <FieldLabel>Estado editorial</FieldLabel>
                <SelectInput value={draft.publishStatus} onChange={(value) => updateDraft({ publishStatus: value as ExamDraftState['publishStatus'] })}>
                  <option value="published">Publicado</option>
                  <option value="draft">Rascunho</option>
                  <option value="scheduled">Programado</option>
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Visibilidade</FieldLabel>
                <SelectInput value={draft.visibilityStatus} onChange={(value) => updateDraft({ visibilityStatus: value as ExamDraftState['visibilityStatus'] })}>
                  <option value="public">Publico</option>
                  <option value="elite">Elite</option>
                  <option value="internal">Interno</option>
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Publicar em</FieldLabel>
                <TextInput type="datetime-local" value={draft.scheduledAt} onChange={(value) => updateDraft({ scheduledAt: value })} />
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Questoes vinculadas</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
                    <Link2 size={13} />
                    {linkedQuestionsCount}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Agendamento</span>
                  <span className="inline-flex items-center gap-1 text-right font-semibold text-slate-900 dark:text-slate-100">
                    <CalendarClock size={13} />
                    {draft.scheduledAt ? 'Definido' : 'Imediato'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handlePersistWithPatch({ publishStatus: 'draft' })}
                  disabled={isSaving || isDeleting}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center`}
                >
                  <Save size={14} />
                  Salvar rascunho
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving || isDeleting}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center`}
                >
                  <Save size={14} />
                  {isSaving ? 'Salvando...' : publishActionLabel}
                </button>
              </div>
            </div>
          </MetaBox>

          <MetaBox title="Resumo">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 text-slate-400 dark:text-slate-500" size={15} />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{draft.nome || 'Sem titulo'}</p>
                  <p className="text-slate-500 dark:text-slate-400">#{draft.id || 'novo'} {draft.ano ? `- ${draft.ano}` : ''}</p>
                </div>
              </div>
              <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                Banca: {draft.bancaSigla || draft.bancaNome || '-'}<br />
                Orgao: {draft.orgaoSigla || draft.orgaoNome || '-'}<br />
                Cargo: {draft.cargoDescricao || '-'}
              </div>
            </div>
          </MetaBox>

          {!isNew && onDelete ? (
            <MetaBox title="Excluir">
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving || isDeleting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                {isDeleting ? 'Excluindo...' : 'Excluir prova'}
              </button>
            </MetaBox>
          ) : null}
        </aside>
    </div>
  );
};

export default AdminExamEditorPage;
