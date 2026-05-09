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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bug,
  CheckCircle2,
  ChevronRight,
  Coffee,
  CreditCard,
  Heart,
  Info,
  MessageSquare,
  Send,
  Shield,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { useSearchParams } from 'next/navigation';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { readApiErrorMessage } from '@services/api';
import { supportService, type SupportReply, type SupportThread } from '@services/support/supportService';

type SupportTab = 'bug' | 'feedback' | 'info' | 'donation';

type SupportCategoryConfig = {
  id: SupportTab;
  title: string;
  eyebrow: string;
  description: string;
  placeholder: string;
  subjectPlaceholder: string;
  serviceType: string | null;
  icon: React.ElementType;
  accentClassName: string;
  surfaceClassName: string;
};

const SUPPORT_CATEGORIES: SupportCategoryConfig[] = [
  {
    id: 'bug',
    title: 'Reportar problema',
    eyebrow: 'Estabilidade',
    description: 'Use esta area para erros de navegacao, travamentos, telas em branco e comportamentos inesperados.',
    placeholder: 'Conte o que aconteceu, quais passos voce fez e o que esperava ver.',
    subjectPlaceholder: 'Ex: erro ao salvar questao',
    serviceType: 'bug',
    icon: Bug,
    accentClassName: 'text-rose-600 dark:text-rose-300',
    surfaceClassName: 'border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10',
  },
  {
    id: 'feedback',
    title: 'Enviar sugestao',
    eyebrow: 'Produto',
    description: 'Use esta area para ideias de melhoria, ajustes de UX e novas funcionalidades para a plataforma.',
    placeholder: 'Descreva a melhoria, o beneficio para o estudo e o contexto em que ela faria diferenca.',
    subjectPlaceholder: 'Ex: melhorar filtros de questoes',
    serviceType: 'suggestion',
    icon: MessageSquare,
    accentClassName: 'text-indigo-600 dark:text-indigo-300',
    surfaceClassName: 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/20 dark:bg-indigo-500/10',
  },
  {
    id: 'info',
    title: 'Solicitar ajuda',
    eyebrow: 'Suporte',
    description: 'Use esta area para duvidas operacionais sobre assinatura, acesso, materiais e fluxos da conta.',
    placeholder: 'Explique a duvida com o maximo de contexto para acelerar a resposta.',
    subjectPlaceholder: 'Ex: duvida sobre renovacao',
    serviceType: 'support',
    icon: Info,
    accentClassName: 'text-sky-600 dark:text-sky-300',
    surfaceClassName: 'border-sky-200 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10',
  },
  {
    id: 'donation',
    title: 'Apoiar a plataforma',
    eyebrow: 'Comunidade',
    description: 'Aqui ficam as formas de contribuir financeiramente com a manutencao e a evolucao do ConcursoMestre.',
    placeholder: '',
    subjectPlaceholder: '',
    serviceType: null,
    icon: Heart,
    accentClassName: 'text-emerald-600 dark:text-emerald-300',
    surfaceClassName: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10',
  },
];

