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

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, CheckCircle2, Filter, Gift, Loader2, MessageSquare, Search, Send, Star, UserRound } from 'lucide-react';
import { adminService, type AdminFeedbackOperator, type AdminFeedbackReply, type AdminFeedbackThread } from '@services/admin/adminService';
import { clientLog } from '@services/monitoring/clientLog';
import {
  compactSupportText,
  getSupportPresentationType,
  getSupportThreadExpandedBlocks,
  getSupportThreadPreview,
  getSupportThreadTitle,
  getSupportTypeLabel,
  isFeedbackInboxThread,
  isOperationalSupportThread,
  parseEditorialRequestDetails,
} from '@services/support';
import { AdminDataTable } from '../shared/AdminDesignSystem';
import { useToast } from '@providers/ToastProvider';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import { buildAdminLawEditPath } from '../../config/adminPageNavigationConfig';

const STATUS_LABELS: Record<AdminFeedbackThread['status'], string> = {
  new: 'Novo',
  read: 'Lido',
  resolved: 'Resolvido',
};

const STATUS_TONE: Record<AdminFeedbackThread['status'], string> = {
  new: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  read: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300',
  resolved: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
};

const FEEDBACK_REPLY_TEMPLATES: Record<string, Array<{ label: string; message: string }>> = {
  'platform-rating': [
    { label: 'Avaliação recebida', message: 'Obrigado por avaliar a plataforma. Seu feedback ajuda a direcionar as próximas melhorias.' },
    { label: 'Avaliação em análise', message: 'Recebemos sua avaliação e ela está em análise pela equipe.' },
    { label: 'Agradecimento público', message: 'Obrigado pelo depoimento. Se aprovado, ele poderá aparecer nas áreas públicas da plataforma.' },
  ],
  bug: [
    { label: 'Bug em análise', message: 'Recebemos o bug e ele já está em análise pelo time técnico.' },
    { label: 'Correção aplicada', message: 'Ajuste concluído. Se ainda houver erro, envie mais contexto por esta conversa.' },
    { label: 'Mais contexto', message: 'Precisamos de mais contexto (página, horário, navegador e passos para reproduzir).' },
  ],
  suggestion: [
    { label: 'Sugestão recebida', message: 'Obrigado pela sugestão. Ela foi registrada e entrou na fila de avaliação.' },
    { label: 'Sugestão aprovada', message: 'Sua sugestão entrou no planejamento. Avisaremos por aqui quando houver previsão.' },
    { label: 'Sugestão em estudo', message: 'Sua sugestão está em estudo junto com melhorias relacionadas.' },
  ],
  report: [
    { label: 'Denúncia recebida', message: 'Recebemos a denúncia e ela já foi enviada para moderação.' },
    { label: 'Denúncia em validação', message: 'Estamos validando as informações antes da decisão final.' },
    { label: 'Solicitar prova', message: 'Se você tiver imagem, link ou outro contexto, envie por aqui para reforçar o caso.' },
  ],
  support: [
    { label: 'Atendimento iniciado', message: 'Recebemos sua mensagem e seu atendimento já foi iniciado.' },
    { label: 'Orientação enviada', message: 'Deixamos acima a orientação principal para o seu caso.' },
    { label: 'Aguardando retorno', message: 'Precisamos de mais informações para concluir o atendimento.' },
  ],
  'teacher-request': [
    { label: 'Solicitação recebida', message: 'Recebemos sua solicitação de comentário do professor e ela entrou na fila editorial.' },
    { label: 'Comentário em produção', message: 'O comentário do professor está sendo preparado para o item solicitado.' },
    { label: 'Comentário publicado', message: 'O comentário do professor foi publicado. Você já pode consultá-lo na Lei Comentada.' },
  ],
  'analysis-request': [
    { label: 'Solicitação recebida', message: 'Recebemos sua solicitação de análise detalhada e ela entrou na fila editorial.' },
    { label: 'Análise em produção', message: 'A análise detalhada está sendo preparada para a seção solicitada.' },
    { label: 'Análise publicada', message: 'A análise detalhada foi publicada. Você já pode consultá-la na Lei Comentada.' },
  ],
  other: [
    { label: 'Atendimento iniciado', message: 'Recebemos sua mensagem e seu atendimento já foi iniciado.' },
  ],
};

interface AdminFeedbackProps {
  mode?: 'feedback' | 'threads';
  onPendingCountChange?: (count: number) => void;
}

export const countPendingFeedback = (items: AdminFeedbackThread[]) => items.filter((item) => item.status !== 'resolved').length;

