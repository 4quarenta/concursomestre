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
import { AlertTriangle, Clock, Filter, Loader2, MessageSquare, Search, Send, User } from 'lucide-react';
import { adminService, type AdminFeedbackReply, type AdminFeedbackThread } from '@services/admin/adminService';
import { useToast } from '@providers/ToastProvider';

const STATUS_LABELS: Record<AdminFeedbackThread['status'], string> = {
  new: 'Novo',
  read: 'Lido',
  resolved: 'Resolvido',
};

const TYPE_LABELS: Record<string, string> = {
  cancellation: 'Cancelamento',
  support: 'Suporte',
  report: 'Denúncia',
  suggestion: 'Sugestao',
  bug: 'Bug',
  other: 'Outro',
};

const FEEDBACK_REPLY_TEMPLATES: Record<string, Array<{ label: string; message: string }>> = {
  bug: [
    {
      label: 'Bug em análise',
      message: 'Recebemos o bug reportado e ele já esta em análise pelo time técnico. Assim que tivermos um posicionamento final, enviaremos uma nova atualizacao.',
    },
    {
      label: 'Correcao aplicada',
      message: 'Concluimos a correcao do problema reportado e o ajuste já foi encaminhado para a plataforma. Se você ainda identificar o erro, responda esta conversa com o máximo de contexto possível.',
    },
    {
      label: 'Precisamos de contexto',
      message: 'Obrigado por sinalizar o problema. Para acelerar a análise, precisamos de mais contexto, como pagina, horario, navegador e passos para reproduzir o erro.',
    },
  ],
  suggestion: [
    {
      label: 'Sugestao recebida',
      message: 'Obrigado pela sugestao. Já registramos a ideia no backlog do produto e ela entrou na nossa fila de avaliação.',
    },
    {
      label: 'Sugestao aprovada',
      message: 'Sua sugestao foi bem recebida e entrou no nosso planejamento. Quando houver previsao mais concreta, retornaremos por este mesmo canal.',
    },
    {
      label: 'Sugestao em estudo',
      message: 'Sua sugestao faz sentido para a plataforma e esta sendo avaliada junto com outras melhorias relacionadas. Assim que fecharmos o direcionamento, avisaremos aqui.',
    },
  ],
  cancellation: [
    {
      label: 'Cancelamento em análise',
      message: 'Recebemos sua solicitacao de cancelamento e ela esta em análise. Em breve retornaremos com a confirmacao e os proximos passos.',
    },
    {
      label: 'Cancelamento orientado',
      message: 'Sua solicitação foi registrada. Se houver cobrança futura ou alguma pendência específica, nos detalhe por aqui para concluirmos a tratativa com segurança.',
    },
    {
      label: 'Retencao amigavel',
      message: 'Entendemos seu pedido e queremos ajudar da melhor forma. Se o motivo estiver ligado a cobrança, acesso ou funcionalidades, podemos analisar uma alternativa antes do encerramento final.',
    },
  ],
  report: [
    {
      label: 'Denúncia recebida',
      message: 'Recebemos sua denúncia e ela já foi encaminhada para moderação. Assim que a análise for concluida, você recebera uma atualizacao.',
    },
    {
      label: 'Denúncia em validação',
      message: 'Estamos validando as informações enviadas na denúncia e cruzando o contexto com os dados internos da plataforma. Retornaremos assim que a moderação finalizar.',
    },
    {
      label: 'Precisamos de prova',
      message: 'Obrigado pela denúncia. Se você tiver imagem, link ou outro contexto complementar, envie por aqui para fortalecer a análise do caso.',
    },
  ],
  support: [
    {
      label: 'Atendimento iniciado',
      message: 'Recebemos sua mensagem e seu atendimento já foi iniciado. Em breve retornaremos com a orientacao adequada para o seu caso.',
    },
    {
      label: 'Orientacao enviada',
      message: 'Analisamos seu atendimento e deixamos acima a orientacao principal. Se precisar complementar com mais contexto, basta responder nesta mesma conversa.',
    },
    {
      label: 'Aguardando retorno',
      message: 'Precisamos de mais algumas informações para concluir seu atendimento. Assim que você responder, seguimos com a tratativa.',
    },
  ],
  other: [
    {
      label: 'Atendimento iniciado',
      message: 'Recebemos sua mensagem e seu atendimento já foi iniciado. Em breve retornaremos com a orientacao adequada para o seu caso.',
    },
  ],
};

