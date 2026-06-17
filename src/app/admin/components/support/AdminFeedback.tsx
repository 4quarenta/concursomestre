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
import { CheckCircle2, Filter, Loader2, MessageSquare, Search, Send, Star } from 'lucide-react';
import { adminService, type AdminFeedbackReply, type AdminFeedbackThread } from '@services/admin/adminService';
import { clientLog } from '@services/monitoring/clientLog';
import { useToast } from '@providers/ToastProvider';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

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

const TYPE_LABELS: Record<string, string> = {
  support: 'Suporte',
  report: 'Denúncia',
  'platform-rating': 'Avaliação',
  platform_rating: 'Avaliação',
  testimonial: 'Avaliação',
  rating: 'Avaliação',
  suggestion: 'Sugestão',
  bug: 'Bug',
  other: 'Outro',
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
  other: [
    { label: 'Atendimento iniciado', message: 'Recebemos sua mensagem e seu atendimento já foi iniciado.' },
  ],
};

interface AdminFeedbackProps {
  mode?: 'feedback' | 'threads';
  onPendingCountChange?: (count: number) => void;
}

const countPendingFeedback = (items: AdminFeedbackThread[]) => items.filter((item) => item.status !== 'resolved').length;

const compactText = (value: unknown, maxLength = 140) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
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

const getEffectiveFeedbackType = (item: AdminFeedbackThread) => (
  isPlatformRatingFeedback(item) ? 'platform-rating' : String(item.type || 'other')
);

const getFeedbackTypeLabel = (item: AdminFeedbackThread) => (
  TYPE_LABELS[getEffectiveFeedbackType(item)] || getEffectiveFeedbackType(item)
);

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
    if (!loading) {
      const frameId = window.requestAnimationFrame(() => {
        onPendingCountChange?.(countPendingFeedback(feedbacks));
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    return undefined;
  }, [feedbacks, loading, onPendingCountChange]);

  const dataset = useMemo(() => {
    if (mode === 'threads') {
      return feedbacks.filter((item) => Number(item.reply_count || 0) > 0 || item.status !== 'new');
    }
    return feedbacks.filter((item) => getEffectiveFeedbackType(item) !== 'cancellation');
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
          {mode === 'threads' ? 'Threads operacionais' : 'Feedback e suporte'}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'threads'
            ? 'Fila com conversas já iniciadas para acompanhamento.'
            : 'Central de avaliações da plataforma, bugs, sugestões e suporte.'}
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
              <option value="bug">Bug</option>
              <option value="suggestion">Sugestão</option>
              <option value="support">Suporte</option>
              <option value="report">Denúncia</option>
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

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/40">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Assunto</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-center">Respostas</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {sortedFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {mode === 'threads'
                      ? 'Nenhuma thread encontrada para os filtros atuais.'
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
                          {compactText(item.reason || getFeedbackTypeLabel(item) || 'Feedback', 78)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {compactText(cleanFeedbackDetails(item), 140)}
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
                              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                                {itemReplies.length > 0 ? itemReplies.map((reply) => {
                                  const isUserReply = reply.user_id === item.user_id;
                                  return (
                                    <div
                                      key={reply.id}
                                      className={`max-w-[88%] rounded-sm border px-3 py-2 ${
                                        isUserReply
                                          ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                                          : 'ml-auto border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30'
                                      }`}
                                    >
                                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{reply.user_name}</span>
                                        <span>{new Date(reply.created_at).toLocaleString('pt-BR')}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{reply.details}</p>
                                    </div>
                                  );
                                }) : (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma resposta ainda.</p>
                                )}
                              </div>

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
        </div>
      </div>
    </div>
  );
};
