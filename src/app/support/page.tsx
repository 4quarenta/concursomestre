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

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bug,
  ChevronRight,
  Coffee,
  CreditCard,
  Heart,
  Info,
  MessageSquare,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { useSearchParams } from 'next/navigation';
import { useEffectiveSystemSettings } from '@providers/AppConfigProvider';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { readApiErrorMessage } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { isSupportCategoryEnabled } from '@services/support/supportFeature';
import { supportService, type PublicSuggestion, type PublicSuggestionVote, type SupportThread } from '@services/support/supportService';

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
    description: 'Use esta área para erros de acesso, páginas que não carregam, lentidão, travamentos, falha no login, pagamento ou recursos indisponíveis.',
    placeholder: 'Conte o que aconteceu, quais passos você fez e o que esperava ver.',
    subjectPlaceholder: 'Ex: erro ao salvar questão',
    serviceType: 'bug',
    icon: Bug,
    accentClassName: 'text-rose-600 dark:text-rose-300',
    surfaceClassName: 'border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10',
  },
  {
    id: 'feedback',
    title: 'Enviar sugestão',
    eyebrow: 'Produto',
    description: 'Use esta área para novas funcionalidades, melhorias de interface, experiência de estudo, IA, aplicativo e desempenho.',
    placeholder: 'Descreva a melhoria, o benefício para o estudo e o contexto em que ela faria diferença.',
    subjectPlaceholder: 'Ex: melhorar filtros de questões',
    serviceType: 'suggestion',
    icon: MessageSquare,
    accentClassName: 'text-indigo-600 dark:text-indigo-300',
    surfaceClassName: 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/20 dark:bg-indigo-500/10',
  },
  {
    id: 'info',
    title: 'Solicitar ajuda',
    eyebrow: 'Suporte',
    description: 'Use esta área para dúvidas sobre conta, assinatura, cobranças, renovação, reembolso, materiais e uso da plataforma.',
    placeholder: 'Explique a dúvida com o máximo de contexto para acelerar a resposta.',
    subjectPlaceholder: 'Ex: dúvida sobre renovação',
    serviceType: 'support',
    icon: Info,
    accentClassName: 'text-sky-600 dark:text-sky-300',
    surfaceClassName: 'border-sky-200 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10',
  },
  {
    id: 'donation',
    title: 'Apoiar a plataforma',
    eyebrow: 'Comunidade',
    description: 'Aqui ficam as formas de contribuir financeiramente com a manutenção e a evolução do ConcursoMestre.',
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
  return [
    ...localThreads.filter((thread) => !officialIds.has(thread.id)),
    ...officialThreads,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const applyPublicSuggestionVote = (
  suggestion: PublicSuggestion,
  nextVote: PublicSuggestionVote | null,
): PublicSuggestion => {
  let likes = Number(suggestion.likes || 0);
  let dislikes = Number(suggestion.dislikes || 0);
  const previousVote = suggestion.user_vote || null;

  if (previousVote === 'like') {
    likes = Math.max(0, likes - 1);
  }
  if (previousVote === 'dislike') {
    dislikes = Math.max(0, dislikes - 1);
  }
  if (nextVote === 'like') {
    likes += 1;
  }
  if (nextVote === 'dislike') {
    dislikes += 1;
  }

  return {
    ...suggestion,
    likes,
    dislikes,
    score: likes - dislikes,
    user_vote: nextVote,
  };
};

/**
 * Organiza a central de suporte em um workspace mais claro.
 * A página separa categoria, formulário, histórico e doação sem misturar prioridades.
 *
 * @since 1.0.0
 */
const SupportContent: React.FC = () => {
  const { currentUser, isLoading, updateUser } = useAuth();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const { systemSettings, isSystemSettingsLoaded } = useEffectiveSystemSettings();
  const supportDonationsEnabled = isSystemSettingsLoaded
    && resolveSystemFeatureFlag(systemSettings, 'supportDonationsEnabled', false);
  const pixKey = systemSettings?.pixKey || 'pix@concursomestre.com.br';
  const [activeTab, setActiveTab] = useState<SupportTab>('bug');
  const [composeStep, setComposeStep] = useState<1 | 2>(2);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<SupportThread[]>([]);
  const [publicSuggestions, setPublicSuggestions] = useState<PublicSuggestion[]>([]);
  const [isLoadingPublicSuggestions, setIsLoadingPublicSuggestions] = useState(false);
  const [votingSuggestionId, setVotingSuggestionId] = useState<number | null>(null);

  const visibleSupportCategories = useMemo(
    () => SUPPORT_CATEGORIES.filter((category) => isSupportCategoryEnabled(category.id, supportDonationsEnabled)),
    [supportDonationsEnabled],
  );
  const activeCategory = useMemo(
    () => visibleSupportCategories.find((category) => category.id === activeTab) ?? visibleSupportCategories[0],
    [activeTab, visibleSupportCategories],
  );
  const canSubmitThread = Boolean(currentUser && !isLoading && activeCategory.serviceType);

  useEffect(() => {
    if (!isSystemSettingsLoaded) {
      return;
    }

    const requestedCategory = String(searchParams?.get('category') || searchParams?.get('tab') || '').trim();
    if (!['bug', 'feedback', 'info', 'donation'].includes(requestedCategory)) {
      return;
    }

    if (!isSupportCategoryEnabled(requestedCategory, supportDonationsEnabled)) {
      setActiveTab('bug');
      return;
    }

    const categoryFrame = window.requestAnimationFrame(() => {
      setActiveTab(requestedCategory as SupportTab);
    });

    return () => window.cancelAnimationFrame(categoryFrame);
  }, [isSystemSettingsLoaded, searchParams, supportDonationsEnabled]);

  useEffect(() => {
    if (isSystemSettingsLoaded && !supportDonationsEnabled && activeTab === 'donation') {
      setActiveTab('bug');
    }
  }, [activeTab, isSystemSettingsLoaded, supportDonationsEnabled]);

  /**
   * Busca o histórico oficial do usuário ao trocar de contexto.
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
      clientLog.warn('Error fetching feedback history', error);
      if (notifyOnError) {
        addToast(readApiErrorMessage(error, 'Não foi possível carregar seu histórico agora.'), 'error');
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

  const fetchPublicSuggestions = React.useCallback(async (notifyOnError = false) => {
    if (!currentUser) {
      setPublicSuggestions([]);
      return;
    }

    setIsLoadingPublicSuggestions(true);

    try {
      const suggestions = await supportService.listPublicSuggestions();
      setPublicSuggestions(suggestions);
    } catch (error) {
      clientLog.warn('Error fetching public suggestions', error);
      if (notifyOnError) {
        addToast(readApiErrorMessage(error, 'Nao foi possivel carregar as sugestoes da comunidade.'), 'error');
      }
    } finally {
      setIsLoadingPublicSuggestions(false);
    }
  }, [addToast, currentUser]);

  useEffect(() => {
    if (activeTab !== 'feedback') {
      return;
    }

    const suggestionsTimer = window.setTimeout(() => {
      void fetchPublicSuggestions(false);
    }, 0);

    return () => window.clearTimeout(suggestionsTimer);
  }, [activeTab, fetchPublicSuggestions]);

  /**
   * Envia um novo chamado do usuario.
   *
   * @since 1.0.0
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmitThread || !activeCategory.serviceType) {
      addToast('Sua sessão ainda não está pronta para enviar.', 'warning');
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
      if (createdThread.newXp !== undefined || createdThread.newLevel !== undefined) {
        await updateUser({
          ...(createdThread.newXp !== undefined ? { xp: createdThread.newXp } : {}),
          ...(createdThread.newLevel !== undefined ? { level: createdThread.newLevel } : {}),
        });
      }

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

      addToast(
        createdThread.xpGain
          ? `Solicitacao enviada com sucesso. +${createdThread.xpGain} XP.`
          : 'Solicitacao enviada com sucesso.',
        'success',
      );
      setSubject('');
      setDetails('');
      if (activeCategory.serviceType === 'suggestion') {
        void fetchPublicSuggestions(false);
      }
    } catch (error) {
      clientLog.warn('Error creating support thread', error);
      addToast(readApiErrorMessage(error, 'Não foi possível enviar sua solicitação.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublicSuggestionVote = async (suggestion: PublicSuggestion, value: PublicSuggestionVote) => {
    if (!currentUser) {
      addToast('Faca login para votar em sugestoes.', 'warning');
      return;
    }

    const nextVote = suggestion.user_vote === value ? null : value;
    setVotingSuggestionId(suggestion.id);
    setPublicSuggestions((currentSuggestions) => currentSuggestions.map((item) => (
      item.id === suggestion.id ? applyPublicSuggestionVote(item, nextVote) : item
    )));

    try {
      const updatedSuggestion = await supportService.votePublicSuggestion(suggestion.id, nextVote);
      if (updatedSuggestion) {
        setPublicSuggestions((currentSuggestions) => currentSuggestions.map((item) => (
          item.id === updatedSuggestion.id ? updatedSuggestion : item
        )));
      }
    } catch (error) {
      clientLog.warn('Error voting public suggestion', error);
      setPublicSuggestions((currentSuggestions) => currentSuggestions.map((item) => (
        item.id === suggestion.id ? suggestion : item
      )));
      addToast(readApiErrorMessage(error, 'Nao foi possivel registrar seu voto.'), 'error');
    } finally {
      setVotingSuggestionId(null);
    }
  };

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
      'A chave PIX fica disponível logo abaixo.',
      'As contribuicoes ajudam servidor, manutencao e melhorias.',
      'Use apenas os canais oficiais mostrados nesta tela.',
    ];
  }, [activeTab]);

  const ActiveCategoryIcon = activeCategory.icon;

  return (
    <div
      className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 animate-fade-in`}
      data-hydration-interaction
    >
      <nav aria-label="Tipo de atendimento" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleSupportCategories.map((category) => {
          const Icon = category.icon;
          const isSelected = category.id === activeTab;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveTab(category.id)}
              aria-pressed={isSelected}
              className={`flex min-h-20 items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${isSelected ? category.surfaceClassName : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900'}`}
            >
              <Icon size={19} className={isSelected ? category.accentClassName : 'text-slate-400'} />
              <span>
                <span className="block text-sm font-black text-slate-900 dark:text-slate-100">{category.title}</span>
                <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{category.eyebrow}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-6">
          {activeTab === 'donation' && supportDonationsEnabled ? (
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
                    O projeto continua evoluindo com manutenção constante, servidor, desenvolvimento e revisão de conteúdo. Se a plataforma te ajuda de verdade, esta é a área oficial para contribuir.
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
                  <div className="hidden">
                    <div className={`flex-1 rounded-xl px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] transition-all ${composeStep === 1 ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      1. Categoria
                    </div>
                    <div className={`flex-1 rounded-xl px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] transition-all ${composeStep === 2 ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      2. Assunto
                    </div>
                  </div>

                  {false ? (
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
                      Aguarde a sessão carregar para enviar.
                    </p>
                  ) : null}
                  {false ? (
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
                        {isSubmitting ? 'Enviando...' : 'Enviar solicitação'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeStep(1)}
                        className="hidden"
                      >
                        Voltar para a categoria
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </section>
          )}

          {activeTab === 'feedback' ? (
            <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6 md:p-8`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Comunidade</p>
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Sugestoes dos alunos</h2>
                  <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>Vote nas melhorias que tambem fariam diferenca no seu estudo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchPublicSuggestions(true)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  Atualizar
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {isLoadingPublicSuggestions ? (
                  <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    Carregando sugestoes...
                  </div>
                ) : publicSuggestions.length === 0 ? (
                  <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">Nenhuma sugestao publicada ainda.</p>
                    <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Quando alunos enviarem sugestoes, elas aparecerao aqui para votacao.</p>
                  </div>
                ) : publicSuggestions.map((suggestion) => {
                  const isVoting = votingSuggestionId === suggestion.id;
                  const liked = suggestion.user_vote === 'like';
                  const disliked = suggestion.user_vote === 'dislike';

                  return (
                    <article key={suggestion.id} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${STATUS_META[suggestion.status]?.className || STATUS_META.new.className}`}>
                              {STATUS_META[suggestion.status]?.label || 'Aberto'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                              {suggestion.created_at ? new Date(suggestion.created_at).toLocaleDateString() : 'Sem data'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                              {suggestion.user_name || 'Aluno'}
                            </span>
                          </div>
                          <h3 className="mt-3 text-base font-black text-slate-900 dark:text-slate-100">{suggestion.reason || 'Sugestao sem titulo'}</h3>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{suggestion.details}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-stretch">
                          <button
                            type="button"
                            onClick={() => void handlePublicSuggestionVote(suggestion, 'like')}
                            disabled={isVoting}
                            aria-pressed={liked}
                            className={`inline-flex h-10 min-w-20 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition-all disabled:cursor-wait disabled:opacity-70 ${liked ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-emerald-700 dark:hover:text-emerald-300'}`}
                          >
                            <ThumbsUp size={15} />
                            {suggestion.likes}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePublicSuggestionVote(suggestion, 'dislike')}
                            disabled={isVoting}
                            aria-pressed={disliked}
                            className={`inline-flex h-10 min-w-20 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition-all disabled:cursor-wait disabled:opacity-70 ${disliked ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-500/10 dark:text-red-300' : 'border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-700 dark:hover:text-red-300'}`}
                          >
                            <ThumbsDown size={15} />
                            {suggestion.dislikes}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6 md:p-8`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Histórico</p>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Conversas no perfil</h2>
                <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                  O acompanhamento de chamados e respostas agora fica centralizado em Meu Perfil.
                </p>
              </div>
              <Link
                href="/profile/support-history"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.16em] text-white transition-all hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                <MessageSquare size={15} />
                Abrir histórico
              </Link>
            </div>
          </section>
      </div>
    </div>
  );
};

const Support: React.FC = () => (
  <Suspense fallback={null}>
    <SupportContent />
  </Suspense>
);

export default Support;
