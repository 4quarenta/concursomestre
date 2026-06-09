'use client';

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
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import type { Prova, Question, SystemSettings } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { useConfirm } from '@providers/ModalProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import { filtersService } from '@services/filters';
import { clientLog } from '@services/monitoring/clientLog';
import { questionService } from '@services/questions';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { useSystemSettingsActions } from '@/state/app-config/useSystemSettingsActions';
import { useQuestionBankStore } from '@/state/question-bank/questionBankStore';
import AdminExamEditorPage from '../../../../components/exams/AdminExamEditorPage';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { createDraftFromProva, createEmptyExamDraft, type ExamDraftState } from '../../../../components/exams/useAdminExamBankWorkflow';
import {
  applyProvaToQuestion,
  formatProvaLabel,
  isQuestionLinkedToProva,
  mergeExamBankSources,
  normalizeProvaRecord,
  removeProvaFromQuestion,
} from '../../../../components/exams/examBankUtils';
import { buildAdminExamEditPath, buildAdminPath } from '../../../../config/adminPageNavigationConfig';
import { ADMIN_PRIMARY_BUTTON_CLASS, ADMIN_SECONDARY_BUTTON_CLASS, ADMIN_SURFACE_CLASS } from '../../../../components/shared/adminPanelStyles';

const resolveExamId = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const normalizeTaxonomyText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const slugifyTaxonomy = (value: string) => normalizeTaxonomyText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

type ExamTaxonomyItem = {
  id?: string | number;
  name?: string;
  nome?: string;
  sigla?: string;
};

const readTaxonomyName = (item: ExamTaxonomyItem | null | undefined) => String(item?.name || item?.nome || item?.sigla || '').trim();
const readTaxonomySigla = (item: ExamTaxonomyItem | null | undefined) => String(item?.sigla || item?.name || item?.nome || '').trim();

const findMatchingExamTaxonomy = (items: ExamTaxonomyItem[] = [], name: string, sigla: string, id?: string) => {
  const normalizedId = String(id || '');
  if (normalizedId) {
    const byId = items.find((item) => String(item?.id || '') === normalizedId);
    if (byId) return byId;
  }

  const normalizedName = normalizeTaxonomyText(name);
  const normalizedSigla = normalizeTaxonomyText(sigla);
  return items.find((item) => {
    const itemName = normalizeTaxonomyText(readTaxonomyName(item));
    const itemSigla = normalizeTaxonomyText(readTaxonomySigla(item));
    return Boolean(
      (normalizedName && (itemName === normalizedName || itemSigla === normalizedName))
      || (normalizedSigla && (itemSigla === normalizedSigla || itemName === normalizedSigla)),
    );
  });
};

const findExamInQuestionsById = (questions: Question[], examId: string): Prova | null => {
  if (!examId || examId === 'new') {
    return null;
  }

  for (const question of questions) {
    const found = (question.provas || []).find((prova) => String(prova?.id ?? '') === String(examId));
    if (found) {
      return normalizeProvaRecord(found);
    }
  }

  return null;
};

