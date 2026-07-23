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

import { useEffect, useMemo, useState } from 'react';
import type { ExamFileAttachment, Prova, Question, SystemSettings } from '@types';
import { clientLog } from '@services/monitoring/clientLog';
import { examService } from '@services/exams/examService';
import {
  buildProvaSearchText,
  formatProvaLabel,
  isQuestionLinkedToProva,
  mergeExamBankSources,
  normalizeProvaRecord,
} from './examBankUtils';

type ToastHandler = (message: string, type?: string) => void;

const collectBookletProgrammaticContent = (prova: Prova): string[] => {
  if (!Array.isArray(prova.cadernos)) {
    return [];
  }

  return prova.cadernos.flatMap((caderno) => {
    const content = [
      ...(Array.isArray(caderno.conteudoProgramatico) ? caderno.conteudoProgramatico : []),
      ...(Array.isArray(caderno.programmaticContent) ? caderno.programmaticContent : []),
    ];
    return content.map((item) => item.nome || item.name || '').filter(Boolean);
  });
};

const stringifyDraftArray = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    return '';
  }

  return JSON.stringify(value, null, 2);
};

const parseDraftArray = <T,>(value: unknown): T[] => {
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

export interface ExamDraftState {
  id: string;
  nome: string;
  ano: string;
  nivel: string;
  index: string;
  caderno: string;
  tipoCaderno: string;
  corCaderno: string;
  publishStatus: 'published' | 'draft' | 'scheduled';
  visibilityStatus: 'public' | 'elite' | 'internal';
  scheduledAt: string;
  bancaId: string;
  bancaSigla: string;
  bancaNome: string;
  orgaoId: string;
  orgaoSigla: string;
  orgaoNome: string;
  orgaosText: string;
  focoId: string;
  focoNome: string;
  focosText: string;
  cargoDescricao: string;
  cargosText: string;
  cargosPorFocoText: string;
  requisitosText: string;
  requisitosDetalhadosText: string;
  remuneracaoText: string;
  remuneracoesDetalhadasText: string;
  vagasText: string;
  vagasDetalhadasText: string;
  conteudoProgramaticoText: string;
  conteudoProgramaticoDetalhadoText: string;
  etapasText: string;
  dataInscricaoInicio: string;
  dataInscricaoFim: string;
  dataProva: string;
  valorInscricao: string;
  totalQuestoes: string;
  questoesVinculadasText: string;
  files: ExamFileAttachment[];
}

interface UseAdminExamBankWorkflowOptions {
  enabled?: boolean;
  questions: Question[];
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => Promise<unknown> | unknown;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<unknown> | unknown;
  onUpdateQuestion: (question: Question) => Promise<{ success?: boolean } | void | null | undefined> | { success?: boolean } | void | null | undefined;
  filter: string;
  addToast: ToastHandler;
}

export const createDraftFromProva = (prova: Prova): ExamDraftState => ({
  id: String(prova.id),
  nome: prova.nome || '',
  ano: String(prova.ano || ''),
  nivel: prova.nivel || '',
  index: prova.index || '',
  caderno: prova.caderno || [prova.tipoCaderno || prova.bookletType, prova.corCaderno || prova.bookletColor].filter(Boolean).join(' - '),
  tipoCaderno: prova.tipoCaderno || prova.bookletType || '',
  corCaderno: prova.corCaderno || prova.bookletColor || '',
  publishStatus: prova.publishStatus || 'published',
  visibilityStatus: prova.visibilityStatus || 'public',
  scheduledAt: prova.scheduledAt || '',
  bancaId: String(prova.banca?.id || ''),
  bancaSigla: prova.banca?.sigla || '',
  bancaNome: prova.banca?.nome || prova.banca?.name || '',
  orgaoId: String(prova.orgao?.id || ''),
  orgaoSigla: prova.orgao?.sigla || '',
  orgaoNome: prova.orgao?.nome || prova.orgao?.name || '',
  focoId: String(prova.foco?.id || prova.carreira?.id || prova.focos?.[0]?.id || prova.carreiras?.[0]?.id || ''),
  focoNome: prova.foco?.nome || prova.foco?.name || prova.carreira?.nome || prova.carreira?.name
    || prova.focos?.[0]?.nome || prova.focos?.[0]?.name || prova.carreiras?.[0]?.nome || prova.carreiras?.[0]?.name || '',
  focosText: (prova.focos || prova.carreiras || [])
    .map((foco) => foco.nome || foco.name)
    .filter(Boolean)
    .join('\n'),
  files: prova.files || prova.examFiles || [],
  cargoDescricao: prova.cargo?.descricao || prova.cargo?.['descrição'] || '',
  orgaosText: (prova.orgaos || [])
    .map((orgao) => orgao.sigla || orgao.nome || orgao.name)
    .filter(Boolean)
    .join('\n'),
  cargosText: (prova.cargos || [])
    .map((cargo) => cargo.descricao || cargo.name || cargo['descrição'])
    .filter(Boolean)
    .join('\n'),
  cargosPorFocoText: stringifyDraftArray((prova.cargos || []).map((cargo) => ({
    foco: (prova.focos || prova.carreiras || []).find((foco) => String(foco.id || '') === String(cargo.parentId || cargo.parent_id || ''))?.nome
      || (prova.focos || prova.carreiras || []).find((foco) => String(foco.id || '') === String(cargo.parentId || cargo.parent_id || ''))?.name
      || prova.foco?.nome
      || prova.foco?.name
      || prova.carreira?.nome
      || prova.carreira?.name
      || '',
    cargo: cargo.descricao || cargo.name || cargo['descrição'] || '',
  })).filter((item) => item.cargo)),
  requisitosText: [
    ...(Array.isArray(prova.requisitos) ? prova.requisitos : []),
    ...(Array.isArray(prova.requirements) ? prova.requirements : []),
  ].filter(Boolean).join('\n'),
  requisitosDetalhadosText: stringifyDraftArray(prova.requisitosDetalhados || prova.requirementsDetailed),
  remuneracaoText: [
    ...(Array.isArray(prova.remuneracoes) ? prova.remuneracoes : []),
    ...(Array.isArray(prova.remunerations) ? prova.remunerations : []),
  ].filter(Boolean).join('\n'),
  remuneracoesDetalhadasText: stringifyDraftArray(prova.remuneracoesDetalhadas || prova.remunerationsDetailed),
  vagasText: [
    ...(Array.isArray(prova.vagas) ? prova.vagas : []),
    ...(Array.isArray(prova.vacancies) ? prova.vacancies : []),
  ].map((vaga) => {
    if (typeof vaga === 'string') {
      return vaga;
    }
    return vaga?.descricao || vaga?.description || '';
  }).filter(Boolean).join('\n'),
  vagasDetalhadasText: stringifyDraftArray(prova.vagasDetalhadas || prova.vacanciesDetailed),
  conteudoProgramaticoText: Array.from(new Set([
    ...(Array.isArray(prova.conteudoProgramatico) ? prova.conteudoProgramatico : []),
    ...(Array.isArray(prova.programmaticContent) ? prova.programmaticContent : []),
    ...collectBookletProgrammaticContent(prova),
  ].filter(Boolean))).join('\n'),
  conteudoProgramaticoDetalhadoText: stringifyDraftArray(prova.conteudoProgramaticoDetalhado || prova.programmaticContentDetailed),
  etapasText: stringifyDraftArray(prova.etapas),
  dataInscricaoInicio: prova.dataInscricaoInicio || '',
  dataInscricaoFim: prova.dataInscricaoFim || '',
  dataProva: prova.dataProva || '',
  valorInscricao: String(prova.valorInscricao || ''),
  totalQuestoes: String(prova.totalQuestoes || ''),
  questoesVinculadasText: (prova.questoesVinculadas || prova.platformQuestionIds || []).map(String).join('\n'),
});

export const createEmptyExamDraft = (): ExamDraftState => ({
  id: '',
  nome: '',
  ano: '',
  nivel: '',
  index: '',
  caderno: '',
  tipoCaderno: '',
  corCaderno: '',
  publishStatus: 'published',
  visibilityStatus: 'public',
  scheduledAt: '',
  bancaId: '',
  bancaSigla: '',
  bancaNome: '',
  orgaoId: '',
  orgaoSigla: '',
  orgaoNome: '',
  focoId: '',
  focoNome: '',
  focosText: '',
  files: [],
  cargoDescricao: '',
  orgaosText: '',
  cargosText: '',
  cargosPorFocoText: '',
  requisitosText: '',
  requisitosDetalhadosText: '',
  remuneracaoText: '',
  remuneracoesDetalhadasText: '',
  vagasText: '',
  vagasDetalhadasText: '',
  conteudoProgramaticoText: '',
  conteudoProgramaticoDetalhadoText: '',
  etapasText: '',
  dataInscricaoInicio: '',
  dataInscricaoFim: '',
  dataProva: '',
  valorInscricao: '',
  totalQuestoes: '',
  questoesVinculadasText: '',
});

/**
 * Orquestra o banco de provas do admin.
 * A prova é persistida na API canônica e sincronizada nas questões vinculadas.
 *
 * @since 1.0.0
 */
export const useAdminExamBankWorkflow = ({
  enabled = true,
  questions,
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
  onUpdateQuestion,
  filter,
  addToast,
}: UseAdminExamBankWorkflowOptions) => {
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examDraft, setExamDraft] = useState<ExamDraftState | null>(null);
  const [deletingExam, setDeletingExam] = useState<Prova | null>(null);
  const [actionLoading, setActionLoading] = useState<'save' | 'delete' | null>(null);
  const [canonicalExamBank, setCanonicalExamBank] = useState<Prova[]>([]);
  const [hasLoadedCanonicalExamBank, setHasLoadedCanonicalExamBank] = useState(false);
  const [canonicalExamBankLoadFailed, setCanonicalExamBankLoadFailed] = useState(false);
  const [nextExamCursor, setNextExamCursor] = useState<string | null>(null);
  const [hasMoreExams, setHasMoreExams] = useState(false);
  const [isLoadingMoreExams, setIsLoadingMoreExams] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    const loadExamBank = async () => {
      try {
        const page = await examService.listPage({ limit: 30, ...(filter ? { search: filter } : {}) });
        if (active) {
          setCanonicalExamBank(page.items);
          setNextExamCursor(page.pageInfo.nextCursor);
          setHasMoreExams(page.pageInfo.hasMore);
          setHasLoadedCanonicalExamBank(true);
          setCanonicalExamBankLoadFailed(false);
        }
      } catch (error) {
        clientLog.warn('Error loading canonical exam bank:', error);
        if (active) {
          setCanonicalExamBank([]);
          setHasLoadedCanonicalExamBank(true);
          setCanonicalExamBankLoadFailed(true);
          addToast('Não foi possível carregar o Banco de Provas canônico. Exibindo dados legados para consulta.', 'error');
        }
      }
    };

    loadExamBank();

    return () => {
      active = false;
    };
  }, [addToast, enabled, filter]);

  const loadMoreExams = async () => {
    if (!nextExamCursor || isLoadingMoreExams) return;
    setIsLoadingMoreExams(true);
    try {
      const page = await examService.listPage({
        limit: 30,
        cursor: nextExamCursor,
        ...(filter ? { search: filter } : {}),
      });
      setCanonicalExamBank((current) => [
        ...current,
        ...page.items.filter((exam) => !current.some((existing) => String(existing.id) === String(exam.id))),
      ]);
      setNextExamCursor(page.pageInfo.nextCursor);
      setHasMoreExams(page.pageInfo.hasMore);
    } catch (error) {
      clientLog.warn('Error loading more canonical exams:', error);
      addToast('Não foi possível carregar mais provas.', 'error');
    } finally {
      setIsLoadingMoreExams(false);
    }
  };

  const legacyExamBank = useMemo(
    () => mergeExamBankSources(systemSettings, questions),
    [questions, systemSettings],
  );

  const examBank = hasLoadedCanonicalExamBank && canonicalExamBank.length > 0
    ? canonicalExamBank
    : hasLoadedCanonicalExamBank && !canonicalExamBankLoadFailed
      ? canonicalExamBank
    : legacyExamBank;

  const filteredExamBank = useMemo(() => {
    const normalizedFilter = String(filter || '').trim().toLowerCase();
    if (!normalizedFilter) {
      return examBank;
    }

    return examBank.filter((exam) => buildProvaSearchText(exam).includes(normalizedFilter));
  }, [examBank, filter]);

  void updateSystemSettings;
  void saveSystemSettingsNow;
  void onUpdateQuestion;

  const startEditingExam = (exam: Prova) => {
    setEditingExamId(String(exam.id));
    setExamDraft(createDraftFromProva(exam));
  };

  const startCreatingExam = () => {
    setEditingExamId('new');
    setExamDraft(createEmptyExamDraft());
  };

  const cancelEditingExam = () => {
    setEditingExamId(null);
    setExamDraft(null);
  };

  const requestDeleteExam = (exam: Prova) => {
    setDeletingExam(exam);
  };

  const cancelDeleteExam = () => {
    setDeletingExam(null);
  };

  const handleSaveExam = async () => {
    if (!examDraft) {
      return;
    }

    const requisitosDetalhados = parseDraftArray(examDraft.requisitosDetalhadosText);
    const remuneracoesDetalhadas = parseDraftArray(examDraft.remuneracoesDetalhadasText);
    const vagasDetalhadas = parseDraftArray(examDraft.vagasDetalhadasText);
    const conteudoProgramaticoDetalhado = parseDraftArray(examDraft.conteudoProgramaticoDetalhadoText);
    const etapas = parseDraftArray(examDraft.etapasText);
    const questoesVinculadas = examDraft.questoesVinculadasText
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const focos = examDraft.focosText
      .split(/\n|;/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value, index) => ({
        id: index === 0 ? examDraft.focoId || undefined : undefined,
        nome: value,
        name: value,
      }));
    const roleFocusRows = parseDraftArray<{
      foco?: string;
      focus?: string;
      cargos?: string[];
      cargo?: string;
      role?: string;
    }>(examDraft.cargosPorFocoText);
    const cargos = roleFocusRows.length > 0
      ? roleFocusRows.flatMap((row) => {
        const focusName = String(row.foco || row.focus || '').trim();
        const focus = focos.find((item) => item.nome.toLocaleLowerCase('pt-BR') === focusName.toLocaleLowerCase('pt-BR'));
        const roles = Array.isArray(row.cargos) ? row.cargos : [row.cargo || row.role || ''];
        return roles.map((role) => String(role || '').trim()).filter(Boolean).map((role) => ({
          id: 0,
          descricao: role,
          ['descrição']: role,
          name: role,
          parentId: focus?.id,
          parent_id: focus?.id,
        }));
      })
      : examDraft.cargosText
        .split(/\n|;/)
        .map((value) => value.trim())
        .filter(Boolean);

    const nextExam = normalizeProvaRecord({
      id: examDraft.id,
      nome: examDraft.nome,
      ano: examDraft.ano,
      nivel: examDraft.nivel,
      index: examDraft.index,
      caderno: examDraft.caderno,
      tipoCaderno: examDraft.tipoCaderno,
      corCaderno: examDraft.corCaderno,
      bookletType: examDraft.tipoCaderno,
      bookletColor: examDraft.corCaderno,
      files: examDraft.files,
      examFiles: examDraft.files,
      pdfUrl: examDraft.files.find((file) => file.kind === 'prova')?.url,
      proofUrl: examDraft.files.find((file) => file.kind === 'prova')?.url,
      editalUrl: examDraft.files.find((file) => file.kind === 'edital')?.url,
      gabaritoUrl: examDraft.files.find((file) => file.kind === 'gabarito')?.url,
      answerKeyUrl: examDraft.files.find((file) => file.kind === 'gabarito')?.url,
      banca: {
        id: examDraft.bancaId || undefined,
        sigla: examDraft.bancaSigla || examDraft.bancaNome,
        nome: examDraft.bancaNome || examDraft.bancaSigla,
      },
      orgao: {
        id: examDraft.orgaoId || undefined,
        sigla: examDraft.orgaoSigla || examDraft.orgaoNome,
        nome: examDraft.orgaoNome || examDraft.orgaoSigla,
      },
      orgaos: examDraft.orgaosText
        .split(/\n|;/)
        .map((value) => value.trim())
        .filter(Boolean),
      cargo: {
        descricao: examDraft.cargoDescricao,
        ['descrição']: examDraft.cargoDescricao,
      },
      cargos,
      roles: examDraft.cargosText
        .split(/\n|;/)
        .map((value) => value.trim())
        .filter(Boolean),
      requisitos: examDraft.requisitosText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      requirements: examDraft.requisitosText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      requisitosDetalhados,
      requirementsDetailed: requisitosDetalhados,
      remuneracoes: examDraft.remuneracaoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      remunerations: examDraft.remuneracaoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      remuneracoesDetalhadas,
      remunerationsDetailed: remuneracoesDetalhadas,
      vagas: examDraft.vagasText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      vacancies: examDraft.vagasText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      vagasDetalhadas,
      vacanciesDetailed: vagasDetalhadas,
      conteudoProgramatico: examDraft.conteudoProgramaticoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      programmaticContent: examDraft.conteudoProgramaticoText
        .split(/\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      conteudoProgramaticoDetalhado,
      programmaticContentDetailed: conteudoProgramaticoDetalhado,
      dataInscricaoInicio: examDraft.dataInscricaoInicio,
      dataInscricaoFim: examDraft.dataInscricaoFim,
      dataProva: examDraft.dataProva,
      valorInscricao: examDraft.valorInscricao,
      totalQuestoes: examDraft.totalQuestoes,
      etapas,
      questoesVinculadas,
      platformQuestionIds: questoesVinculadas,
      foco: focos[0],
      focos,
      carreira: focos[0],
      carreiras: focos,
      publishStatus: examDraft.publishStatus,
      visibilityStatus: examDraft.visibilityStatus,
      scheduledAt: examDraft.scheduledAt,
    });

    if (!nextExam) {
      addToast('Preencha pelo menos o nome da prova.', 'error');
      return;
    }

    setActionLoading('save');
    try {
      const hasExistingExam = examBank.some((exam) => String(exam.id) === String(nextExam.id));
      const savedExam = await examService.save(nextExam);
      setCanonicalExamBank((current) => {
        const currentHasExam = current.some((exam) => String(exam.id) === String(savedExam.id));
        return currentHasExam
          ? current.map((exam) => (String(exam.id) === String(savedExam.id) ? savedExam : exam))
          : [savedExam, ...current];
      });
      setHasLoadedCanonicalExamBank(true);
      setCanonicalExamBankLoadFailed(false);
      addToast(
        hasExistingExam
          ? `Prova "${formatProvaLabel(savedExam)}" atualizada com sucesso.`
          : `Prova "${formatProvaLabel(savedExam)}" criada com sucesso.`,
        'success',
      );

      cancelEditingExam();
    } catch (error) {
      clientLog.warn('Error saving exam bank record:', error);
      addToast('Não foi possível salvar a prova.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteExam = async () => {
    if (!deletingExam) {
      return;
    }

    setActionLoading('delete');
    try {
      await examService.remove(deletingExam.id);
      setCanonicalExamBank((current) => current.filter((exam) => String(exam.id) !== String(deletingExam.id)));
      setHasLoadedCanonicalExamBank(true);
      setCanonicalExamBankLoadFailed(false);
      addToast('Prova arquivada com sucesso.', 'success');

      cancelDeleteExam();
      cancelEditingExam();
    } catch (error) {
      clientLog.warn('Error deleting exam bank record:', error);
      addToast('Não foi possível remover a prova.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const linkedCountByExamId = useMemo(() => {
    const countMap = new Map<string, number>();

    questions.forEach((question) => {
      examBank.forEach((exam) => {
        if (isQuestionLinkedToProva(question, exam.id)) {
          countMap.set(String(exam.id), (countMap.get(String(exam.id)) || 0) + 1);
        }
      });
    });

    return countMap;
  }, [examBank, questions]);

  return {
    examBank,
    filteredExamBank,
    linkedCountByExamId,
    editingExamId,
    examDraft,
    setExamDraft,
    startEditingExam,
    startCreatingExam,
    cancelEditingExam,
    handleSaveExam,
    deletingExam,
    requestDeleteExam,
    cancelDeleteExam,
    handleDeleteExam,
    actionLoading,
    hasMoreExams,
    isLoadingMoreExams,
    loadMoreExams,
  };
};
