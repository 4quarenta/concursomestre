'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { ErrorReport, Question } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import { clientLog } from '@services/monitoring/clientLog';
import { questionService } from '@services/questions';
import { useAdminDataActions } from '@/state/admin-data/useAdminDataActions';
import { useAdminDataStore } from '@/state/admin-data/adminDataStore';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { useQuestionBankStore } from '@/state/question-bank/questionBankStore';
import AdminQuestionEditorPage from '../../../../components/questions/AdminQuestionEditorPage';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { useAdminManualQuestionEditor } from '../../../../components/questions/useAdminManualQuestionEditor';
import { buildAdminPath, buildAdminQuestionEditPath } from '../../../../config/adminPageNavigationConfig';
import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../../../../components/shared/adminPanelStyles';

const resolveQuestionId = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const getReportResolutionText = (report: ErrorReport | null) => {
  if (!report) {
    return 'Questao revisada pela moderacao administrativa.';
  }

  return `Questao revisada a partir da denuncia "${report.reason || 'sem motivo informado'}".`;
};

const AdminQuestionEditPage = () => {
  const params = useParams<{ questionId?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionId = resolveQuestionId(params.questionId);
  const isNewQuestion = String(questionId || '') === 'new';
  const reportId = searchParams.get('report');
  const returnPath = reportId
    ? buildAdminPath('support', 'reports')
    : buildAdminPath('operation', 'questions');

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const questions = useQuestionBankStore((store) => store.questions);
  const prependQuestion = useQuestionBankStore((store) => store.prependQuestion);
  const upsertQuestion = useQuestionBankStore((store) => store.upsertQuestion);
  const reports = useAdminDataStore((store) => store.reports);
  const isReportsLoaded = useAdminDataStore((store) => store.isReportsLoaded);
  const systemSettings = useAppConfigStore((store) => store.systemSettings);
  const { ensureReportsLoaded, resolveReport } = useAdminDataActions();
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();

  const [question, setQuestion] = React.useState<Question | null>(null);
  const [isQuestionLoading, setIsQuestionLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [isResolvingReportInline, setIsResolvingReportInline] = React.useState(false);
  const openedQuestionIdRef = React.useRef<string | null>(null);
  const questionLoadKeyRef = React.useRef('');
  const questionLoadPromiseRef = React.useRef<Promise<void> | null>(null);

  const linkedReport = React.useMemo(
    () => reports.find((report: ErrorReport) => String(report.id) === String(reportId || '')) || null,
    [reportId, reports],
  );

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!canAccessAdminPanel(currentUser)) {
      return;
    }

    void ensureTaxonomiesLoaded();

    if (reportId) {
      void ensureReportsLoaded();
    }
  }, [currentUser, ensureReportsLoaded, ensureTaxonomiesLoaded, isAuthLoading, reportId]);

  React.useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!canAccessAdminPanel(currentUser)) {
      return;
    }

    if (!questionId) {
      questionLoadKeyRef.current = '';
      questionLoadPromiseRef.current = null;
      const frameId = window.requestAnimationFrame(() => {
        setLoadError('ID da questao nao informado.');
        setIsQuestionLoading(false);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    if (isNewQuestion) {
      questionLoadKeyRef.current = 'new';
      questionLoadPromiseRef.current = null;
      const frameId = window.requestAnimationFrame(() => {
        setQuestion(null);
        setLoadError('');
        setIsQuestionLoading(false);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const normalizedQuestionId = String(questionId || '').trim();
    if (!normalizedQuestionId) {
      return;
    }

    if (
      questionLoadPromiseRef.current
      && questionLoadKeyRef.current === normalizedQuestionId
    ) {
      return;
    }

    if (
      questionLoadKeyRef.current === normalizedQuestionId
      && question
      && String(question.id || '') === normalizedQuestionId
      && !loadError
    ) {
      return;
    }

    let isCurrent = true;
    const frameId = window.requestAnimationFrame(() => {
      if (!isCurrent) return;
      setIsQuestionLoading(true);
      setLoadError('');
    });

    const localQuestion = questions.find((item: Question) => String(item.id) === normalizedQuestionId);

    if (localQuestion) {
      questionLoadKeyRef.current = normalizedQuestionId;
      questionLoadPromiseRef.current = null;
      const localFrameId = window.requestAnimationFrame(() => {
        if (!isCurrent) return;
        setQuestion(localQuestion);
        setIsQuestionLoading(false);
      });
      return () => {
        isCurrent = false;
        window.cancelAnimationFrame(frameId);
        window.cancelAnimationFrame(localFrameId);
      };
    }

    const request = questionService.getQuestionForAdminEdit(normalizedQuestionId)
      .then((payload) => {
        if (!isCurrent) return;

        if (!payload || !payload.id) {
          setLoadError('Questao nao encontrada.');
          setQuestion(null);
          return;
        }

        setQuestion(payload);
      })
      .catch((error) => {
        if (!isCurrent) return;
        clientLog.warn('Error loading question for admin edit:', error);
        setLoadError('Nao foi possivel carregar esta questao.');
      })
      .finally(() => {
        if (isCurrent) {
          setIsQuestionLoading(false);
        }
        if (questionLoadKeyRef.current === normalizedQuestionId) {
          questionLoadPromiseRef.current = null;
        }
      });
    questionLoadKeyRef.current = normalizedQuestionId;
    questionLoadPromiseRef.current = request.then(() => undefined);

    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [currentUser, isAuthLoading, isNewQuestion, loadError, question, questionId, questions]);

  const editor = useAdminManualQuestionEditor({
    questions: question ? [question] : [],
    systemSettings,
    addToast,
    onAddQuestion: async (payload: Question) => {
      const response = await questionService.createQuestions([payload]);
      if (!response.success) {
        throw new Error('Falha ao criar a questao.');
      }

      const createdQuestion = response?.created?.[0] || payload;
      prependQuestion(createdQuestion);

      if (createdQuestion?.id) {
        router.replace(buildAdminQuestionEditPath(createdQuestion.id));
      } else {
        router.push(returnPath);
      }

      return response;
    },
    onUpdateQuestion: async (payload: Question) => {
      const response = await questionService.updateQuestion(String(payload.id), payload);
      if (!response.success) {
        throw new Error('Falha ao atualizar a questao.');
      }
      upsertQuestion(payload);

      if (linkedReport && linkedReport.status === 'pending') {
        await resolveReport(
          linkedReport.id,
          'resolved',
          getReportResolutionText(linkedReport),
          linkedReport.evidenceUrl,
        );
      }

      router.push(returnPath);
      return response;
    },
    onRefreshQuestions: async () => undefined,
    replaceExtractedQuestion: () => undefined,
  });

  React.useEffect(() => {
    if (isNewQuestion) {
      if (openedQuestionIdRef.current === 'new') {
        return;
      }

      editor.openManualModal();
      openedQuestionIdRef.current = 'new';
      return;
    }

    if (!question?.id || openedQuestionIdRef.current === String(question.id)) {
      return;
    }

    editor.openManualModal(question);
    openedQuestionIdRef.current = String(question.id);
  }, [editor, isNewQuestion, question]);

  const closeEditor = () => {
    router.push(returnPath);
  };

  const handleResolveLinkedReportInline = React.useCallback(async (
    status: 'resolved' | 'ignored',
  ) => {
    if (!linkedReport || linkedReport.status !== 'pending') {
      return;
    }

    setIsResolvingReportInline(true);
    try {
      await resolveReport(
        linkedReport.id,
        status,
        status === 'resolved'
          ? getReportResolutionText(linkedReport)
          : 'Denuncia analisada e ignorada pela moderacao administrativa.',
        linkedReport.evidenceUrl,
      );
    } catch (error) {
      clientLog.warn('Error resolving linked report inline:', error);
    } finally {
      setIsResolvingReportInline(false);
    }
  }, [linkedReport, resolveReport]);

  const renderAdminShell = (children: React.ReactNode) => (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="questions"
      pageTitle="Questoes"
      showPageHeader={false}
    >
      {children}
    </AdminStandaloneShell>
  );

  const reportContext = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex gap-3">
        <div className="mt-1 rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle size={18} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
            {linkedReport ? 'Denuncia vinculada' : reportId ? 'Carregando denuncia' : 'Edicao administrativa'}
          </p>
          <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
            {linkedReport?.reason || 'Revise exatamente o conteudo desta questao antes de salvar.'}
          </p>
          <p className="mt-1 max-w-4xl text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
            {linkedReport?.details || (reportId && !isReportsLoaded ? 'Aguarde enquanto o contexto da denuncia e carregado.' : 'Ao salvar, voce volta para a fila administrativa correspondente.')}
          </p>
          {linkedReport ? (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Denunciante: {linkedReport.userName || 'Nao informado'} - ID #{linkedReport.id}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {linkedReport?.evidenceUrl ? (
          <a
            href={linkedReport.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            <ExternalLink size={13} /> Ver prova
          </a>
        ) : null}
        <button
          type="button"
          onClick={closeEditor}
          className={ADMIN_SECONDARY_BUTTON_CLASS}
        >
          <ArrowLeft size={13} /> Voltar
        </button>
        {linkedReport?.status === 'pending' ? (
          <>
            <button
              type="button"
              onClick={() => void handleResolveLinkedReportInline('ignored')}
              disabled={isResolvingReportInline}
              className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300"
            >
              {isResolvingReportInline ? <Loader2 size={13} className="animate-spin" /> : null}
              Ignorar denuncia
            </button>
            <button
              type="button"
              onClick={() => void handleResolveLinkedReportInline('resolved')}
              disabled={isResolvingReportInline}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {isResolvingReportInline ? <Loader2 size={13} className="animate-spin" /> : null}
              Resolver denuncia
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  if (isAuthLoading || isQuestionLoading) {
    return renderAdminShell(
      <div className="flex min-h-[360px] items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="inline-flex items-center gap-3 rounded-sm border border-slate-300 bg-white px-5 py-4 text-sm font-bold shadow-none dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="animate-spin" size={18} />
          Carregando editor da questao...
        </div>
      </div>,
    );
  }

  if (!canAccessAdminPanel(currentUser)) {
    return null;
  }

  if (loadError || (!isNewQuestion && !question) || !editor.isManualQuestionModalOpen) {
    return renderAdminShell(
      <div className="flex min-h-[360px] items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-sm border border-slate-300 bg-white p-8 text-center shadow-none dark:border-slate-700 dark:bg-slate-900">
          <ShieldCheck className="mx-auto text-rose-500" size={32} />
          <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-slate-100">
            Nao foi possivel abrir o editor
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {loadError || 'A questao ainda esta sendo preparada para edicao.'}
          </p>
          <button
            type="button"
            onClick={closeEditor}
            className={`mt-6 ${ADMIN_PRIMARY_BUTTON_CLASS}`}
          >
            Voltar ao admin
          </button>
        </div>
      </div>,
    );
  }

  return renderAdminShell(
    <AdminQuestionEditorPage
      {...editor.manualQuestionModalProps}
      reportContext={reportId ? reportContext : undefined}
      onClose={closeEditor}
    />,
  );
};

export default AdminQuestionEditPage;
