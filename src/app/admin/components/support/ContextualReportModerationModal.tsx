import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Save,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@providers/ToastProvider';
import {
  adminService,
  type AdminLooseRecord,
  type AdminReportWorkbenchAction,
  type AdminReportWorkbenchPayload,
} from '@services/admin/adminService';
import type { ErrorReport } from '@types';
import {
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import { getReportTargetBadgeClass, getReportTargetLabel, type GroupedReport } from '../reports/reportModeration';

interface ContextualReportModerationModalProps {
  group: GroupedReport;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

type WorkbenchChanges = AdminLooseRecord & {
  answerIndex?: number;
  statement?: string;
  supportText?: string;
  referenceText?: string;
  imageUrl?: string;
  officialText?: string;
  teacherComment?: string;
  teacherCommentId?: number;
  content?: string;
  commentResolution?: 'keep' | 'replace' | 'remove';
};

const getReportDate = (report: ErrorReport) => {
  const raw = Number(report.timestamp || 0);
  const date = raw > 10_000_000_000 ? new Date(raw) : new Date(raw * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const asString = (value: unknown) => String(value ?? '').trim();

const getNestedRecord = (value: unknown): AdminLooseRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as AdminLooseRecord : {}
);

const renderTextBlock = (content: unknown, fallback = 'Conteúdo não informado.') => {
  const text = asString(content);
  return (
    <div className="whitespace-pre-wrap break-words text-sm font-medium leading-7 text-slate-700 dark:text-slate-200">
      {text || fallback}
    </div>
  );
};

const decodeDraftChanges = (draft?: AdminReportWorkbenchPayload['draft']): WorkbenchChanges => {
  const raw = draft?.changes_json;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return getNestedRecord(parsed) as WorkbenchChanges;
    } catch {
      return {};
    }
  }
  return getNestedRecord(raw) as WorkbenchChanges;
};

const getActionTone = (action: AdminReportWorkbenchAction) => {
  if (action.destructive) return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100';
  if (action.mutatesTarget) return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100';
  return 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100';
};

const buildDefaultResponse = (
  workbench: AdminReportWorkbenchPayload | undefined,
  action: AdminReportWorkbenchAction | undefined,
) => {
  const isRequest = workbench?.configuration.reportType === 'request';
  const targetLabel = workbench?.target.label || getReportTargetLabel((workbench?.report.targetType || 'comment') as ErrorReport['targetType']);

  if (!action) {
    return isRequest
      ? `Olá! Recebemos sua solicitação sobre ${targetLabel}. A equipe vai analisar o conteúdo e retornar assim que houver uma decisão.`
      : `Olá! Recebemos sua denúncia sobre ${targetLabel}. Obrigado por ajudar a manter o ConcursoMestre mais preciso.`;
  }

  if (action.slug.startsWith('reject')) {
    return `Olá! Sua solicitação sobre ${targetLabel} foi analisada pela equipe. Neste momento, não encontramos elementos suficientes para aplicar uma alteração, mas o registro ficará no histórico para acompanhamento.`;
  }

  if (action.slug === 'keep_current_content') {
    return `Olá! Revisamos o conteúdo informado em ${targetLabel} e, com base nas evidências atuais, ele foi mantido sem alteração. Agradecemos pela colaboração.`;
  }

  if (action.slug.includes('comment')) {
    return `Olá! Sua solicitação sobre ${targetLabel} foi analisada. O conteúdo recebeu tratamento editorial e a atualização ficará disponível na plataforma. Obrigado pela contribuição.`;
  }

  if (action.slug.includes('formatting')) {
    return `Olá! Revisamos o conteúdo informado em ${targetLabel} e aplicamos o ajuste de formatação necessário. Obrigado por avisar.`;
  }

  if (action.slug.includes('spam') || action.slug.includes('remove') || action.slug.includes('hide')) {
    return `Olá! A denúncia foi analisada e aplicamos a medida adequada ao conteúdo informado conforme as diretrizes da comunidade.`;
  }

  if (action.mutatesTarget) {
    return `Olá! Sua denúncia sobre ${targetLabel} foi analisada e a correção foi aplicada pela equipe. Agradecemos por contribuir com a qualidade da plataforma.`;
  }

  return `Olá! Sua solicitação foi analisada pela equipe ConcursoMestre e recebeu o encaminhamento adequado. Obrigado pela colaboração.`;
};

const getSuggestionKind = (actionSlug: string) => {
  if (actionSlug.includes('legal')) return 'legal_text';
  if (actionSlug.includes('statement') || actionSlug.includes('formatting')) return 'correction';
  if (actionSlug.includes('comment')) return 'teacher_comment';
  return 'moderation_response';
};

const getPrimaryContent = (workbench: AdminReportWorkbenchPayload | undefined) => {
  const current = getNestedRecord(workbench?.target.current);
  const type = workbench?.target.type || workbench?.report.targetType;

  if (type === 'question') {
    return {
      title: 'Questão',
      main: current.statement,
      support: current.supportText,
      reference: current.referenceText,
      options: Array.isArray(current.options) ? current.options : [],
      answerIndex: Number(current.answerIndex ?? 0),
      teacherComment: current.teacherComment,
      detailedComment: current.detailedComment,
    };
  }

  if (type === 'law_section') {
    const article = getNestedRecord(current.article);
    const law = getNestedRecord(current.law);
    const section = getNestedRecord(current.section);
    return {
      title: `${asString(law.shortTitle || law.title) || 'Lei comentada'}${asString(article.number) ? ` - Art. ${article.number}` : ''}`,
      main: article.officialText,
      support: section.title || section.titleName || section.chapterName,
      teacherComments: Array.isArray(current.teacherComments) ? current.teacherComments : [],
      doctrine: Array.isArray(current.doctrine) ? current.doctrine : [],
      precedents: Array.isArray(current.precedents) ? current.precedents : [],
    };
  }

  if (type === 'material') {
    return {
      title: current.title || 'Material',
      main: current.description,
      support: current.status,
    };
  }

  return {
    title: current.targetLabel || 'Comentário',
    main: current.content,
    support: current.status,
    authorName: current.authorName,
  };
};

const getFirstTeacherCommentId = (workbench: AdminReportWorkbenchPayload | undefined) => {
  const current = getNestedRecord(workbench?.target.current);
  const comments = Array.isArray(current.teacherComments) ? current.teacherComments : [];
  const first = comments[0] && typeof comments[0] === 'object' ? comments[0] as AdminLooseRecord : null;
  return Number(first?.id || 0);
};

const ContextualReportModerationModal = ({ group, onClose, onDone }: ContextualReportModerationModalProps) => {
  const { addToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const report = group.lastReport;
  const [selectedActionSlug, setSelectedActionSlug] = useState('');
  const [changes, setChanges] = useState<WorkbenchChanges>({});
  const [userResponse, setUserResponse] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [justification, setJustification] = useState('');

  const workbenchQuery = useQuery({
    queryKey: ['admin', 'report-workbench', report.id],
    queryFn: () => adminService.getReportWorkbench(report.id),
    staleTime: 0,
  });

  const workbench = workbenchQuery.data;
  const selectedAction = useMemo(
    () => (workbench?.configuration.actions || []).find((action) => action.slug === selectedActionSlug),
    [selectedActionSlug, workbench?.configuration.actions],
  );
  const content = useMemo(() => getPrimaryContent(workbench), [workbench]);

  useEffect(() => {
    if (!workbench || selectedActionSlug) return;
    const draftChanges = decodeDraftChanges(workbench.draft);
    const initialAction = asString(workbench.draft?.action_slug) || workbench.configuration.actions[0]?.slug || '';
    setSelectedActionSlug(initialAction);
    setChanges({
      ...draftChanges,
      statement: draftChanges.statement ?? asString(getNestedRecord(workbench.target.current).statement),
      officialText: draftChanges.officialText ?? asString(getNestedRecord(getNestedRecord(workbench.target.current).article).officialText),
      content: draftChanges.content ?? asString(getNestedRecord(workbench.target.current).content),
      teacherCommentId: Number(draftChanges.teacherCommentId || getFirstTeacherCommentId(workbench) || 0),
    });
    setUserResponse(asString(workbench.draft?.user_response));
    setInternalNote(asString(workbench.draft?.internal_note));
  }, [selectedActionSlug, workbench]);

  useEffect(() => {
    if (!workbench || !selectedAction || userResponse.trim()) return;
    setUserResponse(buildDefaultResponse(workbench, selectedAction));
  }, [selectedAction, userResponse, workbench]);

  const saveDraftMutation = useMutation({
    mutationFn: () => adminService.saveReportModerationDraft({
      report_id: report.id,
      action_slug: selectedActionSlug,
      changes,
      user_response: userResponse,
      internal_note: internalNote,
    }),
    onSuccess: () => addToast('Rascunho da moderação salvo.', 'success'),
    onError: (error) => addToast(error instanceof Error ? error.message : 'Não foi possível salvar o rascunho.', 'error'),
  });

  const suggestionMutation = useMutation({
    mutationFn: () => adminService.generateReportModerationSuggestion({
      report_id: report.id,
      kind: getSuggestionKind(selectedActionSlug),
    }),
    onSuccess: (suggestion) => {
      const text = suggestion.text || '';
      if (selectedActionSlug.includes('legal') || selectedActionSlug === 'fix_legal_formatting') {
        setChanges((current) => ({ ...current, officialText: text }));
      } else if (selectedActionSlug.includes('statement') || selectedActionSlug === 'fix_question_formatting') {
        setChanges((current) => ({ ...current, statement: text }));
      } else if (selectedActionSlug === 'edit_comment') {
        setChanges((current) => ({ ...current, content: text }));
      } else {
        setChanges((current) => ({ ...current, teacherComment: text }));
      }
      addToast('Sugestão gerada. Revise antes de aplicar.', 'success');
    },
    onError: (error) => addToast(error instanceof Error ? error.message : 'Não foi possível gerar a sugestão.', 'error'),
  });

  const applyMutation = useMutation({
    mutationFn: () => adminService.applyReportModeration({
      report_id: report.id,
      report_ids: group.reports.map((item) => item.id),
      action_slug: selectedActionSlug,
      changes,
      justification,
      user_response: userResponse,
      internal_note: internalNote,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-data', 'reports'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'comments-moderation'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'comments-moderation-counts'] }),
      ]);
      addToast('Moderação concluída e resposta preparada para o usuário.', 'success');
      await onDone();
      onClose();
    },
    onError: (error) => addToast(error instanceof Error ? error.message : 'Não foi possível concluir a moderação.', 'error'),
  });

  const updateChange = (key: keyof WorkbenchChanges, value: unknown) => {
    setChanges((current) => ({ ...current, [key]: value }));
  };

  const renderActionFields = () => {
    if (!selectedAction) return null;
    const fields = selectedAction.fields || [];
    const showTeacherComment = fields.includes('teacherComment');

    return (
      <div className="space-y-4">
        {fields.includes('answerIndex') ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Novo gabarito</span>
            <select
              value={Number(changes.answerIndex ?? content.answerIndex ?? 0)}
              onChange={(event) => updateChange('answerIndex', Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-800 dark:bg-slate-950"
            >
              {(content.options || []).map((option: unknown, index: number) => (
                <option key={index} value={index}>
                  Alternativa {String.fromCharCode(65 + index)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {fields.includes('statement') ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Enunciado revisado</span>
            <textarea value={asString(changes.statement)} onChange={(event) => updateChange('statement', event.target.value)} rows={6} className={`${ADMIN_TEXTAREA_CLASS} mt-2 w-full`} />
          </label>
        ) : null}

        {fields.includes('officialText') ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Texto legal revisado</span>
            <textarea value={asString(changes.officialText)} onChange={(event) => updateChange('officialText', event.target.value)} rows={7} className={`${ADMIN_TEXTAREA_CLASS} mt-2 w-full`} />
          </label>
        ) : null}

        {fields.includes('content') ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Comentário revisado</span>
            <textarea value={asString(changes.content)} onChange={(event) => updateChange('content', event.target.value)} rows={5} className={`${ADMIN_TEXTAREA_CLASS} mt-2 w-full`} />
          </label>
        ) : null}

        {fields.includes('imageUrl') ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Nova URL da mídia</span>
            <input value={asString(changes.imageUrl)} onChange={(event) => updateChange('imageUrl', event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-800 dark:bg-slate-950" />
          </label>
        ) : null}

        {fields.includes('teacherCommentId') ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Comentário existente</span>
            <select
              value={Number(changes.teacherCommentId || 0)}
              onChange={(event) => updateChange('teacherCommentId', Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-800 dark:bg-slate-950"
            >
              <option value={0}>Selecione</option>
              {(content.teacherComments || []).map((item: unknown) => {
                const record = getNestedRecord(item);
                return <option key={String(record.id)} value={Number(record.id)}>{asString(record.title || record.body).slice(0, 80)}</option>;
              })}
            </select>
          </label>
        ) : null}

        {showTeacherComment ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Comentário que será publicado</span>
            <textarea value={asString(changes.teacherComment)} onChange={(event) => updateChange('teacherComment', event.target.value)} rows={7} className={`${ADMIN_TEXTAREA_CLASS} mt-2 w-full`} />
          </label>
        ) : null}
      </div>
    );
  };

  const canOpenTarget = asString(workbench?.target?.url);
  const isBusy = applyMutation.isPending || saveDraftMutation.isPending || suggestionMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <div className={`${ADMIN_MODAL_PANEL_CLASS} my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col shadow-2xl sm:my-4 sm:max-h-[calc(100dvh-2rem)]`}>
        <div className={`${ADMIN_MODAL_HEADER_CLASS} shrink-0`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                <Shield size={13} />
                {workbench?.configuration.reportType === 'request' ? 'Moderação de solicitação' : 'Moderação de denúncia'}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{report.id}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">Pendente</span>
            </div>
            <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              {workbench?.configuration.title || 'Carregando moderação...'}
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Revise o contexto, escolha uma ação real e edite a resposta que será enviada ao usuário.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-sm border border-slate-300 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Fechar moderação">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {workbenchQuery.isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={30} />
            </div>
          ) : workbenchQuery.isError ? (
            <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
              Não foi possível carregar o contexto desta moderação.
            </div>
          ) : (
            <div className="space-y-5 p-4 sm:p-6">
              <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">1. Informações do atendimento</p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Tipo</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getReportTargetBadgeClass(report.targetType)}`}>
                      {getReportTargetLabel(report.targetType)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Item</p>
                    <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{workbench?.target.label || report.targetLabel || '-'}</p>
                    {canOpenTarget ? (
                      <button type="button" onClick={() => router.push(canOpenTarget)} className="mt-1 inline-flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-700">
                        Ver na plataforma <ExternalLink size={12} />
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Solicitante</p>
                    <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{workbench?.report.reporter?.name || report.userName || '-'}</p>
                    <p className="text-xs font-medium text-slate-500">{workbench?.report.reporter?.email || report.email || ''}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Data</p>
                    <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">{workbench?.report.createdAt ? new Date(workbench.report.createdAt).toLocaleString('pt-BR') : getReportDate(report)}</p>
                    {group.reports.length > 1 ? <p className="text-xs font-bold text-rose-600">{group.reports.length} registros agrupados</p> : null}
                  </div>
                </div>
              </section>

              <section className={`${ADMIN_MUTED_SURFACE_CLASS} border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/10`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">2. Motivo e contexto</p>
                <h4 className="mt-3 text-lg font-black text-slate-900 dark:text-slate-100">{workbench?.report.reason || report.reason}</h4>
                <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">{workbench?.report.details || report.details || 'Sem detalhes adicionais.'}</p>
              </section>

              <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">3. Conteúdo denunciado ou solicitado</p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100">{asString(content.title)}</h4>
                  {content.support ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{asString(content.support)}</p> : null}
                  <div className="mt-4">{renderTextBlock(content.main, workbench?.target.exists === false ? workbench.target.error : 'Conteúdo não encontrado.')}</div>
                  {content.options?.length ? (
                    <div className="mt-4 space-y-2">
                      {content.options.map((option: unknown, index: number) => {
                        const record = typeof option === 'object' && option !== null ? option as AdminLooseRecord : {};
                        const text = asString(record.text || record.label || option);
                        const correct = Number(content.answerIndex || 0) === index;
                        return (
                          <div key={index} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                            {String.fromCharCode(65 + index)}. {text}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </section>

              {content.teacherComment || content.detailedComment || content.teacherComments?.length ? (
                <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">4. Conteúdo editorial existente</p>
                  {content.teacherComment ? <div className="mt-3 rounded-xl border border-slate-200 p-4">{renderTextBlock(content.teacherComment)}</div> : null}
                  {content.detailedComment ? <div className="mt-3 rounded-xl border border-slate-200 p-4">{renderTextBlock(content.detailedComment)}</div> : null}
                  {(content.teacherComments || []).map((item: unknown) => {
                    const record = getNestedRecord(item);
                    return (
                      <div key={String(record.id)} className="mt-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{asString(record.title || 'Comentário do professor')}</p>
                        <div className="mt-2">{renderTextBlock(record.body || record.content)}</div>
                      </div>
                    );
                  })}
                </section>
              ) : null}

              <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">5. Ações de moderação</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(workbench?.configuration.actions || []).map((action) => {
                    const selected = selectedActionSlug === action.slug;
                    return (
                      <button
                        key={action.slug}
                        type="button"
                        onClick={() => {
                          setSelectedActionSlug(action.slug);
                          setUserResponse(buildDefaultResponse(workbench, action));
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${selected ? 'ring-2 ring-indigo-500' : ''} ${getActionTone(action)}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-black">{action.label}</span>
                          {selected ? <CheckCircle2 size={18} /> : null}
                        </span>
                        <span className="mt-3 block text-xs font-bold leading-5 opacity-75">
                          {action.mutatesTarget ? 'Altera o conteúdo real ao concluir.' : action.finalizes === false ? 'Encaminha sem encerrar o caso.' : 'Registra a decisão sem alterar o conteúdo.'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">Resultado ou alteração gerada</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">Revise antes de aplicar. Nada é publicado sem concluir a moderação.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => suggestionMutation.mutate()}
                      disabled={!selectedActionSlug || suggestionMutation.isPending}
                      className={ADMIN_SECONDARY_BUTTON_CLASS}
                    >
                      {suggestionMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                      Gerar sugestão
                    </button>
                  </div>
                  <div className="mt-4">{renderActionFields()}</div>
                </div>
              </section>

              <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-indigo-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">6. Resposta ao usuário</p>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">Será enviada por e-mail</span>
                </div>
                <textarea value={userResponse} onChange={(event) => setUserResponse(event.target.value)} rows={6} className={`${ADMIN_TEXTAREA_CLASS} mt-4 w-full`} />
              </section>

              <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">7. Nota interna da equipe</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Opcional. Essa anotação fica só no histórico administrativo e não será enviada ao usuário.</p>
                <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={4} className={`${ADMIN_TEXTAREA_CLASS} mt-4 w-full`} />
                <label className="mt-4 block">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Resumo da decisão</span>
                  <input value={justification} onChange={(event) => setJustification(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-800 dark:bg-slate-950" placeholder="Ex.: comentário criado e publicado no item solicitado." />
                </label>
              </section>
            </div>
          )}
        </div>

        <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex shrink-0 flex-col gap-3 sm:flex-row sm:justify-end`}>
          <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON_CLASS}>Fechar</button>
          <button type="button" onClick={() => saveDraftMutation.mutate()} disabled={isBusy || !workbench} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            {saveDraftMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => applyMutation.mutate()}
            disabled={isBusy || !selectedActionSlug || !userResponse.trim() || !workbench}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            {applyMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            Concluir e enviar resposta
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ContextualReportModerationModal;
