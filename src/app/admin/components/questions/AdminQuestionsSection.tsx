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
import { Edit3, FileText, MessageSquare, Sparkles, Trash2 } from 'lucide-react';
import type { Question } from '@types';
import { aiService, questionService } from '@services/questions';
import {
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';
import AdminQuestionAiGenerationModal, {
  type AdminQuestionAiGenerationKind,
  type AdminQuestionAiGenerationResult,
} from './AdminQuestionAiGenerationModal';

interface QuestionsPagination {
  total: number;
  perPage: number;
  pages: number;
  page: number;
}

interface AdminQuestionsSectionProps {
  questions: Question[];
  pagination: QuestionsPagination;
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onCreate: () => void;
  onEdit: (question: Question) => void;
  onUpdate: (question: Question) => Promise<any> | any;
  onDelete: (questionId: string | number) => Promise<any> | any;
  onPageChange: (page: number) => void;
  onRefresh?: () => Promise<void> | void;
}

const AdminQuestionsSection = ({
  questions,
  pagination,
  filter,
  onFilterChange,
  renderSortableHeader,
  onCreate,
  onEdit,
  onUpdate,
  onDelete,
  onPageChange,
  onRefresh,
}: AdminQuestionsSectionProps) => {
  const [pendingDeleteQuestion, setPendingDeleteQuestion] = React.useState<Question | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = React.useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<Set<string>>(new Set());
  const [generatedContentById, setGeneratedContentById] = React.useState<Record<string, Partial<Question>>>({});
  const [generationKind, setGenerationKind] = React.useState<AdminQuestionAiGenerationKind>('teacher');
  const [isGenerationModalOpen, setIsGenerationModalOpen] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [generationCurrentLabel, setGenerationCurrentLabel] = React.useState('');
  const [generationResults, setGenerationResults] = React.useState<AdminQuestionAiGenerationResult[]>([]);
  const [isSavingGeneratedResults, setIsSavingGeneratedResults] = React.useState(false);
  const [savedGenerationById, setSavedGenerationById] = React.useState<Record<string, { teacher?: boolean; detailed?: boolean }>>({});
  const generationRunningRef = React.useRef(false);
  const generationSavePayloadsRef = React.useRef<Record<string, Question>>({});

  const generationIsRunning = generationResults.some((item) => item.status === 'pending' || item.status === 'running');
  const generationHasUnsavedResults = generationResults.some((item) => (
    item.status === 'success' && Boolean(item.result) && !item.isSaved
  ));
  const generationIsBusy = generationIsRunning || isSavingGeneratedResults;

  const getQuestionId = (question: Question) => String((question as any).id ?? '');

  const getQuestionLabel = (question: Question) => {
    const rawTitle = String((question as any).enunciado_clean || (question as any).text || (question as any).enunciado || '').trim();
    const title = rawTitle ? rawTitle.replace(/\s+/g, ' ').slice(0, 90) : 'Questao sem enunciado';
    return `#${(question as any).id ?? '-'} - ${title}${rawTitle.length > 90 ? '...' : ''}`;
  };

  const hasGeneratedContent = (value: unknown) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(value);
  };

  const resolveQuestionAiState = (question: any, generatedContent: Partial<Question>, questionId: string) => {
    const commentsMeta = question?.comentarios || question?.comentários || {};
    const teacherComment = String(
      (generatedContent as any).teacherComment
        || question?.teacherComment
        || question?.teacher_comment
        || '',
    ).trim();
    const detailedComment = String(
      (generatedContent as any).detailedComment
        || question?.detailedComment
        || question?.detailed_comment
        || '',
    ).trim();
    const savedFlags = savedGenerationById[questionId] || {};

    return {
      teacherComment,
      detailedComment,
      hasComment: Boolean(
        savedFlags.teacher
          || question?.hasTeacherComment
          || question?.has_teacher_comment
          || commentsMeta?.professor
          || hasGeneratedContent(teacherComment),
      ),
      hasDetailedAnalysis: Boolean(
        savedFlags.detailed
          || question?.hasDetailedComment
          || question?.has_detailed_comment
          || commentsMeta?.ia
          || hasGeneratedContent(detailedComment),
      ),
    };
  };

  React.useEffect(() => {
    const visibleIds = new Set(questions.map((question) => getQuestionId(question)).filter(Boolean));
    setSelectedQuestionIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [questions]);

  const selectedQuestions = React.useMemo(
    () => questions.filter((question) => selectedQuestionIds.has(getQuestionId(question))),
    [questions, selectedQuestionIds],
  );

  const allVisibleSelected = questions.length > 0 && selectedQuestions.length === questions.length;

  const toggleSelectAllVisible = () => {
    setSelectedQuestionIds((current) => {
      if (allVisibleSelected) {
        return new Set();
      }

      const next = new Set(current);
      questions.forEach((question) => {
        const id = getQuestionId(question);
        if (id) next.add(id);
      });
      return next;
    });
  };

  const toggleQuestionSelection = (question: Question) => {
    const id = getQuestionId(question);
    if (!id) return;

    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateGenerationItem = (id: string, patch: Partial<AdminQuestionAiGenerationResult>) => {
    setGenerationResults((current) => current.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  };

  const openResultModal = async (question: Question, kind: AdminQuestionAiGenerationKind) => {
    const id = getQuestionId(question);
    const label = getQuestionLabel(question);
    const cached = generatedContentById[id] || {};
    const field = kind === 'teacher' ? 'teacherComment' : 'detailedComment';
    const directResult = String((cached as any)[field] || (question as any)[field] || '').trim();

    generationSavePayloadsRef.current = {};
    setGenerationKind(kind);
    setGenerationProgress(directResult ? 100 : 15);
    setGenerationCurrentLabel(directResult ? 'Resultado salvo.' : `Carregando ${label}`);
    setGenerationResults([{
      id,
      label,
      status: directResult ? 'success' : 'running',
      result: directResult || undefined,
      isSaved: Boolean(directResult),
    }]);
    setIsGenerationModalOpen(true);

    if (directResult) {
      return;
    }

    try {
      const fullQuestion = await questionService.getQuestionForAdminEdit(id);
      const result = String((fullQuestion as any)[field] || '').trim();
      updateGenerationItem(id, result
        ? { status: 'success', result, isSaved: true }
        : { status: 'error', error: 'Nenhum conteudo salvo foi encontrado para esta questao.' });
      setGenerationProgress(100);
      setGenerationCurrentLabel(result ? 'Resultado carregado.' : 'Conteudo nao encontrado.');
      if (result) {
        setGeneratedContentById((current) => ({
          ...current,
          [id]: { ...(current[id] || {}), [field]: result },
        }));
      }
    } catch (error: any) {
      updateGenerationItem(id, { status: 'error', error: error?.message || 'Nao foi possivel carregar o resultado.' });
      setGenerationProgress(100);
      setGenerationCurrentLabel('Falha ao carregar resultado.');
    }
  };

  const runAiGeneration = async (targets: Question[], kind: AdminQuestionAiGenerationKind) => {
    const normalizedTargets = targets.filter((question) => getQuestionId(question));
    if (normalizedTargets.length === 0 || generationIsBusy || generationRunningRef.current) {
      return;
    }

    generationRunningRef.current = true;
    generationSavePayloadsRef.current = {};
    setIsSavingGeneratedResults(false);
    setGenerationKind(kind);
    setGenerationProgress(0);
    setGenerationCurrentLabel('Preparando questoes selecionadas...');
    setGenerationResults(normalizedTargets.map((question) => ({
      id: getQuestionId(question),
      label: getQuestionLabel(question),
      status: 'pending',
    })));
    setIsGenerationModalOpen(true);

    try {
      for (let index = 0; index < normalizedTargets.length; index += 1) {
        const question = normalizedTargets[index];
        const id = getQuestionId(question);
        const label = getQuestionLabel(question);
        setGenerationCurrentLabel(`Gerando ${label}`);
        updateGenerationItem(id, { status: 'running' });

        try {
          const fullQuestion = await questionService
            .getQuestionForAdminEdit(id)
            .catch(() => question);
          const generationBase = { ...question, ...fullQuestion } as Question;
          const result = kind === 'teacher'
            ? await aiService.generateTeacherComment(generationBase)
            : await aiService.generateDetailedAnalysis(generationBase);

          const fieldPatch = kind === 'teacher'
            ? { teacherComment: result, hasTeacherComment: true }
            : { detailedComment: result, hasDetailedComment: true };

          generationSavePayloadsRef.current[id] = { ...generationBase, ...fieldPatch } as Question;
          updateGenerationItem(id, { status: 'success', result, isSaved: false, error: undefined });
        } catch (error: any) {
          updateGenerationItem(id, {
            status: 'error',
            error: error?.message || 'Nao foi possivel gerar este conteudo.',
          });
        } finally {
          setGenerationProgress(Math.round(((index + 1) / normalizedTargets.length) * 100));
        }
      }

      setGenerationCurrentLabel('Processamento concluido. Revise e salve os resultados gerados.');
    } finally {
      generationRunningRef.current = false;
    }
  };

  const saveGeneratedResults = async () => {
    if (generationIsRunning || isSavingGeneratedResults) {
      return;
    }

    const pendingResults = generationResults.filter((item) => (
      item.status === 'success' && Boolean(item.result) && !item.isSaved
    ));

    if (pendingResults.length === 0) {
      return;
    }

    setIsSavingGeneratedResults(true);
    setGenerationCurrentLabel('Salvando resultado(s) gerado(s)...');

    let savedCount = 0;

    try {
      for (const item of pendingResults) {
        const payload = generationSavePayloadsRef.current[item.id];
        updateGenerationItem(item.id, { isSaving: true, error: undefined });

        try {
          if (!payload) {
            throw new Error('Nao foi possivel localizar os dados desta questao para salvar.');
          }

          const updateResult = await onUpdate(payload);

          if (updateResult?.success === false) {
            throw new Error(updateResult?.message || 'Nao foi possivel salvar o conteudo gerado.');
          }

          const fieldPatch = generationKind === 'teacher'
            ? { teacherComment: item.result, hasTeacherComment: true }
            : { detailedComment: item.result, hasDetailedComment: true };

          setGeneratedContentById((current) => ({
            ...current,
            [item.id]: { ...(current[item.id] || {}), ...fieldPatch },
          }));
          setSavedGenerationById((current) => ({
            ...current,
            [item.id]: {
              ...(current[item.id] || {}),
              ...(generationKind === 'teacher' ? { teacher: true } : { detailed: true }),
            },
          }));
          updateGenerationItem(item.id, { isSaved: true, isSaving: false, error: undefined });
          delete generationSavePayloadsRef.current[item.id];
          savedCount += 1;
        } catch (error: any) {
          updateGenerationItem(item.id, {
            isSaved: false,
            isSaving: false,
            error: error?.message || 'Nao foi possivel salvar este resultado.',
          });
        }
      }

      setGenerationCurrentLabel(savedCount === pendingResults.length
        ? 'Resultado(s) salvo(s) com sucesso.'
        : 'Alguns resultado(s) nao foram salvos. Confira os avisos abaixo.');
      if (savedCount > 0) {
        await onRefresh?.();
      }
    } finally {
      setIsSavingGeneratedResults(false);
    }
  };

  const formatPublicationDate = (value: unknown) => {
    if (!value) return '-';

    const rawValue = String(value).trim();
    if (!rawValue) return '-';

    const numericValue = Number(rawValue);
    const parsedDate = Number.isFinite(numericValue) && rawValue.length >= 10
      ? new Date(numericValue < 100000000000 ? numericValue * 1000 : numericValue)
      : new Date(rawValue.includes('T') ? rawValue : rawValue.replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime())) {
      return rawValue;
    }

    return parsedDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', '');
  };

  const requestDeleteQuestion = (question: Question) => {
    setPendingDeleteQuestion(question);
  };

  const cancelDeleteQuestion = () => {
    if (!isDeletingQuestion) {
      setPendingDeleteQuestion(null);
    }
  };

  const confirmDeleteQuestion = async () => {
    if (!pendingDeleteQuestion || isDeletingQuestion) {
      return;
    }

    setIsDeletingQuestion(true);
    try {
      await onDelete((pendingDeleteQuestion as any).id);
      setPendingDeleteQuestion(null);
    } catch {
      // O fluxo superior ja exibe o erro; manter o modal aberto permite tentar novamente.
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  const pendingQuestionTitle = String(
    (pendingDeleteQuestion as any)?.enunciado_clean
      || (pendingDeleteQuestion as any)?.text
      || `#${(pendingDeleteQuestion as any)?.id || ''}`,
  ).trim();

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Questoes"
        description="Cadastro, revisao editorial e manutencao do banco principal."
        itemCount={pagination.total}
        itemCountLabel="questoes"
        searchValue={filter}
        onSearchChange={onFilterChange}
        searchPlaceholder="Buscar questoes..."
        primaryActionLabel="Adicionar nova"
        onPrimaryAction={onCreate}
      />

      <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col gap-3 transition-colors duration-300 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Acoes em massa
          </span>
          <button
            type="button"
            disabled={selectedQuestions.length === 0 || generationIsBusy}
            onClick={() => void runAiGeneration(selectedQuestions, 'teacher')}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <MessageSquare size={14} />
            Gerar comentario
          </button>
          <button
            type="button"
            disabled={selectedQuestions.length === 0 || generationIsBusy}
            onClick={() => void runAiGeneration(selectedQuestions, 'detailed')}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <FileText size={14} />
            Gerar analise
          </button>
        </div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {selectedQuestions.length > 0 ? `${selectedQuestions.length} questao(oes) selecionada(s)` : 'Selecione uma ou mais questoes para aplicar a acao.'}
        </span>
      </div>

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden transition-colors duration-300`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Banco principal de questoes</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
            <tr>
              <th className="w-12 p-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label="Selecionar questoes visiveis"
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </th>
              {renderSortableHeader('Questao', 'enunciado_clean')}
              <th className="p-4">ID</th>
              <th className="p-4">Comentario</th>
              <th className="p-4">Analise detalhada</th>
              <th className="p-4">Prova vinculada</th>
              <th className="p-4">Ano</th>
              <th className="p-4">Status</th>
              {renderSortableHeader('Publicacao', 'adminPublicationTimestamp')}
              {renderSortableHeader('Banca/Materia', 'banca')}
              <th className="p-4 text-center">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {questions.map((question: any) => {
              const questionId = getQuestionId(question);
              const generatedContent = generatedContentById[questionId] || {};
              const {
                hasComment,
                hasDetailedAnalysis,
              } = resolveQuestionAiState(question, generatedContent, questionId);

              const linkedExam = Array.isArray(question?.provas) && question.provas.length > 0
                ? question.provas[0]
                : null;

              const linkedExamName = linkedExam?.nome || '-';
              const linkedYear = linkedExam?.ano
                ?? (Array.isArray(question?.anos) && question.anos.length > 0
                  ? Math.max(...question.anos.map((year: any) => Number(year) || 0))
                  : null);

              return (
                <tr key={question.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.has(questionId)}
                      onChange={() => toggleQuestionSelection(question)}
                      aria-label={`Selecionar questao ${question.id ?? ''}`}
                      className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </td>
                  <td className="max-w-[260px] truncate p-4 font-medium text-slate-900 dark:text-slate-100 sm:max-w-md">
                    {question.enunciado_clean || question.text}
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                    #{question.id ?? '-'}
                  </td>

                  <td className="p-4">
                    <button
                      type="button"
                      disabled={generationIsBusy}
                      onClick={() => hasComment
                        ? void openResultModal(question, 'teacher')
                        : void runAiGeneration([question], 'teacher')}
                      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-45 ${
                        hasComment
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                      }`}
                      title={hasComment ? 'Ver comentario' : 'Gerar comentario'}
                    >
                      {hasComment ? <MessageSquare size={12} /> : <Sparkles size={12} />}
                      {hasComment ? 'Ver' : 'Gerar'}
                    </button>
                  </td>

                  <td className="p-4">
                    <button
                      type="button"
                      disabled={generationIsBusy}
                      onClick={() => hasDetailedAnalysis
                        ? void openResultModal(question, 'detailed')
                        : void runAiGeneration([question], 'detailed')}
                      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-45 ${
                        hasDetailedAnalysis
                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                      }`}
                      title={hasDetailedAnalysis ? 'Ver analise detalhada' : 'Gerar analise detalhada'}
                    >
                      {hasDetailedAnalysis ? <FileText size={12} /> : <Sparkles size={12} />}
                      {hasDetailedAnalysis ? 'Ver' : 'Gerar'}
                    </button>
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300 max-w-[220px] truncate" title={linkedExamName}>
                    {linkedExamName}
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300">
                    {linkedYear || '-'}
                  </td>

                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      <AdminPublishStateBadge state={resolveAdminPublishState(question as Record<string, any>)} />
                      {Number(question.anulada) === 1 && (
                        <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                          Anulada
                        </span>
                      )}
                      {Number(question.desatualizada) === 1 && (
                        <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                          Desatualizada
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="whitespace-nowrap p-4 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">{formatPublicationDate(question.adminPublicationDate)}</span>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {question.bancas?.map((banca: any) => banca.sigla).join(' / ') || 'Banca'}
                      </span>
                      <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {question.assuntos
                          ?.map((subject: any) => (subject.materia ? subject.nome : ''))
                          .filter(Boolean)
                          .join(', ') || 'Materia'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(question)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteQuestion(question)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <span className="text-sm text-slate-500 dark:text-slate-400">Mostrando {questions.length} de {pagination.total} questoes</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Anterior
          </button>
          <span className="flex items-center px-4 text-sm font-semibold text-blue-600 dark:text-blue-300">
            Pagina {pagination.page} de {pagination.pages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Proxima
          </button>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={Boolean(pendingDeleteQuestion)}
        title="Excluir questao"
        description={`A questao ${pendingDeleteQuestion ? `#${(pendingDeleteQuestion as any).id}` : ''} sera removida permanentemente. ${pendingQuestionTitle ? `Trecho: "${pendingQuestionTitle.slice(0, 140)}${pendingQuestionTitle.length > 140 ? '...' : ''}"` : ''}`}
        confirmLabel="Excluir permanentemente"
        cancelLabel="Cancelar"
        tone="danger"
        loading={isDeletingQuestion}
        onCancel={cancelDeleteQuestion}
        onConfirm={() => void confirmDeleteQuestion()}
      />

      <AdminQuestionAiGenerationModal
        isOpen={isGenerationModalOpen}
        kind={generationKind}
        progress={generationProgress}
        currentLabel={generationCurrentLabel}
        results={generationResults}
        hasUnsavedResults={generationHasUnsavedResults}
        isSaving={isSavingGeneratedResults}
        onSave={() => void saveGeneratedResults()}
        onClose={() => setIsGenerationModalOpen(false)}
      />
    </div>
  );
};

export default AdminQuestionsSection;