interface AdminFeedbackProps {
  mode?: 'feedback' | 'threads';
  onPendingCountChange?: (count: number) => void;
}

const countPendingFeedback = (items: AdminFeedbackThread[]) =>
  items.filter((item) => item.status !== 'resolved').length;

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminFeedbackThread['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const deferredSearch = useDeferredValue(search);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const items = await adminService.getFeedbackThreads();
      setFeedbacks(items);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      addToast('Não foi possível carregar os feedbacks.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    if (!loading) {
      onPendingCountChange?.(countPendingFeedback(feedbacks));
    }
  }, [feedbacks, loading, onPendingCountChange]);

  const dataset = useMemo(() => {
    if (mode === 'threads') {
      return feedbacks.filter((item) => Number(item.reply_count || 0) > 0 || item.status !== 'new');
    }

    return feedbacks;
  }, [feedbacks, mode]);

  const overdueCount = useMemo(
    () => dataset.filter((item) => item.status !== 'resolved' && (Date.now() - new Date(item.created_at).getTime()) > 48 * 60 * 60 * 1000).length,
    [dataset],
  );

  const withoutReplyCount = useMemo(
    () => dataset.filter((item) => Number(item.reply_count || 0) === 0 && item.status !== 'resolved').length,
    [dataset],
  );

  const feedbackStats = useMemo(() => ({
    total: dataset.length,
    new: dataset.filter((item) => item.status === 'new').length,
    read: dataset.filter((item) => item.status === 'read').length,
    resolved: dataset.filter((item) => item.status === 'resolved').length,
  }), [dataset]);

  const filteredFeedbacks = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return dataset.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'all' && item.type !== typeFilter) {
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
        TYPE_LABELS[item.type] || item.type,
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

  const updateStatus = useCallback(async (id: number, status: AdminFeedbackThread['status']) => {
    setUpdatingStatusId(id);

    try {
      await adminService.updateFeedbackStatus(id, status);
      await fetchFeedback();
      addToast('Status do feedback atualizado.', 'success');
    } catch (error) {
      console.error('Error updating feedback status:', error);
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
      console.error('Error fetching feedback replies:', error);
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
      setFeedbacks((current) => current.map((item) => (
        item.id === parentId
          ? { ...item, reply_count: updatedReplies.length, status: item.status === 'new' ? 'read' : item.status }
          : item
      )));
      addToast('Resposta enviada com sucesso.', 'success');
    } catch (error) {
      console.error('Error sending feedback reply:', error);
      addToast('Não foi possível enviar a resposta.', 'error');
    } finally {
      setSendingReplyId(null);
    }
  }, [addToast, fetchFeedback, replyDrafts]);

  const applyReplyTemplate = useCallback((threadId: number, message: string) => {
    setReplyDrafts((current) => ({ ...current, [threadId]: message }));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="animate-spin" size={18} />
        Carregando feedbacks...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white">{mode === 'threads' ? 'Threads Operacionais' : 'Feedback e Suporte'}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {mode === 'threads'
              ? 'Fila de conversas que ja tiveram resposta, retorno ou precisam de acompanhamento.'
              : 'Central de triagem de mensagens, cancelamentos, bugs e solicitações do usuário.'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total</p>
            <p className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">{feedbackStats.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/70 dark:bg-amber-900/10 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Novos</p>
            <p className="mt-2 text-xl font-black text-amber-700 dark:text-amber-300">{feedbackStats.new}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50/70 dark:bg-indigo-900/10 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Lidos</p>
            <p className="mt-2 text-xl font-black text-indigo-700 dark:text-indigo-300">{feedbackStats.read}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/70 dark:bg-emerald-900/10 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Resolvidos</p>
            <p className="mt-2 text-xl font-black text-emerald-700 dark:text-emerald-300">{feedbackStats.resolved}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/70 dark:bg-amber-900/10 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Sem retorno</p>
            <p className="mt-2 text-xl font-black text-amber-700 dark:text-amber-300">{withoutReplyCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-rose-50/70 dark:bg-rose-900/10 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">SLA estourado</p>
            <p className="mt-2 text-xl font-black text-rose-700 dark:text-rose-300">{overdueCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por usuário, e-mail, motivo ou conteúdo"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <Filter size={14} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | AdminFeedbackThread['status'])}
                className="bg-transparent text-xs font-black uppercase tracking-widest text-slate-600 outline-none dark:text-slate-300"
              >
                <option value="all">Todos os status</option>
                <option value="new">Novo</option>
                <option value="read">Lido</option>
                <option value="resolved">Resolvido</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <MessageSquare size={14} className="text-slate-400" />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="bg-transparent text-xs font-black uppercase tracking-widest text-slate-600 outline-none dark:text-slate-300"
              >
                <option value="all">{mode === 'threads' ? 'Todos os contextos' : 'Todos os tipos'}</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {sortedFeedbacks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-400">
            {mode === 'threads' ? 'Nenhuma thread encontrada para os filtros atuais.' : 'Nenhum feedback encontrado para os filtros atuais.'}
          </div>
        ) : (
          sortedFeedbacks.map((item) => {
            const isExpanded = expandedId === item.id;
            const itemReplies = replies[item.id] || [];
            const isSendingReply = sendingReplyId === item.id;
            const isUpdatingStatus = updatingStatusId === item.id;
            const draft = replyDrafts[item.id] || '';

            return (
              <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.type === 'cancellation' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      {item.type === 'cancellation' ? <AlertTriangle size={24} /> : <MessageSquare size={24} />}
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-white text-lg">{item.reason || TYPE_LABELS[item.type] || 'Feedback'}</h4>
                          <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {TYPE_LABELS[item.type] || item.type}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : item.status === 'read'
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <User size={12} /> {item.user_name} ({item.user_email})
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} /> {new Date(item.created_at).toLocaleString()}
                          </span>
                        </p>
                      </div>

                      <select
                        value={item.status}
                        disabled={isUpdatingStatus}
                        onChange={(e) => void updateStatus(item.id, e.target.value as AdminFeedbackThread['status'])}
                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-bold uppercase p-2 min-w-[120px] disabled:opacity-60"
                      >
                        <option value="new">Novo</option>
                        <option value="read">Lido</option>
                        <option value="resolved">Resolvido</option>
                      </select>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-800">
                      {item.details || 'Sem detalhes fornecidos.'}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        onClick={() => void toggleExpand(item.id)}
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
                      >
                        <MessageSquare size={16} />
                        {isExpanded ? 'Ocultar conversa' : `Ver conversa (${item.reply_count || 0})`}
                      </button>
                      {Number(item.reply_count || 0) === 0 && item.status !== 'resolved' ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300">
                          Sem resposta
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800 p-6 space-y-4">
                    {loadingRepliesId === item.id ? (
                      <div className="text-center text-slate-400 py-4 flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={18} />
                        Carregando...
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {itemReplies.length > 0 ? itemReplies.map((reply) => {
                            const isUserReply = reply.user_id === item.user_id;

                            return (
                              <div key={reply.id} className={`flex gap-4 ${isUserReply ? 'flex-row' : 'flex-row-reverse'}`}>
                                <div className={`p-4 rounded-xl max-w-[80%] ${
                                  isUserReply
                                    ? 'bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                                    : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100 ml-auto'
                                }`}>
                                  <div className="flex justify-between items-center mb-1 gap-4">
                                    <span className="font-bold text-xs">{reply.user_name}</span>
                                    <span className="text-[10px] opacity-70">{new Date(reply.created_at).toLocaleString()}</span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{reply.details}</p>
                                </div>
                              </div>
                            );
                          }) : (
                            <p className="text-center text-slate-400 italic text-sm">Nenhuma resposta ainda.</p>
                          )}
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex flex-wrap gap-2">
                            {(FEEDBACK_REPLY_TEMPLATES[item.type] || FEEDBACK_REPLY_TEMPLATES.support).map((template) => (
                              <button
                                key={`${item.id}-${template.label}`}
                                onClick={() => applyReplyTemplate(item.id, template.message)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                                type="button"
                              >
                                {template.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Ao enviar a resposta pelo painel, o usuário recebe automaticamente um e-mail com o contexto deste atendimento.
                          </p>
                          <div className="flex gap-2 items-start">
                            <textarea
                              value={draft}
                              onChange={(e) => setReplyDrafts((current) => ({ ...current, [item.id]: e.target.value }))}
                              placeholder="Escreva uma resposta..."
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                            />
                          </div>
                          <button
                            onClick={() => void sendReply(item.id)}
                            disabled={isSendingReply || !draft.trim()}
                            className="inline-flex items-center gap-2 self-end bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Enviar resposta"
                            type="button"
                          >
                            {isSendingReply ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                            Enviar resposta
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