const AdminExamEditPage = () => {
  const params = useParams<{ examId?: string | string[] }>();
  const router = useRouter();
  const examId = resolveExamId(params.examId) || 'new';
  const isNew = String(examId) === 'new';

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const confirm = useConfirm();
  const { addToast } = useToast();
  const questions = useQuestionBankStore((store) => store.questions);
  const upsertQuestion = useQuestionBankStore((store) => store.upsertQuestion);
  const { systemSettings, isSystemSettingsLoaded, updateSystemSettings, saveSystemSettingsNow } = useSystemSettingsActions();
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();

  const [draft, setDraft] = React.useState<ExamDraftState | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const originalExamIdRef = React.useRef<string | null>(null);
  const draftHydrationKeyRef = React.useRef('');
  const draftStateRef = React.useRef<ExamDraftState | null>(null);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    void ensureTaxonomiesLoaded();
  }, [ensureTaxonomiesLoaded]);

  React.useEffect(() => {
    draftStateRef.current = draft;
  }, [draft]);

  const examBank = React.useMemo(
    () => mergeExamBankSources(systemSettings, []),
    [systemSettings],
  );

  const existingExam = React.useMemo(
    () => examBank.find((item) => String(item.id) === String(examId))
      || findExamInQuestionsById(questions, String(examId))
      || null,
    [examBank, examId, questions],
  );

  React.useEffect(() => {
    if (!isSystemSettingsLoaded) {
      return;
    }

    if (isNew) {
      if (draftHydrationKeyRef.current === 'new' && draftStateRef.current) {
        return;
      }
      originalExamIdRef.current = null;
      draftHydrationKeyRef.current = 'new';
      setDraft(createEmptyExamDraft());
      return;
    }

    if (!existingExam) {
      if (draftHydrationKeyRef.current === 'not-found' && draftStateRef.current === null) {
        return;
      }
      draftHydrationKeyRef.current = 'not-found';
      setDraft(null);
      return;
    }

    const nextHydrationKey = String(existingExam.id || '');
    if (
      draftHydrationKeyRef.current === nextHydrationKey
      && draftStateRef.current
      && String(draftStateRef.current.id || '') === nextHydrationKey
    ) {
      return;
    }

    originalExamIdRef.current = String(existingExam.id);
    draftHydrationKeyRef.current = nextHydrationKey;
    setDraft(createDraftFromProva(existingExam));
  }, [existingExam, isNew, isSystemSettingsLoaded]);

  const closeEditor = React.useCallback(() => {
    router.push(buildAdminPath('operation', 'exams'));
  }, [router]);

  const syncLinkedQuestions = React.useCallback(async (prova: Prova | null, previousId: string, mode: 'save' | 'delete') => {
    const linkedQuestions = questions.filter((question) => isQuestionLinkedToProva(question, previousId));
    const failures: Array<string | number> = [];

    for (const question of linkedQuestions) {
      const nextQuestion = mode === 'delete'
        ? removeProvaFromQuestion(question, previousId)
        : applyProvaToQuestion(question, prova as Prova);

      const result = await questionService.updateQuestion(String(nextQuestion.id), nextQuestion as Question);
      if (!result?.success) {
        failures.push(question.id || previousId);
        continue;
      }
      upsertQuestion(nextQuestion as Question);
    }

    return {
      linkedCount: linkedQuestions.length,
      failures,
    };
  }, [questions, upsertQuestion]);

  const ensureExamTaxonomy = React.useCallback(async (
    type: 'banca' | 'orgao',
    name: string,
    sigla: string,
    currentId = '',
  ) => {
    const trimmedName = String(name || sigla || '').trim();
    const trimmedSigla = String(sigla || '').trim();
    if (!trimmedName && !trimmedSigla) {
      return null;
    }

    const currentList = type === 'banca'
      ? (systemSettings.taxonomies?.agencies || [])
      : (systemSettings.taxonomies?.organizations || []);
    const existing = findMatchingExamTaxonomy(currentList as ExamTaxonomyItem[], trimmedName, trimmedSigla, currentId);
    if (existing) {
      return existing;
    }

    const createdId = await filtersService.save({
      type,
      name: trimmedName || trimmedSigla,
      sigla: trimmedSigla || undefined,
      slug: slugifyTaxonomy(trimmedName || trimmedSigla),
      metadata: trimmedSigla ? { sigla: trimmedSigla } : undefined,
    });

    const taxonomies = await filtersService.listTaxonomies();
    void ensureTaxonomiesLoaded(true);
    const nextList = type === 'banca' ? taxonomies.agencies : taxonomies.organizations;
    return findMatchingExamTaxonomy(nextList as ExamTaxonomyItem[], trimmedName, trimmedSigla, String(createdId))
      || {
        id: createdId || trimmedName || trimmedSigla,
        name: trimmedName || trimmedSigla,
        nome: trimmedName || trimmedSigla,
        sigla: trimmedSigla || trimmedName,
      };
  }, [ensureTaxonomiesLoaded, systemSettings.taxonomies?.agencies, systemSettings.taxonomies?.organizations]);

  const createAgencyFromEditor = React.useCallback(async (payload: { name: string; sigla: string }) => {
    try {
      const agency = await ensureExamTaxonomy('banca', payload.name, payload.sigla);
      addToast('Banca vinculada a taxonomia.', 'success');
      return agency;
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Nao foi possivel cadastrar a banca.', 'error');
      return null;
    }
  }, [addToast, ensureExamTaxonomy]);

  const createOrganizationFromEditor = React.useCallback(async (payload: { name: string; sigla: string }) => {
    try {
      const organization = await ensureExamTaxonomy('orgao', payload.name, payload.sigla);
      addToast('Orgao vinculado a taxonomia.', 'success');
      return organization;
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o orgao.', 'error');
      return null;
    }
  }, [addToast, ensureExamTaxonomy]);

  const uploadExamFileFromEditor = React.useCallback(async (
    file: File,
    kind: Parameters<typeof questionService.uploadExamFile>[1],
  ) => {
    try {
      const uploaded = await questionService.uploadExamFile(file, kind);
      addToast('Arquivo anexado a prova.', 'success');
      return uploaded;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel anexar o arquivo.';
      addToast(message, 'error');
      throw error;
    }
  }, [addToast]);

  const persistExam = React.useCallback(async () => {
    if (!draft) {
      return;
    }

    let resolvedAgency: ExamTaxonomyItem | null = null;
    let resolvedOrganization: ExamTaxonomyItem | null = null;
    try {
      resolvedAgency = await ensureExamTaxonomy('banca', draft.bancaNome, draft.bancaSigla, draft.bancaId);
      resolvedOrganization = await ensureExamTaxonomy('orgao', draft.orgaoNome, draft.orgaoSigla, draft.orgaoId);
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Nao foi possivel sincronizar banca/orgao com as taxonomias.', 'error');
      return;
    }

    const normalized = normalizeProvaRecord({
      id: draft.id,
      nome: draft.nome,
      ano: draft.ano,
      nivel: draft.nivel,
      index: draft.index,
      caderno: draft.caderno,
      tipoCaderno: draft.tipoCaderno,
      corCaderno: draft.corCaderno,
      bookletType: draft.tipoCaderno,
      bookletColor: draft.corCaderno,
      files: draft.files,
      examFiles: draft.files,
      pdfUrl: draft.files.find((file) => file.kind === 'prova')?.url,
      proofUrl: draft.files.find((file) => file.kind === 'prova')?.url,
      editalUrl: draft.files.find((file) => file.kind === 'edital')?.url,
      gabaritoUrl: draft.files.find((file) => file.kind === 'gabarito')?.url,
      answerKeyUrl: draft.files.find((file) => file.kind === 'gabarito')?.url,
      publishStatus: draft.publishStatus,
      visibilityStatus: draft.visibilityStatus,
      scheduledAt: draft.scheduledAt,
      banca: {
        id: resolvedAgency?.id || draft.bancaId || undefined,
        sigla: readTaxonomySigla(resolvedAgency) || draft.bancaSigla || draft.bancaNome,
        nome: readTaxonomyName(resolvedAgency) || draft.bancaNome || draft.bancaSigla,
      },
      orgao: {
        id: resolvedOrganization?.id || draft.orgaoId || undefined,
        sigla: readTaxonomySigla(resolvedOrganization) || draft.orgaoSigla || draft.orgaoNome,
        nome: readTaxonomyName(resolvedOrganization) || draft.orgaoNome || draft.orgaoSigla,
      },
      cargo: {
        descricao: draft.cargoDescricao,
        ['descrição']: draft.cargoDescricao,
      },
    });

    if (!normalized) {
      addToast('Preencha pelo menos ID e nome da prova.', 'error');
      return;
    }

    const previousId = originalExamIdRef.current || String(normalized.id);
    setIsSaving(true);

    try {
      const sync = await syncLinkedQuestions(normalized, previousId, 'save');
      const nextExamBank = [
        normalized,
        ...examBank.filter((item) => {
          const itemId = String(item.id);
          return itemId !== previousId && itemId !== String(normalized.id);
        }),
      ];

      const nextSettings: SystemSettings = {
        ...systemSettings,
        examBank: nextExamBank,
      };

      updateSystemSettings(nextSettings);
      await saveSystemSettingsNow(nextSettings);

      originalExamIdRef.current = String(normalized.id);
      setDraft(createDraftFromProva(normalized));

      if (sync.failures.length > 0) {
        addToast(`Prova salva, mas ${sync.failures.length} questoes nao sincronizaram.`, 'error');
      } else {
        addToast(
          isNew
            ? `Prova "${formatProvaLabel(normalized)}" criada com sucesso.`
            : `Prova "${formatProvaLabel(normalized)}" atualizada com sucesso.`,
          'success',
        );
      }

      if (isNew) {
        router.replace(buildAdminExamEditPath(normalized.id));
      }
    } catch (error) {
      clientLog.warn('Error saving exam:', error);
      addToast('Nao foi possivel salvar a prova.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [addToast, draft, ensureExamTaxonomy, examBank, isNew, router, saveSystemSettingsNow, syncLinkedQuestions, systemSettings, updateSystemSettings]);

  const handleDelete = React.useCallback(async () => {
    if (!existingExam) {
      return;
    }

    const confirmed = await confirm({
      title: 'Remover prova',
      description: `Remover "${existingExam.nome}" do banco de provas?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      const sync = await syncLinkedQuestions(null, String(existingExam.id), 'delete');
      const nextSettings: SystemSettings = {
        ...systemSettings,
        examBank: examBank.filter((item) => String(item.id) !== String(existingExam.id)),
      };

      updateSystemSettings(nextSettings);
      await saveSystemSettingsNow(nextSettings);

      if (sync.failures.length > 0) {
        addToast(`Prova removida, mas ${sync.failures.length} questoes nao sincronizaram.`, 'error');
      } else {
        addToast('Prova removida com sucesso.', 'success');
      }

      router.push(buildAdminPath('operation', 'exams'));
    } catch (error) {
      clientLog.warn('Error deleting exam:', error);
      addToast('Nao foi possivel remover a prova.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [addToast, confirm, examBank, existingExam, router, saveSystemSettingsNow, syncLinkedQuestions, systemSettings, updateSystemSettings]);

  const linkedQuestionProbeId = React.useMemo(
    () => String(existingExam?.id || draft?.id || ''),
    [existingExam?.id, draft?.id],
  );

  const linkedQuestionsCount = React.useMemo(() => {
    if (!linkedQuestionProbeId) {
      return 0;
    }

    return questions.reduce((count, question) => (
      isQuestionLinkedToProva(question, linkedQuestionProbeId) ? count + 1 : count
    ), 0);
  }, [linkedQuestionProbeId, questions]);

  const renderAdminShell = (children: React.ReactNode) => (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="exams"
      pageTitle="Banco de provas"
      showPageHeader={false}
    >
      {children}
    </AdminStandaloneShell>
  );

  if (isAuthLoading || !isSystemSettingsLoaded || (isSaving && !draft)) {
    return renderAdminShell(
      <div className={`${ADMIN_SURFACE_CLASS} flex min-h-[360px] items-center justify-center p-12 text-slate-500 dark:text-slate-400`}>
        <Loader2 className="mr-3 animate-spin" size={18} /> Carregando editor da prova...
      </div>,
    );
  }

  if (!isNew && !existingExam) {
    return renderAdminShell(
      <div className={`${ADMIN_SURFACE_CLASS} p-8`}>
        <div className="flex items-start gap-3">
          <div className="rounded-sm bg-amber-50 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={16} />
          </div>
          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Prova nao encontrada</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                O cadastro solicitado nao existe mais no banco de provas ou ainda nao foi carregado pela plataforma.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={closeEditor} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                <ArrowLeft size={14} /> Voltar
              </button>
              <button type="button" onClick={() => router.push(buildAdminExamEditPath('new'))} className={ADMIN_PRIMARY_BUTTON_CLASS}>
                Nova prova
              </button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  if (!draft) {
    return null;
  }

  return renderAdminShell(
    <AdminExamEditorPage
      draft={draft}
      setDraft={setDraft}
      linkedQuestionsCount={linkedQuestionsCount}
      examPreview={existingExam}
      agencyOptions={systemSettings.taxonomies?.agencies || []}
      organizationOptions={systemSettings.taxonomies?.organizations || []}
      isNew={isNew}
      isSaving={isSaving}
      isDeleting={isDeleting}
      onCreateAgency={createAgencyFromEditor}
      onCreateOrganization={createOrganizationFromEditor}
      onUploadExamFile={uploadExamFileFromEditor}
      onSave={() => void persistExam()}
      onDelete={!isNew ? () => void handleDelete() : undefined}
      onClose={closeEditor}
    />,
  );
};

export default AdminExamEditPage;