const compactText = (value: unknown, maxLength = 140) => {
  return compactSupportText(value, maxLength);
};

const formatExpandedSupportText = (value: unknown) => {
  const normalized = String(value || '').replace(/\r\n/g, '\n').trim();
  return normalized || 'Sem informação registrada.';
};

const cleanFeedbackDetails = (item: AdminFeedbackThread) => {
  const rawDetails = String(item.details || '').trim();
  if (!rawDetails) return 'Sem detalhes fornecidos.';

  const isPlatformRating = String(item.reason || '').toLowerCase().includes('avaliar plataforma');
  if (!isPlatformRating) return rawDetails;

  const cleaned = rawDetails
    .replace(/\s*Avalia\S*:\s*\d+\s*\/\s*5\b/gi, '')
    .replace(/\s*Aluno:\s*.*?(?=\s+Email:|\s+Plano:|$)/gi, '')
    .replace(/\s*Email:\s*.*?(?=\s+Plano:|$)/gi, '')
    .replace(/\s*Plano:\s*.*$/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned || 'Sem detalhes fornecidos.';
};

const isPlatformRatingFeedback = (item: AdminFeedbackThread) => (
  String(item.reason || '').toLowerCase().includes('avaliar plataforma')
  || Number(item.public_rating || 0) > 0
  || ['platform-rating', 'platform_rating', 'testimonial', 'rating'].includes(String(item.type || ''))
);

type EditorialRequestKind = 'teacher-request' | 'analysis-request';

interface EditorialRequestContext {
  kind: EditorialRequestKind;
  lawId: string;
  sectionId: string;
  targetId: string;
}

export const parseEditorialRequestContext = (item: AdminFeedbackThread): EditorialRequestContext | null => {
  const parsed = parseEditorialRequestDetails(item.details);
  if (!parsed?.kind || !parsed.lawId || !parsed.sectionId || !parsed.targetId) return null;

  return {
    kind: parsed.kind,
    lawId: parsed.lawId,
    sectionId: parsed.sectionId,
    targetId: parsed.targetId,
  };
};
export const getEffectiveFeedbackType = (item: AdminFeedbackThread) => (
  getSupportPresentationType(item)
);

export const isFeedbackInboxItem = (item: AdminFeedbackThread) => (
  isFeedbackInboxThread(item)
);

export const isSupportThreadItem = (item: AdminFeedbackThread) => (
  isOperationalSupportThread(item)
);

const getFeedbackTypeLabel = (item: AdminFeedbackThread) => (
  getSupportTypeLabel(item)
);

export const getEditorialAdminAction = (item: AdminFeedbackThread) => {
  const context = parseEditorialRequestContext(item);
  if (!context) return null;

  const query = new URLSearchParams({
    supportRequest: String(item.id),
    sectionId: context.sectionId,
    targetId: context.targetId,
  });

  return {
    href: `${buildAdminLawEditPath(context.lawId)}?${query.toString()}`,
    label: context.kind === 'teacher-request' ? 'Abrir lei e comentar' : 'Abrir lei e analisar',
  };
};

export const AdminFeedback: React.FC<AdminFeedbackProps> = ({
  mode = 'feedback',
  onPendingCountChange,
}) => {
  const { addToast } = useToast();
  const [feedbacks, setFeedbacks] = useState<AdminFeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, AdminFeedbackReply[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [loadingRepliesId, setLoadingRepliesId] = useState<number | null>(null);
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [publishingHomeId, setPublishingHomeId] = useState<number | null>(null);
  const [compensationDrafts, setCompensationDrafts] = useState<Record<number, { days: string; ticket: string; reason: string }>>({});
  const [compensatingId, setCompensatingId] = useState<number | null>(null);
  const [operators, setOperators] = useState<AdminFeedbackOperator[]>([]);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminFeedbackThread['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [supportNowMs, setSupportNowMs] = useState(0);
  const deferredSearch = useDeferredValue(search);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const items = await adminService.getFeedbackThreads();
      setSupportNowMs(Date.now());
      setFeedbacks(items);
    } catch (error) {
      clientLog.warn('Error fetching feedback:', error);
      addToast('Não foi possível carregar os feedbacks.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fetchFeedback();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [fetchFeedback]);

  useEffect(() => {
    if (mode !== 'threads') return undefined;

    let active = true;
    void adminService.getFeedbackOperators()
      .then((items) => {
        if (active) setOperators(items);
      })
      .catch((error) => {
        clientLog.warn('Error fetching support operators:', error);
        addToast('Não foi possível carregar os operadores de suporte.', 'error');
      });

    return () => {
      active = false;
    };
  }, [addToast, mode]);

  useEffect(() => {
    if (!loading) {
      const frameId = window.requestAnimationFrame(() => {
        const scopedItems = mode === 'threads'
          ? feedbacks.filter(isSupportThreadItem)
          : feedbacks.filter(isFeedbackInboxItem);
        onPendingCountChange?.(countPendingFeedback(scopedItems));
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    return undefined;
  }, [feedbacks, loading, mode, onPendingCountChange]);

  const dataset = useMemo(() => {
    if (mode === 'threads') {
      return feedbacks.filter(isSupportThreadItem);
    }
    return feedbacks.filter(isFeedbackInboxItem);
  }, [feedbacks, mode]);

  const filteredFeedbacks = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return dataset.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'all' && getEffectiveFeedbackType(item) !== typeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.reason,
        item.details,
        item.user_name,
        item.user_email,
        getFeedbackTypeLabel(item),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [dataset, deferredSearch, statusFilter, typeFilter]);

  const sortedFeedbacks = useMemo(
    () => [...filteredFeedbacks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [filteredFeedbacks],
  );

  const feedbackStats = useMemo(() => ({
    total: dataset.length,
    new: dataset.filter((item) => item.status === 'new').length,
    read: dataset.filter((item) => item.status === 'read').length,
    resolved: dataset.filter((item) => item.status === 'resolved').length,
    noReply: dataset.filter((item) => Number(item.reply_count || 0) === 0 && item.status !== 'resolved').length,
    overdue: dataset.filter((item) => item.status !== 'resolved' && (supportNowMs - new Date(item.created_at).getTime()) > 48 * 60 * 60 * 1000).length,
  }), [dataset, supportNowMs]);

  const updateStatus = useCallback(async (id: number, status: AdminFeedbackThread['status']) => {
    setUpdatingStatusId(id);
    try {
      await adminService.updateFeedbackStatus(id, status);
      await fetchFeedback();
      addToast('Status do feedback atualizado.', 'success');
    } catch (error) {
      clientLog.warn('Error updating feedback status:', error);
      addToast('Não foi possível atualizar o status do feedback.', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  }, [addToast, fetchFeedback]);

  const toggleExpand = useCallback(async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    if (replies[id]) {
      return;
    }

    setLoadingRepliesId(id);
    try {
      const threadReplies = await adminService.getFeedbackReplies(id);
      setReplies((current) => ({ ...current, [id]: threadReplies }));
    } catch (error) {
      clientLog.warn('Error fetching feedback replies:', error);
      addToast('Não foi possível carregar a conversa.', 'error');
    } finally {
      setLoadingRepliesId(null);
    }
  }, [addToast, expandedId, replies]);

  const sendReply = useCallback(async (parentId: number) => {
    const message = (replyDrafts[parentId] || '').trim();
    if (!message) return;

    setSendingReplyId(parentId);
    try {
      await adminService.replyToFeedback(parentId, message);
      const updatedReplies = await adminService.getFeedbackReplies(parentId);
      await fetchFeedback();
      setReplies((current) => ({ ...current, [parentId]: updatedReplies }));
      setReplyDrafts((current) => ({ ...current, [parentId]: '' }));
      addToast('Resposta enviada com sucesso.', 'success');
    } catch (error) {
      clientLog.warn('Error sending feedback reply:', error);
      addToast('Não foi possível enviar a resposta.', 'error');
    } finally {
      setSendingReplyId(null);
    }
  }, [addToast, fetchFeedback, replyDrafts]);

  const applyReplyTemplate = useCallback((threadId: number, message: string) => {
    setReplyDrafts((current) => ({ ...current, [threadId]: message }));
  }, []);

  const updateHomePublication = useCallback(async (id: number, published: boolean) => {
    setPublishingHomeId(id);
    try {
      await adminService.updateFeedbackHomePublication(id, published);
      await fetchFeedback();
      addToast(published ? 'Avaliação aprovada para exibição na home.' : 'Avaliação removida da home.', 'success');
    } catch (error) {
      clientLog.warn('Error updating testimonial publication:', error);
      addToast(published ? 'Não foi possível aprovar a avaliação na home.' : 'Não foi possível remover a avaliação da home.', 'error');
    } finally {
      setPublishingHomeId(null);
    }
  }, [addToast, fetchFeedback]);

  const grantSupportCompensation = useCallback(async (item: AdminFeedbackThread) => {
    const draft = compensationDrafts[item.id] || { days: '', ticket: '', reason: '' };
    const days = Number(draft.days);
    const ticket = draft.ticket.trim();
    const reason = draft.reason.trim();
    if (!Number.isInteger(days) || days < 1 || days > 366 || !ticket || !reason) {
      addToast('Informe dias, ticket e motivo para registrar a compensação.', 'error');
      return;
    }

    setCompensatingId(item.id);
    try {
      const result = await adminService.performUserActionWithResult({
        action: 'add_days',
        user_id: item.user_id,
        days,
        ticket_reference: ticket,
        reason,
        idempotency_key: `support-case:${item.id}:${item.user_id}:${days}:${ticket}`,
      });
      await fetchFeedback();
      addToast(result.message || 'Compensação registrada pelo suporte.', 'success');
      setCompensationDrafts((current) => ({ ...current, [item.id]: { days: '', ticket: '', reason: '' } }));
    } catch (error) {
      clientLog.warn('Error granting support compensation:', error);
      addToast('Não foi possível registrar a compensação.', 'error');
    } finally {
      setCompensatingId(null);
    }
  }, [addToast, compensationDrafts, fetchFeedback]);

  const updateAssignment = useCallback(async (item: AdminFeedbackThread, assigneeId: string) => {
    setAssigningId(item.id);
    try {
      await adminService.updateFeedbackAssignment(item.id, assigneeId || null);
      await fetchFeedback();
      addToast(assigneeId ? 'Solicitação atribuída.' : 'Atribuição removida.', 'success');
    } catch (error) {
      clientLog.warn('Error updating support assignment:', error);
      addToast('Não foi possível atualizar a atribuição.', 'error');
    } finally {
      setAssigningId(null);
    }
  }, [addToast, fetchFeedback]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin" size={18} />
        Carregando feedbacks...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {mode === 'threads' ? 'Solicitações' : 'Feedback e avaliações'}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'threads'
            ? 'Fila com chamados, pedidos editoriais e conversas em andamento.'
            : 'Central de avaliações da plataforma e opiniões dos usuários.'}
        </p>
      </div>

      <div className={`${ADMIN_SURFACE_CLASS} p-3`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-[560px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por usuário, e-mail, motivo ou conteúdo"
              className={`${ADMIN_FIELD_CLASS} w-full pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | AdminFeedbackThread['status'])}
                className={`${ADMIN_FIELD_CLASS} min-w-[150px]`}
              >
                <option value="all">Todos os status</option>
                <option value="new">Novo</option>
                <option value="read">Lido</option>
                <option value="resolved">Resolvido</option>
              </select>
            </div>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={`${ADMIN_FIELD_CLASS} min-w-[180px]`}
            >
              <option value="all">{mode === 'threads' ? 'Todos os contextos' : 'Todos os tipos'}</option>
              <option value="platform-rating">Avaliação</option>
              {mode === 'threads' ? (
                <>
                  <option value="support">Suporte</option>
                  <option value="bug">Problema técnico</option>
                  <option value="suggestion">Produto e sugestão</option>
                  <option value="teacher-request">Comentário do professor</option>
                  <option value="analysis-request">Análise detalhada</option>
                </>
              ) : null}
              <option value="other">Outro</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-wrap gap-2`}>
          <span className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Total {feedbackStats.total}
          </span>
          <span className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
            Novos {feedbackStats.new}
          </span>
          <span className="rounded-sm border border-indigo-300 bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300">
            Lidos {feedbackStats.read}
          </span>
          <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
            Resolvidos {feedbackStats.resolved}
          </span>
          <span className="rounded-sm border border-rose-300 bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
            Sem resposta {feedbackStats.noReply}
          </span>
          <span className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            SLA estourado {feedbackStats.overdue}
          </span>
        </div>

        <AdminDataTable label={mode === 'threads' ? 'Solicitações de suporte' : 'Feedbacks'}>
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/40">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Assunto</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-center">Respostas</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sortedFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {mode === 'threads'
                      ? 'Nenhuma solicitação encontrada para os filtros atuais.'
                      : 'Nenhum feedback encontrado para os filtros atuais.'}
                  </td>
                </tr>
              ) : sortedFeedbacks.map((item) => {
                const isExpanded = expandedId === item.id;
                const itemReplies = replies[item.id] || [];
                const isSendingReply = sendingReplyId === item.id;
                const isUpdatingStatus = updatingStatusId === item.id;
                const isPublishingHome = publishingHomeId === item.id;
                const isPlatformRating = isPlatformRatingFeedback(item);
                const rating = Math.max(0, Math.min(5, Number(item.public_rating || 0)));
                const isHomePublished = Boolean(item.home_published_at);
                const draft = replyDrafts[item.id] || '';
                const editorialAdminAction = getEditorialAdminAction(item);
                const expandedBlocks = getSupportThreadExpandedBlocks(item);

                return (
                  <React.Fragment key={item.id}>
                    <tr className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-sm border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                          {getFeedbackTypeLabel(item)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {compactText(getSupportThreadTitle(item), 78)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {getSupportThreadPreview({ ...item, details: cleanFeedbackDetails(item) }, 140)}
                        </p>
                        {isPlatformRating ? (
                          <div className="mt-2 flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={`${item.id}-star-${index}`}
                                size={13}
                                className={index < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}
                              />
                            ))}
                            <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                              {rating || '-'} / 5
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{item.user_name || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.user_email || '-'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex w-fit rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${STATUS_TONE[item.status]}`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                          <select
                            value={item.status}
                            disabled={isUpdatingStatus}
                            onChange={(event) => void updateStatus(item.id, event.target.value as AdminFeedbackThread['status'])}
                            className={`${ADMIN_FIELD_CLASS} h-8 min-w-[128px] text-xs`}
                          >
                            <option value="new">Novo</option>
                            <option value="read">Lido</option>
                            <option value="resolved">Resolvido</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {Number(item.reply_count || 0)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {editorialAdminAction ? (
                            <Link href={editorialAdminAction.href} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                              <BookOpenCheck size={14} />
                              {editorialAdminAction.label}
                            </Link>
                          ) : null}
                          {isPlatformRating ? (
                            <button
                              type="button"
                              onClick={() => void updateHomePublication(item.id, !isHomePublished)}
                              disabled={isPublishingHome}
                              className={ADMIN_SECONDARY_BUTTON_CLASS}
                            >
                              {isPublishingHome ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              {isHomePublished ? 'Remover da home' : 'Aprovar na home'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void toggleExpand(item.id)}
                            className={ADMIN_SECONDARY_BUTTON_CLASS}
                          >
                            <MessageSquare size={14} />
                            {isExpanded ? 'Fechar' : 'Ver conversa'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="bg-slate-50 dark:bg-slate-950/30">
                        <td colSpan={7} className="px-3 py-4">
                          {loadingRepliesId === item.id ? (
                            <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400">
                              <Loader2 size={16} className="animate-spin" />
                              Carregando conversa...
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {mode === 'threads' ? (
                                <div className="flex flex-wrap items-center gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                  <UserRound size={16} className="text-slate-400" aria-hidden="true" />
                                  <label className="flex min-w-[240px] flex-1 items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <span>Operador responsável</span>
                                    <select
                                      aria-label="Operador responsável"
                                      value={item.assigned_to || ''}
                                      disabled={assigningId === item.id}
                                      onChange={(event) => void updateAssignment(item, event.target.value)}
                                      className={`${ADMIN_FIELD_CLASS} min-w-0 flex-1`}
                                    >
                                      <option value="">Não atribuído</option>
                                      {operators.map((operator) => (
                                        <option key={operator.id} value={operator.id}>{operator.name} ({operator.role})</option>
                                      ))}
                                    </select>
                                  </label>
                                  {item.assigned_user_name ? (
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Atual: {item.assigned_user_name}</span>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="grid gap-3 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Assunto completo</p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-slate-100">
                                      {formatExpandedSupportText(getSupportThreadTitle(item))}
                                    </p>
                                  </div>
                                  {expandedBlocks.length > 0 ? (
                                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
                                      {getSupportThreadPreview({ ...item, details: cleanFeedbackDetails(item) }, 1200)}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="space-y-2 rounded-sm bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                                  <p>
                                    <span className="font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo: </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{getFeedbackTypeLabel(item)}</span>
                                  </p>
                                  <p>
                                    <span className="font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Usuário: </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{item.user_name || '-'}</span>
                                  </p>
                                  <p>
                                    <span className="font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">E-mail: </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{item.user_email || '-'}</span>
                                  </p>
                                  {isPlatformRating ? (
                                    <div>
                                      <span className="font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Avaliação: </span>
                                      <div className="mt-1 flex items-center gap-1 text-amber-400">
                                        {Array.from({ length: 5 }).map((_, index) => (
                                          <Star
                                            key={`${item.id}-expanded-star-${index}`}
                                            size={14}
                                            className={index < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}
                                          />
                                        ))}
                                        <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                          {rating || '-'} / 5
                                        </span>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                                {itemReplies.length > 0 ? itemReplies.map((reply) => {
                                  const isUserReply = String(reply.user_id) === String(item.user_id);
                                  const normalizedReplyRole = String(reply.user_role || '').toLowerCase();
                                  const isTeamReply = normalizedReplyRole === 'admin' || normalizedReplyRole === 'staff';
                                  const replyAuthorLabel = isUserReply
                                    ? reply.user_name || item.user_name || 'Usuário'
                                    : isTeamReply
                                      ? 'ConcursoMestre'
                                      : reply.user_name || 'Participante';

                                  return (
                                    <div
                                      key={reply.id}
                                      className={`max-w-[88%] rounded-sm border px-3 py-2 ${
                                        isUserReply
                                          ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                                          : isTeamReply
                                            ? 'ml-auto border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                                            : 'ml-auto border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30'
                                      }`}
                                    >
                                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-slate-700 dark:text-slate-200">{replyAuthorLabel}</span>
                                          {isTeamReply ? (
                                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                                              normalizedReplyRole === 'admin'
                                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                            }`}>
                                              {normalizedReplyRole === 'admin' ? 'Admin' : 'Staff'}
                                            </span>
                                          ) : null}
                                        </div>
                                        <span>{new Date(reply.created_at).toLocaleString('pt-BR')}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{reply.details}</p>
                                    </div>
                                  );
                                }) : (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma resposta ainda.</p>
                                )}
                              </div>

                              {item.status === 'resolved' ? (
                                <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                                  Esta solicitação foi resolvida e não aceita novas respostas.
                                </div>
                              ) : (
                              <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                                <div className="flex flex-wrap gap-2">
                                  {(FEEDBACK_REPLY_TEMPLATES[getEffectiveFeedbackType(item)] || FEEDBACK_REPLY_TEMPLATES.support).map((template) => (
                                    <button
                                      key={`${item.id}-${template.label}`}
                                      type="button"
                                      onClick={() => applyReplyTemplate(item.id, template.message)}
                                      className={ADMIN_SECONDARY_BUTTON_CLASS}
                                    >
                                      {template.label}
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  value={draft}
                                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                                  placeholder="Escreva uma resposta..."
                                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[92px]`}
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => void sendReply(item.id)}
                                    disabled={isSendingReply || !draft.trim()}
                                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                                  >
                                    {isSendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Enviar resposta
                                  </button>
                                </div>
                              </div>
                              )}

                              {mode === 'threads' && item.status !== 'resolved' ? (
                                <form
                                  className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void grantSupportCompensation(item);
                                  }}
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Compensação de suporte</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A ação usa a autoridade de Benefits e mantém o plano pago separado.</p>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-3">
                                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      <span>Dias gratuitos</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max="366"
                                        required
                                        value={compensationDrafts[item.id]?.days || ''}
                                        onChange={(event) => setCompensationDrafts((current) => ({
                                          ...current,
                                          [item.id]: { ...(current[item.id] || { days: '', ticket: '', reason: '' }), days: event.target.value },
                                        }))}
                                        className={`${ADMIN_FIELD_CLASS} w-full`}
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      <span>Ticket ou referência</span>
                                      <input
                                        type="text"
                                        required
                                        value={compensationDrafts[item.id]?.ticket || ''}
                                        onChange={(event) => setCompensationDrafts((current) => ({
                                          ...current,
                                          [item.id]: { ...(current[item.id] || { days: '', ticket: '', reason: '' }), ticket: event.target.value },
                                        }))}
                                        className={`${ADMIN_FIELD_CLASS} w-full`}
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      <span>Motivo</span>
                                      <input
                                        type="text"
                                        required
                                        value={compensationDrafts[item.id]?.reason || ''}
                                        onChange={(event) => setCompensationDrafts((current) => ({
                                          ...current,
                                          [item.id]: { ...(current[item.id] || { days: '', ticket: '', reason: '' }), reason: event.target.value },
                                        }))}
                                        className={`${ADMIN_FIELD_CLASS} w-full`}
                                      />
                                    </label>
                                  </div>
                                  <button type="submit" disabled={compensatingId === item.id} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                                    {compensatingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                                    {compensatingId === item.id ? 'Registrando...' : 'Registrar compensação'}
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </AdminDataTable>
      </div>
    </div>
  );
};