const STATUS_META: Record<SupportThread['status'], { label: string; className: string }> = {
  new: {
    label: 'Aberto',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  read: {
    label: 'Em analise',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  resolved: {
    label: 'Resolvido',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
};

const mergeSupportThreads = (officialThreads: SupportThread[], localThreads: SupportThread[]) => {
  const officialIds = new Set(officialThreads.map((thread) => thread.id));
  const localOnlyThreads = localThreads.filter((thread) => !officialIds.has(thread.id));

  return [...localOnlyThreads, ...officialThreads].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

/**
 * Organiza a central de suporte em um workspace mais claro.
 * A pagina separa categoria, formulario, historico e doacao sem misturar prioridades.
 *
 * @since 1.0.0
 */
const Support: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const pixKey = systemSettings?.pixKey || 'pix@concursomestre.com.br';
  const [activeTab, setActiveTab] = useState<SupportTab>('bug');
  const [composeStep, setComposeStep] = useState<1 | 2>(1);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<SupportThread[]>([]);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, SupportReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null);
  const autoOpenedThreadRef = React.useRef<number | null>(null);

  const activeCategory = useMemo(
    () => SUPPORT_CATEGORIES.find((category) => category.id === activeTab) ?? SUPPORT_CATEGORIES[0],
    [activeTab],
  );
  const requestedThreadId = useMemo(() => Number(searchParams?.get('threadId') || 0), [searchParams]);
  const canSubmitThread = Boolean(currentUser && !isLoading && activeCategory.serviceType);

  /**
   * Busca o historico oficial do usuario ao trocar de contexto.
   *
   * @since 1.0.0
   */
  const fetchHistory = React.useCallback(async (notifyOnError = true, preserveLocalThreads = false) => {
    try {
      const threads = await supportService.listThreads();
      setFeedbackHistory((currentThreads) => (
        preserveLocalThreads ? mergeSupportThreads(threads, currentThreads) : threads
      ));
    } catch (error) {
      console.error('Error fetching feedback history', error);
      if (notifyOnError) {
        addToast(readApiErrorMessage(error, 'Nao foi possivel carregar seu historico agora.'), 'error');
      }
    }
  }, [addToast]);

  /**
   * Materializa localmente uma thread ja persistida no backend.
   * Isso evita que um erro no refresh esconda um submit que ja foi salvo.
   *
   * @since 1.0.0
   */
  const appendCreatedThread = React.useCallback((thread: SupportThread) => {
    setFeedbackHistory((currentThreads) => {
      if (currentThreads.some((currentThread) => currentThread.id === thread.id)) {
        return currentThreads;
      }

      return [thread, ...currentThreads];
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'donation') {
      return;
    }

    const historyTimer = window.setTimeout(() => {
      void fetchHistory(false);
    }, 0);

    return () => window.clearTimeout(historyTimer);
  }, [activeTab, fetchHistory]);

  /**
   * Envia um novo chamado do usuario.
   *
   * @since 1.0.0
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmitThread || !activeCategory.serviceType) {
      addToast('Sua sessao ainda nao esta pronta para enviar.', 'warning');
      return;
    }

    if (!subject.trim()) {
      addToast('Preencha um resumo curto para o chamado.', 'warning');
      return;
    }

    if (!details.trim()) {
      addToast('Descreva melhor o contexto antes de enviar.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedSubject = subject.trim();
      const normalizedDetails = details.trim();

      const createdThread = await supportService.createThread({
        type: activeCategory.serviceType,
        reason: normalizedSubject,
        details: normalizedDetails,
      });

      const createdThreadId = Number(createdThread.id || 0);
      const localThreadId = createdThreadId > 0 ? createdThreadId : -Date.now();
      appendCreatedThread({
        id: localThreadId,
        type: createdThread.type || activeCategory.serviceType,
        reason: normalizedSubject,
        details: normalizedDetails,
        status: 'new',
        created_at: new Date().toISOString(),
        reply_count: 0,
      });

      addToast('Solicitacao enviada com sucesso.', 'success');
      setSubject('');
      setDetails('');
      setComposeStep(1);
      void fetchHistory(true, true);
    } catch (error) {
      console.error('Error creating support thread', error);
      addToast(readApiErrorMessage(error, 'Nao foi possivel enviar sua solicitacao.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Abre ou fecha uma conversa e carrega as respostas oficiais sob demanda.
   *
   * @since 1.0.0
   */
  const toggleFeedback = async (threadId: number) => {
    if (expandedFeedbackId === threadId) {
      setExpandedFeedbackId(null);
      return;
    }

    setExpandedFeedbackId(threadId);

    if (threadId < 0) {
      return;
    }

    if (replies[threadId]) {
      return;
    }

    setLoadingReplies(threadId);

    try {
      const threadReplies = await supportService.listReplies(threadId);
      setReplies((currentReplies) => ({ ...currentReplies, [threadId]: threadReplies }));
    } catch (error) {
      console.error('Error fetching support replies', error);
      addToast(readApiErrorMessage(error, 'Nao foi possivel carregar a conversa completa.'), 'error');
    } finally {
      setLoadingReplies(null);
    }
  };

  /**
   * Envia uma resposta do usuario em uma thread ja aberta.
   *
   * @since 1.0.0
   */
  const handleReplySubmit = async (thread: SupportThread) => {
    const draft = (replyDrafts[thread.id] || '').trim();

    if (!draft) {
      addToast('Escreva uma resposta antes de enviar.', 'warning');
      return;
    }

    setSendingReplyId(thread.id);

    try {
      await supportService.replyToThread(thread.id, thread.type, draft);
      const threadReplies = await supportService.listReplies(thread.id);
      setReplies((currentReplies) => ({ ...currentReplies, [thread.id]: threadReplies }));
      setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [thread.id]: '' }));
      await fetchHistory(false);
      addToast('Resposta enviada com sucesso.', 'success');
    } catch (error) {
      console.error('Error sending support reply', error);
      addToast(readApiErrorMessage(error, 'Nao foi possivel enviar sua resposta.'), 'error');
    } finally {
      setSendingReplyId(null);
    }
  };

  const filteredHistory = useMemo(() => feedbackHistory, [feedbackHistory]);

  useEffect(() => {
    if (!requestedThreadId || autoOpenedThreadRef.current === requestedThreadId) {
      return;
    }

    const targetThread = feedbackHistory.find((thread) => thread.id === requestedThreadId);
    if (!targetThread) {
      return;
    }

    autoOpenedThreadRef.current = requestedThreadId;
    const openTimer = window.setTimeout(() => {
      setExpandedFeedbackId(requestedThreadId);

      if (replies[requestedThreadId]) {
        return;
      }

      setLoadingReplies(requestedThreadId);
      supportService.listReplies(requestedThreadId)
        .then((threadReplies) => {
          setReplies((currentReplies) => ({ ...currentReplies, [requestedThreadId]: threadReplies }));
        })
        .catch((error) => {
          console.error('Error opening support thread from notification', error);
          addToast(readApiErrorMessage(error, 'Nao foi possivel abrir a conversa de suporte.'), 'error');
        })
        .finally(() => setLoadingReplies(null));
    }, 0);

    return () => window.clearTimeout(openTimer);
  }, [addToast, feedbackHistory, replies, requestedThreadId]);

  const supportStats = useMemo(() => ({
    total: feedbackHistory.length,
    open: feedbackHistory.filter((thread) => thread.status === 'new').length,
    inProgress: feedbackHistory.filter((thread) => thread.status === 'read').length,
    resolved: feedbackHistory.filter((thread) => thread.status === 'resolved').length,
  }), [feedbackHistory]);

  const topGuides = useMemo(() => {
    if (activeTab === 'bug') {
      return [
        'Explique o passo a passo que gerou o erro.',
        'Diga em qual pagina o problema apareceu.',
        'Se houver, descreva a mensagem vista na tela.',
      ];
    }

    if (activeTab === 'feedback') {
      return [
        'Descreva a melhoria com foco no estudo real.',
        'Mostre onde a experiencia atual te trava.',
        'Se tiver exemplo, cite o fluxo desejado.',
      ];
    }

    if (activeTab === 'info') {
      return [
        'Explique a duvida com contexto suficiente.',
        'Informe o plano ou area envolvida, se houver.',
        'Diga o resultado esperado para acelerar a resposta.',
      ];
    }

    return [
      'A chave PIX fica disponivel logo abaixo.',
      'As contribuicoes ajudam servidor, manutencao e melhorias.',
      'Use apenas os canais oficiais mostrados nesta tela.',
    ];
  }, [activeTab]);

  const ActiveCategoryIcon = activeCategory.icon;

  return (
    <div className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 animate-fade-in`}>
      <section className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-8 text-white md:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-200">
              Central do usuario
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-indigo-100">
                <Shield size={24} />
              </div>
              <div className="min-w-0">
                <h1 className={`${PLATFORM_PAGE_TITLE_CLASS} text-white`}>
                  Central de Suporte e Feedback
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                  Um lugar unico para reportar problemas, enviar sugestoes, pedir ajuda e acompanhar as respostas do time.
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Chamados</p>
                <p className="mt-2 text-2xl font-black text-white">{supportStats.total}</p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">Abertos</p>
                <p className="mt-2 text-2xl font-black text-white">{supportStats.open}</p>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">Em analise</p>
                <p className="mt-2 text-2xl font-black text-white">{supportStats.inProgress}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">Resolvidos</p>
                <p className="mt-2 text-2xl font-black text-white">{supportStats.resolved}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-slate-50 px-6 py-8 dark:bg-slate-950/80 md:px-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                Como funciona
              </p>
              <div className="mt-4 space-y-4">
                {[
                  'Escolha a categoria certa para evitar retrabalho.',
                  'Descreva o contexto com clareza.',
                  'Acompanhe as respostas no historico logo abaixo.',
                ].map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white dark:bg-indigo-500">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Guia rapido</p>
            <h2 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">O que ajuda mais</h2>
            <div className="mt-4 space-y-3">
              {topGuides.map((tip) => (
                <div key={tip} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-800/70">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-indigo-500" />
                  <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          {activeTab === 'donation' ? (
            <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
              <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-8 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 md:px-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"><Heart size={20} /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Apoio direto</p>
                      <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Apoie o ConcursoMestre</h2>
                    </div>
                  </div>
                  <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    O projeto continua evoluindo com manutencao constante, servidor, desenvolvimento e revisao de conteudo. Se a plataforma te ajuda de verdade, esta e a area oficial para contribuir.
                  </p>
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1.6rem] border border-emerald-200 bg-white p-5 dark:border-emerald-500/20 dark:bg-slate-900">
                      <div className="flex items-center gap-3"><Coffee size={18} className="text-emerald-600 dark:text-emerald-300" /><p className="text-sm font-black text-slate-900 dark:text-slate-100">PIX oficial</p></div>
                      <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Copie a chave abaixo e use apenas os canais desta tela.</p>
                      <code className="mt-4 block rounded-2xl bg-slate-950 px-4 py-3 text-xs font-bold text-emerald-300">{pixKey}</code>
                    </div>
                    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center gap-3"><CreditCard size={18} className="text-indigo-600 dark:text-indigo-300" /><p className="text-sm font-black text-slate-900 dark:text-slate-100">Cartao</p></div>
                      <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Este canal ainda esta em reestruturacao e continua fora do fluxo ativo.</p>
                      <span className="mt-4 inline-flex rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">Em breve</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-8 dark:border-slate-800 dark:bg-slate-950 lg:border-l lg:border-t-0 md:px-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Transparencia</p>
                  <div className="mt-4 space-y-3">
                    {['Infraestrutura e custo de servidor.', 'Manutencao de bugs e correcoes criticas.', 'Melhorias no produto e no painel administrativo.'].map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
              <div className="border-b border-slate-100 px-6 py-6 dark:border-slate-800 md:px-8">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${activeCategory.surfaceClassName} ${activeCategory.accentClassName}`}><ActiveCategoryIcon size={20} /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{activeCategory.eyebrow}</p>
                    <h2 className={PLATFORM_SECTION_TITLE_CLASS}>{activeCategory.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{activeCategory.description}</p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="grid gap-6 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-4">
                  <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                    <div className={`flex-1 rounded-xl px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] transition-all ${composeStep === 1 ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      1. Categoria
                    </div>
                    <div className={`flex-1 rounded-xl px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] transition-all ${composeStep === 2 ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      2. Assunto
                    </div>
                  </div>

                  {composeStep === 1 ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Escolha a categoria</p>
                        <h3 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">Direcione o atendimento antes de abrir o chamado</h3>
                      </div>
                      <div className="grid gap-3">
                        {SUPPORT_CATEGORIES.filter((category) => category.id !== 'donation').map((category) => {
                          const Icon = category.icon;
                          const isSelected = activeTab === category.id;

                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setActiveTab(category.id)}
                              className={`w-full rounded-[1.6rem] border p-4 text-left transition-all ${isSelected ? `${category.surfaceClassName} shadow-sm` : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isSelected ? 'bg-white/80 dark:bg-slate-900/60' : 'bg-white dark:bg-slate-900'} ${category.accentClassName}`}>
                                    <Icon size={18} />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{category.eyebrow}</p>
                                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{category.title}</p>
                                    <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{category.description}</p>
                                  </div>
                                </div>
                                <ChevronRight size={16} className={isSelected ? category.accentClassName : 'text-slate-400'} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Categoria selecionada</p>
                        <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{activeCategory.title}</p>
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Assunto</label>
                        <input
                          type="text"
                          value={subject}
                          onChange={(event) => setSubject(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                          placeholder={activeCategory.subjectPlaceholder}
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Descricao</label>
                        <textarea
                          value={details}
                          onChange={(event) => setDetails(event.target.value)}
                          className="h-44 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                          placeholder={activeCategory.placeholder}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Antes de enviar</p>
                    <div className="mt-3 space-y-3">
                      {topGuides.map((tip) => (<p key={tip} className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{tip}</p>))}
                    </div>
                  </div>
                  {!canSubmitThread ? (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                      Aguarde a sessao carregar para enviar.
                    </p>
                  ) : null}
                  {composeStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setComposeStep(2);
                      }}
                      disabled={!canSubmitThread}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    >
                      Continuar
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <button
                        type="submit"
                        disabled={isSubmitting || !canSubmitThread}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                      >
                        <Send size={16} />
                        {isSubmitting ? 'Enviando...' : 'Enviar solicitacao'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeStep(1)}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        Voltar para a categoria
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </section>
          )}

          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6 md:p-8`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Historico</p>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Suas conversas recentes</h2>
                <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>Acompanhe chamados abertos, respostas do suporte e novas interacoes no mesmo lugar.</p>
              </div>
              <div className="inline-flex rounded-2xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{filteredHistory.length} item(ns)</div>
            </div>
            <div className="mt-6 space-y-4">
              {filteredHistory.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">Nenhuma conversa aberta ainda.</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Assim que voce enviar algo, o historico vai aparecer aqui com status e respostas.</p>
                </div>
              ) : filteredHistory.map((thread) => {
                const statusMeta = STATUS_META[thread.status];
                const isExpanded = expandedFeedbackId === thread.id;
                const threadReplies = replies[thread.id] || [];
                const isLocalThread = thread.id < 0;
                return (
                  <div key={thread.id} className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <button type="button" onClick={() => void toggleFeedback(thread.id)} className="w-full px-5 py-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusMeta.className}`}>{statusMeta.label}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{new Date(thread.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="mt-3 text-base font-black text-slate-900 dark:text-slate-100">{thread.reason || 'Sem resumo'}</p>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{thread.details}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Respostas</p>
                          <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{thread.reply_count || 0}</p>
                          <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-300">{isExpanded ? 'Ocultar conversa' : 'Abrir conversa'}</p>
                        </div>
                      </div>
                    </button>
                    {isExpanded ? (
                      <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/70">
                        <div className="space-y-3">
                          {loadingReplies === thread.id ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Carregando respostas...</div>
                          ) : threadReplies.length > 0 ? threadReplies.map((reply) => {
                            const isUserReply = reply.user_id === currentUser?.id;
                            return (
                              <div key={reply.id} className={`rounded-2xl border px-4 py-4 ${isUserReply ? 'ml-6 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'mr-6 border-indigo-200 bg-indigo-50/80 dark:border-indigo-500/20 dark:bg-indigo-500/10'}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{isUserReply ? 'Voce' : 'Suporte'}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{new Date(reply.created_at).toLocaleString()}</p>
                                </div>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{reply.details}</p>
                              </div>
                            );
                          }) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Nenhuma resposta ainda.</div>
                          )}
                        </div>
                        {isLocalThread ? (
                          <p className="mt-4 rounded-[1.6rem] border border-amber-200 bg-amber-50 p-4 text-xs font-medium leading-5 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                            Conversa enviada e aguardando sincronizacao do historico oficial.
                          </p>
                        ) : (
                          <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Responder conversa</p>
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                              <input type="text" value={replyDrafts[thread.id] || ''} onChange={(event) => setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [thread.id]: event.target.value }))} placeholder="Escreva sua resposta..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900" />
                              <button type="button" onClick={() => void handleReplySubmit(thread)} disabled={sendingReplyId === thread.id || !(replyDrafts[thread.id] || '').trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500">
                                <Send size={15} />
                                {sendingReplyId === thread.id ? 'Enviando...' : 'Responder'}
                              </button>
                            </div>
                            <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Quando houver resposta do suporte pelo painel administrativo, a conversa continua aqui e o historico fica centralizado.</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Support;
