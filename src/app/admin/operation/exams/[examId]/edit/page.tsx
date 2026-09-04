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
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import type { ExamFileKind, Prova, Question } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { useConfirm } from '@providers/ModalProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import { examService } from '@services/exams/examService';
import { filtersService } from '@services/filters';
import { clientLog } from '@services/monitoring/clientLog';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { useSystemSettingsActions } from '@/state/app-config/useSystemSettingsActions';
import { useQuestionBankStore } from '@/state/question-bank/questionBankStore';
import AdminExamEditorPage from '../../../../components/exams/AdminExamEditorPage';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { createDraftFromProva, createEmptyExamDraft, type ExamDraftState } from '../../../../components/exams/useAdminExamBankWorkflow';
import {
  formatProvaLabel,
  isQuestionLinkedToProva,
  normalizeProvaRecord,
} from '../../../../components/exams/examBankUtils';
import { buildAdminExamEditPath, buildAdminPath } from '../../../../config/adminPageNavigationConfig';
import { ADMIN_PRIMARY_BUTTON_CLASS, ADMIN_SECONDARY_BUTTON_CLASS, ADMIN_SURFACE_CLASS } from '../../../../components/shared/adminPanelStyles';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

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

const normalizeExamYear = (value: unknown) => String(value || '').trim();
const isValidExamYear = (value: string) => /^(19|20)\d{2}$/.test(value);

type ExamTaxonomyItem = {
  id?: string | number;
  name?: string;
  nome?: string;
  sigla?: string;
  slug?: string;
  parentId?: string | number;
  parent_id?: string | number;
};

type ExamRoleFocusDraftRecord = {
  foco?: unknown;
  focus?: unknown;
  cargos?: unknown;
  cargo?: unknown;
  role?: unknown;
};

const readTaxonomyName = (item: ExamTaxonomyItem | null | undefined) => String(item?.name || item?.nome || item?.sigla || '').trim();
const readTaxonomySigla = (item: ExamTaxonomyItem | null | undefined) => String(item?.sigla || item?.name || item?.nome || '').trim();
const readTaxonomySlug = (item: ExamTaxonomyItem | null | undefined) => String(item?.slug || '').trim();

const findMatchingExamTaxonomy = (items: ExamTaxonomyItem[] = [], name: string, sigla: string, id?: string) => {
  const normalizedId = String(id || '');
  if (normalizedId) {
    const byId = items.find((item) => String(item?.id || '') === normalizedId);
    if (byId) return byId;
  }

  const normalizedName = normalizeTaxonomyText(name);
  const normalizedSigla = normalizeTaxonomyText(sigla);
  const expectedSlugs = new Set(
    [name, sigla]
      .map((value) => slugifyTaxonomy(String(value || '')))
      .filter(Boolean),
  );

  return items.find((item) => {
    const itemName = normalizeTaxonomyText(readTaxonomyName(item));
    const itemSigla = normalizeTaxonomyText(readTaxonomySigla(item));
    const itemSlug = slugifyTaxonomy(readTaxonomySlug(item));
    return Boolean(
      (normalizedName && (itemName === normalizedName || itemSigla === normalizedName))
      || (normalizedSigla && (itemSigla === normalizedSigla || itemName === normalizedSigla))
      || (itemSlug && expectedSlugs.has(itemSlug)),
    );
  });
};

const readExamTaxonomySaveMessage = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return String(error || '');
  }

  const record = error as {
    message?: unknown;
    response?: {
      status?: unknown;
      data?: {
        message?: unknown;
      };
    };
  };

  return String(record.response?.data?.message || record.message || '');
};

const isExamTaxonomySlugConflict = (error: unknown) => {
  const status = typeof error === 'object' && error !== null
    ? (error as { response?: { status?: unknown } }).response?.status
    : undefined;
  const message = normalizeTaxonomyText(readExamTaxonomySaveMessage(error));
  return status === 409 || (message.includes('slug') && (message.includes('uso') || message.includes('use')));
};

const splitExamTaxonomyValues = (value: unknown) => Array.from(new Set(
  String(value || '')
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean),
));

const splitExamIdValues = (value: unknown) => Array.from(new Set(
  String(value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean),
));

