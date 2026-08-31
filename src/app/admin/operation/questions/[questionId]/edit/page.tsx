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
import { getReportTargetId } from '../../../../components/reports/reportModeration';
import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../../../../components/shared/adminPanelStyles';

const resolveQuestionId = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const getReportResolutionText = (report: ErrorReport | null) => {
  if (!report) {
    return 'Questão revisada pela moderação administrativa.';
  }

  return `Questão revisada a partir da denúncia "${report.reason || 'sem motivo informado'}".`;
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

  const linkedReports = React.useMemo(() => {
    if (!reportId || !questionId || isNewQuestion) {
      return linkedReport ? [linkedReport] : [];
    }

    const normalizedQuestionId = String(questionId || '');
    const relatedReports = reports.filter((report: ErrorReport) => (
      report.targetType === 'question'
      && report.status === 'pending'
      && String(getReportTargetId(report) || '') === normalizedQuestionId
    ));

    if (linkedReport && !relatedReports.some((report) => String(report.id) === String(linkedReport.id))) {
      return [linkedReport, ...relatedReports];
    }

    return relatedReports;
  }, [isNewQuestion, linkedReport, questionId, reportId, reports]);

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
        setLoadError('ID da questão não informado.');
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

    if (questionLoadKeyRef.current === normalizedQuestionId && loadError) {
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
          setLoadError('Questão não encontrada.');
          setQuestion(null);
          return;
        }

        setQuestion(payload);
      })
      .catch((error) => {
        if (!isCurrent) return;
        clientLog.warn('Error loading question for admin edit:', error);
        setLoadError('Não foi possível carregar esta questão.');
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
        throw new Error('Falha ao criar a questão.');
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
        throw new Error('Falha ao atualizar a questão.');
      }
      upsertQuestion(payload);

      const pendingLinkedReports = linkedReports.filter((report) => report.status === 'pending');
      if (pendingLinkedReports.length > 0) {
        await Promise.all(pendingLinkedReports.map((report) => resolveReport(
          report.id,
          'resolved',
          getReportResolutionText(report),
          report.evidenceUrl,
        )));
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
    report: ErrorReport,
    status: 'resolved' | 'ignored',
  ) => {
    if (!report || report.status !== 'pending') {
      return;
    }

    setIsResolvingReportInline(true);
    try {
      await resolveReport(
        report.id,
        status,
        status === 'resolved'
          ? getReportResolutionText(report)
          : 'Denúncia analisada e ignorada pela moderação administrativa.',
        report.evidenceUrl,
      );
    } catch (error) {
      clientLog.warn('Error resolving linked report inline:', error);
    } finally {
      setIsResolvingReportInline(false);
    }
  }, [resolveReport]);

  const renderAdminShell = (children: React.ReactNode) => (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="questions"
      pageTitle="Questões"
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
            {linkedReport ? 'Denúncia vinculada' : reportId ? 'Carregando denúncia' : 'Edição administrativa'}
          </p>
          <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
            {linkedReport?.reason || 'Revise exatamente o conteúdo desta questão antes de salvar.'}
          </p>
          <p className="mt-1 max-w-4xl text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
            {linkedReport?.details || (reportId && !isReportsLoaded ? 'Aguarde enquanto o contexto da denúncia é carregado.' : 'Ao salvar, você volta para a fila administrativa correspondente.')}
          </p>
          {linkedReport ? (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Denunciante: {linkedReport.userName || 'Não informado'} - ID #{linkedReport.id}
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
              onClick={() => linkedReport && void handleResolveLinkedReportInline(linkedReport, 'ignored')}
              disabled={isResolvingReportInline}
              className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300"
            >
              {isResolvingReportInline ? <Loader2 size={13} className="animate-spin" /> : null}
              Ignorar denúncia
            </button>
            <button
              type="button"
              onClick={() => linkedReport && void handleResolveLinkedReportInline(linkedReport, 'resolved')}
              disabled={isResolvingReportInline}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {isResolvingReportInline ? <Loader2 size={13} className="animate-spin" /> : null}
              Resolver denúncia
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  const additionalLinkedReportsContext = linkedReports.length > 1 ? (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Outras denúncias desta questão
      </p>
      <div className="divide-y divide-slate-200 border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
        {linkedReports.slice(1).map((report) => (
          <div key={report.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">{report.reason}</p>
              <p className="mt-1 max-w-4xl text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                {report.details || 'Sem detalhes adicionais.'}
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Denunciante: {report.userName || 'Não informado'} - ID #{report.id}
              </p>
            </div>
            {report.status === 'pending' ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleResolveLinkedReportInline(report, 'ignored')}
                  disabled={isResolvingReportInline}
                  className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300"
                >
                  Ignorar
                </button>
                <button
                  type="button"
                  onClick={() => void handleResolveLinkedReportInline(report, 'resolved')}
                  disabled={isResolvingReportInline}
                  className={ADMIN_PRIMARY_BUTTON_CLASS}
                >
                  Resolver
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  if (isAuthLoading || isQuestionLoading) {
    return renderAdminShell(
      <div className="flex min-h-[360px] items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="inline-flex items-center gap-3 rounded-sm border border-slate-300 bg-white px-5 py-4 text-sm font-bold shadow-none dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="animate-spin" size={18} />
          Carregando editor da questão...
        </div>
      </div>,
    );
  }

  if (!canAccessAdminPanel(currentUser)) {
    return null;
  }

  if (!loadError && (isNewQuestion || question) && !editor.isManualQuestionModalOpen) {
    return renderAdminShell(
      <div className="flex min-h-[360px] items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="inline-flex items-center gap-3 rounded-sm border border-slate-300 bg-white px-5 py-4 text-sm font-bold shadow-none dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="animate-spin" size={18} />
          Preparando editor da questão...
        </div>
      </div>,
    );
  }

  if (loadError || (!isNewQuestion && !question)) {
    return renderAdminShell(
      <div className="flex min-h-[360px] items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-sm border border-slate-300 bg-white p-8 text-center shadow-none dark:border-slate-700 dark:bg-slate-900">
          <ShieldCheck className="mx-auto text-rose-500" size={32} />
          <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-slate-100">
            Não foi possível abrir o editor
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {loadError || 'A questão ainda está sendo preparada para edição.'}
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
      reportContext={reportId ? (
        <>
          {reportContext}
          {additionalLinkedReportsContext}
        </>
      ) : undefined}
      onClose={closeEditor}
    />,
  );
};

export default AdminQuestionEditPage;