const parseExamDraftArray = <T,>(value: unknown): T[] => {
  if (!String(value || '').trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const readExamDraftText = (value: unknown) => String(value || '').trim();

const parseOrganizationLabel = (value: string) => {
  const label = String(value || '').trim();
  const match = label.match(/^([A-Z0-9][A-Z0-9./-]{1,14})\s+-\s+(.+)$/);
  return match
    ? { sigla: match[1].trim(), name: match[2].trim() }
    : { sigla: '', name: label };
};

const readTaxonomyParentId = (item: ExamTaxonomyItem | null | undefined) => String(
  item?.parentId || item?.parent_id || '',
);

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
  const { systemSettings, isSystemSettingsLoaded } = useSystemSettingsActions();
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();

  const [draft, setDraft] = React.useState<ExamDraftState | null>(null);
  const [loadedExam, setLoadedExam] = React.useState<Prova | null>(null);
  const [isExamLoading, setIsExamLoading] = React.useState(!isNew);
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

  React.useEffect(() => {
    let active = true;

    const loadExam = async () => {
      if (isNew) {
        setLoadedExam(null);
        setIsExamLoading(false);
        return;
      }

      setIsExamLoading(true);
      try {
        const exam = await examService.show(examId);
        if (active) {
          setLoadedExam(exam);
        }
      } catch (error) {
        clientLog.warn('Error loading exam:', error);
        if (active) {
          addToast('Não foi possível carregar a prova no banco canônico.', 'error');
          setLoadedExam(null);
        }
      } finally {
        if (active) {
          setIsExamLoading(false);
        }
      }
    };

    loadExam();

    return () => {
      active = false;
    };
  }, [addToast, examId, isNew]);

  const existingExam = React.useMemo(
    () => loadedExam
      || findExamInQuestionsById(questions, String(examId))
      || null,
    [examId, loadedExam, questions],
  );

  const levelOptions = React.useMemo(() => {
    const fromQuestions = questions
      .map((question) => {
        const questionWithLevel = question as Question & { level?: unknown; nivel?: unknown };
        return String(questionWithLevel.level || questionWithLevel.nivel || '').trim();
      })
      .filter(Boolean);

    return Array.from(new Set(['Superior', 'Médio', 'Fundamental', ...fromQuestions]));
  }, [questions]);

  React.useEffect(() => {
    if (!isSystemSettingsLoaded || isExamLoading) {
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
  }, [existingExam, isExamLoading, isNew, isSystemSettingsLoaded]);

  const closeEditor = React.useCallback(() => {
    router.push(buildAdminPath('operation', 'exams'));
  }, [router]);

  const ensureExamTaxonomy = React.useCallback(async (
    type: 'banca' | 'orgao' | 'carreira' | 'cargo',
    name: string,
    sigla: string,
    currentId = '',
    parentId = '',
  ) => {
    const trimmedName = String(name || sigla || '').trim();
    const trimmedSigla = String(sigla || '').trim();
    if (!trimmedName && !trimmedSigla) {
      return null;
    }

    const selectTaxonomyList = (taxonomies?: typeof systemSettings.taxonomies | null) => (
      type === 'banca'
        ? (taxonomies?.agencies || [])
        : type === 'orgao'
          ? (taxonomies?.organizations || [])
          : type === 'carreira'
            ? (taxonomies?.careers || [])
            : (taxonomies?.roles || [])
    ) as ExamTaxonomyItem[];

    const findExisting = (items: ExamTaxonomyItem[] = []) => (
      findMatchingExamTaxonomy(items, trimmedName, trimmedSigla, currentId)
    );

    const currentList = selectTaxonomyList(systemSettings.taxonomies);
    const existing = findMatchingExamTaxonomy(currentList as ExamTaxonomyItem[], trimmedName, trimmedSigla, currentId);
    if (existing) {
      if (type === 'cargo' && parentId) {
        const existingParentId = readTaxonomyParentId(existing);
        if (existingParentId && existingParentId !== String(parentId)) {
          throw new Error(`O cargo "${trimmedName}" já pertence a outro foco.`);
        }
        if (!existingParentId && Number(existing.id) > 0) {
          await filtersService.save({
            id: Number(existing.id),
            type,
            name: readTaxonomyName(existing) || trimmedName,
            slug: existing.slug || slugifyTaxonomy(readTaxonomyName(existing) || trimmedName),
            parent_id: Number(parentId),
          });
          return { ...existing, parentId, parent_id: parentId };
        }
      }
      return existing;
    }

    const freshTaxonomies = await filtersService.listTaxonomies(true);
    const freshExisting = findExisting(selectTaxonomyList(freshTaxonomies as typeof systemSettings.taxonomies));
    if (freshExisting) {
      void ensureTaxonomiesLoaded(true);
      return freshExisting;
    }

    const basePayload = {
      type,
      name: trimmedName || trimmedSigla,
      sigla: trimmedSigla || undefined,
      slug: slugifyTaxonomy(trimmedName || trimmedSigla),
      parent_id: parentId ? Number(parentId) : undefined,
      metadata: trimmedSigla ? { sigla: trimmedSigla } : undefined,
    };

    let createdId = 0;
    try {
      createdId = await filtersService.save(basePayload);
    } catch (error) {
      if (!isExamTaxonomySlugConflict(error)) {
        throw error;
      }

      const conflictTaxonomies = await filtersService.listTaxonomies(true);
      const conflictExisting = findExisting(selectTaxonomyList(conflictTaxonomies as typeof systemSettings.taxonomies));
      if (conflictExisting) {
        void ensureTaxonomiesLoaded(true);
        return conflictExisting;
      }

      createdId = await filtersService.save({
        ...basePayload,
        slug: slugifyTaxonomy(`${type}-${trimmedName || trimmedSigla}`),
      });
    }

    const taxonomies = await filtersService.listTaxonomies(true);
    void ensureTaxonomiesLoaded(true);
    const nextList = selectTaxonomyList(taxonomies as typeof systemSettings.taxonomies);
    return findMatchingExamTaxonomy(nextList as ExamTaxonomyItem[], trimmedName, trimmedSigla, String(createdId))
      || {
        id: createdId || trimmedName || trimmedSigla,
        name: trimmedName || trimmedSigla,
        nome: trimmedName || trimmedSigla,
        sigla: trimmedSigla || trimmedName,
        parentId: parentId || undefined,
        parent_id: parentId || undefined,
      };
  }, [
    ensureTaxonomiesLoaded,
    systemSettings.taxonomies?.agencies,
    systemSettings.taxonomies?.careers,
    systemSettings.taxonomies?.organizations,
    systemSettings.taxonomies?.roles,
  ]);

  const ensureExamYearFilter = React.useCallback(async (year: string) => {
    const trimmedYear = normalizeExamYear(year);
    if (!trimmedYear || !isValidExamYear(trimmedYear)) {
      return trimmedYear;
    }

    const existingYears = (systemSettings.taxonomies?.years || []).map((item) => String(item).trim());
    if (existingYears.includes(trimmedYear)) {
      return trimmedYear;
    }

    try {
      await filtersService.save({
        type: 'ano',
        name: trimmedYear,
        slug: slugifyTaxonomy(trimmedYear),
      });
      await ensureTaxonomiesLoaded(true);
    } catch (error) {
      if (!isExamTaxonomySlugConflict(error)) {
        throw error;
      }

      const freshTaxonomies = await filtersService.listTaxonomies(true);
      const freshYears = (freshTaxonomies.years || []).map((item) => String(item).trim());
      if (!freshYears.includes(trimmedYear)) {
        throw error;
      }

      void ensureTaxonomiesLoaded(true);
    }

    return trimmedYear;
  }, [ensureTaxonomiesLoaded, systemSettings.taxonomies?.years]);

  const uploadExamFileFromEditor = React.useCallback(async (
    file: File,
    kind: ExamFileKind,
  ) => {
    try {
      const uploaded = await examService.uploadFile(file, kind, isNew ? null : examId);
      addToast('Arquivo anexado à prova.', 'success');
      return uploaded;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.';
      addToast(message, 'error');
      throw error;
    }
  }, [addToast, examId, isNew]);

  const persistExam = React.useCallback(async (patch?: Partial<ExamDraftState>) => {
    const draftToPersist = draft ? { ...draft, ...patch } : null;
    if (!draftToPersist) {
      return;
    }

    let resolvedAgency: ExamTaxonomyItem | null = null;
    let resolvedOrganizations: ExamTaxonomyItem[] = [];
    let resolvedFocuses: ExamTaxonomyItem[] = [];
    const resolvedRoles: ExamTaxonomyItem[] = [];
    const resolvedRoleParents = new Map<string, ExamTaxonomyItem>();
    let resolvedYear = draftToPersist.ano;
    try {
      const organizationValues = splitExamTaxonomyValues(draftToPersist.orgaosText || draftToPersist.orgaoNome || draftToPersist.orgaoSigla);
      const roleValues = splitExamTaxonomyValues(draftToPersist.cargosText || draftToPersist.cargoDescricao);
      const focusValues = splitExamTaxonomyValues(draftToPersist.focosText || draftToPersist.focoNome);
      const structuredRoleFocusRows = parseExamDraftArray<ExamRoleFocusDraftRecord>(draftToPersist.cargosPorFocoText)
        .map((item) => ({
          foco: String(item.foco || item.focus || '').trim(),
          cargos: Array.from(new Set(
            (Array.isArray(item.cargos) ? item.cargos : [item.cargo ?? item.role])
              .map((role) => String(role || '').trim())
              .filter(Boolean),
          )),
        }))
        .filter((item) => item.foco || item.cargos.length > 0);
      const roleFocusRows = structuredRoleFocusRows.length > 0
        ? structuredRoleFocusRows
        : focusValues.map((foco, index) => ({
          foco,
          cargos: index === 0 ? roleValues : [],
        }));
      const allFocusValues = Array.from(new Set([
        ...focusValues,
        ...roleFocusRows.map((item) => item.foco),
      ].filter(Boolean)));

      resolvedAgency = await ensureExamTaxonomy('banca', draftToPersist.bancaNome, draftToPersist.bancaSigla, draftToPersist.bancaId);
      resolvedOrganizations = (await Promise.all(organizationValues.map(async (value, index) => {
        const parsed = parseOrganizationLabel(value);
        return ensureExamTaxonomy('orgao', parsed.name, parsed.sigla, index === 0 ? draftToPersist.orgaoId : '');
      }))).filter((item): item is ExamTaxonomyItem => Boolean(item));

      if (roleValues.length > 0 && allFocusValues.length === 0) {
        throw new Error('Selecione a área/foco antes de vincular cargos.');
      }

      resolvedFocuses = (await Promise.all(allFocusValues.map((value, index) => (
        ensureExamTaxonomy('carreira', value, '', index === 0 ? draftToPersist.focoId : '')
      )))).filter((item): item is ExamTaxonomyItem => Boolean(item));

      for (const row of roleFocusRows) {
        const rowFocus = resolvedFocuses.find((item) => (
          normalizeTaxonomyText(readTaxonomyName(item)) === normalizeTaxonomyText(row.foco)
        ));
        const rowFocusId = String(rowFocus?.id || '');
        if (row.cargos.length > 0 && !rowFocusId) {
          throw new Error(`Não foi possível criar ou localizar o foco "${row.foco}" dos cargos.`);
        }

        for (const roleName of row.cargos) {
          const role = await ensureExamTaxonomy('cargo', roleName, '', '', rowFocusId);
          if (!role) {
            throw new Error(`Não foi possível criar ou localizar o cargo "${roleName}".`);
          }
          const roleKey = normalizeTaxonomyText(readTaxonomyName(role) || roleName);
          if (!resolvedRoles.some((item) => normalizeTaxonomyText(readTaxonomyName(item)) === roleKey)) {
            resolvedRoles.push(role);
          }
          if (rowFocus) {
            resolvedRoleParents.set(roleKey, rowFocus);
          }
        }
      }
      resolvedYear = await ensureExamYearFilter(draftToPersist.ano);
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Não foi possível sincronizar as taxonomias da prova.', 'error');
      return;
    }

    const resolvedOrganization = resolvedOrganizations[0] || null;
    const resolvedRole = resolvedRoles[0] || null;
    const resolvedFocus = resolvedFocuses[0] || null;
    const resolvedFocusName = readTaxonomyName(resolvedFocus) || draftToPersist.focoNome;
    const resolvedFocusList = resolvedFocuses.map((item) => {
      const name = readTaxonomyName(item);
      return {
        id: item.id,
        nome: name,
        name,
        slug: item.slug || slugifyTaxonomy(name),
      };
    }).filter((item) => item.nome);
    const requisitosDetalhados = parseExamDraftArray(draftToPersist.requisitosDetalhadosText);
    const remuneracoesDetalhadas = parseExamDraftArray(draftToPersist.remuneracoesDetalhadasText);
    const vagasDetalhadas = parseExamDraftArray(draftToPersist.vagasDetalhadasText);
    const conteudoProgramaticoDetalhado = parseExamDraftArray(draftToPersist.conteudoProgramaticoDetalhadoText);
    const etapas = parseExamDraftArray(draftToPersist.etapasText);
    const questoesVinculadas = splitExamIdValues(draftToPersist.questoesVinculadasText);

    const normalized = normalizeProvaRecord({
      id: draftToPersist.id,
      nome: draftToPersist.nome,
      ano: resolvedYear,
      nivel: draftToPersist.nivel,
      index: draftToPersist.index,
      caderno: draftToPersist.caderno,
      tipoCaderno: draftToPersist.tipoCaderno,
      corCaderno: draftToPersist.corCaderno,
      bookletType: draftToPersist.tipoCaderno,
      bookletColor: draftToPersist.corCaderno,
      files: draftToPersist.files,
      examFiles: draftToPersist.files,
      pdfUrl: draftToPersist.files.find((file) => file.kind === 'prova')?.url,
      proofUrl: draftToPersist.files.find((file) => file.kind === 'prova')?.url,
      editalUrl: draftToPersist.files.find((file) => file.kind === 'edital')?.url,
      gabaritoUrl: draftToPersist.files.find((file) => file.kind === 'gabarito')?.url,
      answerKeyUrl: draftToPersist.files.find((file) => file.kind === 'gabarito')?.url,
      publishStatus: draftToPersist.publishStatus,
      visibilityStatus: draftToPersist.visibilityStatus,
      scheduledAt: draftToPersist.scheduledAt,
      publishedAt: draftToPersist.publishedAt,
      banca: {
        id: resolvedAgency?.id || draftToPersist.bancaId || undefined,
        sigla: readTaxonomySigla(resolvedAgency) || draftToPersist.bancaSigla || draftToPersist.bancaNome,
        nome: readTaxonomyName(resolvedAgency) || draftToPersist.bancaNome || draftToPersist.bancaSigla,
      },
      orgao: {
        id: resolvedOrganization?.id || draftToPersist.orgaoId || undefined,
        sigla: readTaxonomySigla(resolvedOrganization) || draftToPersist.orgaoSigla || draftToPersist.orgaoNome,
        nome: readTaxonomyName(resolvedOrganization) || draftToPersist.orgaoNome || draftToPersist.orgaoSigla,
      },
      orgaos: resolvedOrganizations.map((item) => ({
        id: item.id,
        nome: readTaxonomyName(item),
        name: readTaxonomyName(item),
        sigla: readTaxonomySigla(item),
        slug: item.slug || slugifyTaxonomy(readTaxonomyName(item)),
      })),
      cargo: {
        id: resolvedRole?.id,
        descricao: readTaxonomyName(resolvedRole) || draftToPersist.cargoDescricao,
        ['descrição']: readTaxonomyName(resolvedRole) || draftToPersist.cargoDescricao,
        name: readTaxonomyName(resolvedRole) || draftToPersist.cargoDescricao,
        slug: resolvedRole?.slug || slugifyTaxonomy(readTaxonomyName(resolvedRole) || draftToPersist.cargoDescricao),
        parentId: resolvedFocus?.id,
        parent_id: resolvedFocus?.id,
      },
      cargos: resolvedRoles.map((item) => ({
        ...(() => {
          const parent = resolvedRoleParents.get(normalizeTaxonomyText(readTaxonomyName(item))) || resolvedFocus;
          return {
            parentId: parent?.id,
            parent_id: parent?.id,
          };
        })(),
        id: item.id,
        descricao: readTaxonomyName(item),
        ['descrição']: readTaxonomyName(item),
        name: readTaxonomyName(item),
        slug: item.slug || slugifyTaxonomy(readTaxonomyName(item)),
      })),
      roles: resolvedRoles.map((item) => readTaxonomyName(item)).filter(Boolean),
      dataInscricaoInicio: readExamDraftText(draftToPersist.dataInscricaoInicio),
      dataInscricaoFim: readExamDraftText(draftToPersist.dataInscricaoFim),
      dataProva: readExamDraftText(draftToPersist.dataProva),
      valorInscricao: readExamDraftText(draftToPersist.valorInscricao),
      totalQuestoes: readExamDraftText(draftToPersist.totalQuestoes),
      etapas,
      questoesVinculadas,
      platformQuestionIds: questoesVinculadas,
      foco: resolvedFocus ? {
        id: resolvedFocus.id,
        nome: resolvedFocusName,
        name: resolvedFocusName,
        slug: resolvedFocus.slug || slugifyTaxonomy(resolvedFocusName),
      } : undefined,
      focos: resolvedFocusList,
      carreira: resolvedFocus ? {
        id: resolvedFocus.id,
        nome: resolvedFocusName,
        name: resolvedFocusName,
        slug: resolvedFocus.slug || slugifyTaxonomy(resolvedFocusName),
      } : undefined,
      carreiras: resolvedFocusList,
      requisitos: draftToPersist.requisitosText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      requirements: draftToPersist.requisitosText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      requisitosDetalhados,
      requirementsDetailed: requisitosDetalhados,
      remuneracoes: draftToPersist.remuneracaoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      remunerations: draftToPersist.remuneracaoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      remuneracoesDetalhadas,
      remunerationsDetailed: remuneracoesDetalhadas,
      vagas: draftToPersist.vagasText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      vacancies: draftToPersist.vagasText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      vagasDetalhadas,
      vacanciesDetailed: vagasDetalhadas,
      conteudoProgramatico: draftToPersist.conteudoProgramaticoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      programmaticContent: draftToPersist.conteudoProgramaticoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      conteudoProgramaticoDetalhado,
      programmaticContentDetailed: conteudoProgramaticoDetalhado,
    });

    if (!normalized) {
      addToast('Preencha pelo menos ID e nome da prova.', 'error');
      return;
    }

    const previousId = originalExamIdRef.current || String(normalized.id);
    setIsSaving(true);

    try {
      const savedExam = await examService.save(normalized);

      originalExamIdRef.current = String(savedExam.id || previousId);
      setLoadedExam(savedExam);
      setDraft(createDraftFromProva(savedExam));
      addToast(
        isNew
          ? `Prova "${formatProvaLabel(savedExam)}" criada com sucesso.`
          : `Prova "${formatProvaLabel(savedExam)}" atualizada com sucesso.`,
        'success',
      );

      if (isNew) {
        router.replace(buildAdminExamEditPath(savedExam.id));
      }
    } catch (error) {
      clientLog.warn('Error saving exam:', error);
      addToast('Não foi possível salvar a prova.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [addToast, draft, ensureExamTaxonomy, ensureExamYearFilter, isNew, router]);

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
      await examService.remove(existingExam.id);
      addToast('Prova arquivada com sucesso.', 'success');

      router.push(buildAdminPath('operation', 'exams'));
    } catch (error) {
      clientLog.warn('Error deleting exam:', error);
      addToast('Não foi possível arquivar a prova.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [addToast, confirm, existingExam, router]);

  const linkedQuestionProbeId = React.useMemo(
    () => String(existingExam?.id || draft?.id || ''),
    [existingExam?.id, draft?.id],
  );

  const linkedQuestionsCount = React.useMemo(() => {
    if (!linkedQuestionProbeId) {
      return 0;
    }

    const loadedQuestionCount = questions.reduce((count, question) => (
      isQuestionLinkedToProva(question, linkedQuestionProbeId) ? count + 1 : count
    ), 0);
    const persistedQuestionCount = Number(existingExam?.questionCount || 0);
    const draftQuestionCount = splitExamIdValues(draft?.questoesVinculadasText || '').length;
    return Math.max(persistedQuestionCount, loadedQuestionCount, draftQuestionCount);
  }, [draft?.questoesVinculadasText, existingExam?.questionCount, linkedQuestionProbeId, questions]);

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

  if (isAuthLoading || !isSystemSettingsLoaded || isExamLoading || (isSaving && !draft)) {
    return renderAdminShell(<RouteContentSkeleton variant="admin" />);
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
      setDraft={(nextDraft) => setDraft((currentDraft) => {
        if (!currentDraft) return createEmptyExamDraft();
        return typeof nextDraft === 'function' ? nextDraft(currentDraft) : nextDraft;
      })}
      linkedQuestionsCount={linkedQuestionsCount}
      examPreview={existingExam}
      agencyOptions={systemSettings.taxonomies?.agencies || []}
      organizationOptions={systemSettings.taxonomies?.organizations || []}
      roleOptions={systemSettings.taxonomies?.roles || []}
      focusOptions={systemSettings.taxonomies?.careers || []}
      subjectOptions={systemSettings.taxonomies?.subjects || []}
      topicOptions={systemSettings.taxonomies?.subjectTopics || systemSettings.taxonomies?.topics || []}
      specificSubjectOptions={systemSettings.taxonomies?.specificSubjects || []}
      yearOptions={systemSettings.taxonomies?.years || []}
      levelOptions={levelOptions}
      isNew={isNew}
      isSaving={isSaving}
      isDeleting={isDeleting}
      onUploadExamFile={uploadExamFileFromEditor}
      onSave={(patch) => void persistExam(patch)}
      onDelete={!isNew ? () => void handleDelete() : undefined}
    />,
  );
};

export default AdminExamEditPage;
