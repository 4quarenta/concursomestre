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
  Check,
  ChevronDown,
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
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [platformArea, setPlatformArea] = useState('Questões');
  const [relatedPage, setRelatedPage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const normalizedDetails = [
        details.trim(),
        platformArea ? `Área da plataforma: ${platformArea}` : '',
        relatedPage.trim() ? `Página relacionada: ${relatedPage.trim()}` : '',
      ].filter(Boolean).join('\n\n');

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

      addToast(
        createdThread.xpGain
          ? `Solicitacao enviada com sucesso. +${createdThread.xpGain} XP.`
          : 'Solicitacao enviada com sucesso.',
        'success',
      );
      setSubject('');
      setDetails('');
      setRelatedPage('');
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

  return (
    <div
      className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 animate-fade-in`}
      data-hydration-interaction
    >
      <nav
        aria-label="Tipo de atendimento"
        className={`grid gap-2 border-b border-slate-200 dark:border-slate-800 ${visibleSupportCategories.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}
      >
        {visibleSupportCategories.map((category) => {
          const Icon = category.icon;
          const isSelected = category.id === activeTab;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveTab(category.id)}
              aria-pressed={isSelected}
              className={`inline-flex min-h-14 flex-col items-center justify-center gap-1 border-b-2 px-1 text-center text-[11px] font-semibold leading-tight transition-colors sm:h-12 sm:min-h-0 sm:flex-row sm:gap-2 sm:text-sm ${isSelected ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300' : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              <Icon size={16} aria-hidden="true" />
              {category.title}
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
            <section aria-labelledby="support-form-title" className="border-b border-slate-200 pb-7 dark:border-slate-800">
              <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.48fr)]">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 id="support-form-title" className="text-lg font-bold text-slate-950 dark:text-white">{activeCategory.title}</h2>
                  <div>
                    <label htmlFor="support-subject" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Assunto</label>
                    <input
                      id="support-subject"
                      type="text"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder={activeCategory.subjectPlaceholder}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="support-area" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Área da plataforma <span className="font-normal text-slate-500">(opcional)</span></label>
                    <select
                      id="support-area"
                      value={platformArea}
                      onChange={(event) => setPlatformArea(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option>Questões</option>
                      <option>Provas</option>
                      <option>Simulados</option>
                      <option>Perfil e conta</option>
                      <option>Assinatura e pagamentos</option>
                      <option>Outro</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="support-details" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Descrição</label>
                    <textarea
                      id="support-details"
                      value={details}
                      onChange={(event) => setDetails(event.target.value)}
                      className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder={activeCategory.placeholder}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="support-related-page" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">Página relacionada <span className="font-normal text-slate-500">(opcional)</span></label>
                    <input
                      id="support-related-page"
                      type="url"
                      value={relatedPage}
                      onChange={(event) => setRelatedPage(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      placeholder="https://"
                    />
                  </div>
                  {!canSubmitThread ? (
                    <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
                      {isLoading ? 'Carregando sessão...' : 'Entre na sua conta para enviar uma solicitação.'}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !canSubmitThread}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      <Send size={15} aria-hidden="true" />
                      {isSubmitting ? 'Enviando...' : 'Enviar solicitação'}
                    </button>
                  </div>
                </form>

                <aside className="border-t border-slate-200 pt-5 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-white">Antes de enviar</h3>
                  <ul className="mt-4 space-y-4">
                    {topGuides.map((tip) => (
                      <li key={tip} className="flex gap-3 text-sm leading-5 text-slate-600 dark:text-slate-300">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check size={14} aria-hidden="true" /></span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">Acompanhe sua solicitação</h3>
                    <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-400">Suas conversas e respostas ficam no histórico do perfil.</p>
                    <Link href="/profile/support-history" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                      Abrir histórico <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </aside>
              </div>
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

          <section aria-labelledby="support-faq-title" className="border-t border-slate-200 pt-6 dark:border-slate-800">
            <h2 id="support-faq-title" className={PLATFORM_SECTION_TITLE_CLASS}>Dúvidas frequentes</h2>
            <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 marker:hidden dark:text-slate-100">
                  Como alterar meus dados pessoais?
                  <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Acesse <Link href="/profile/personal" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">Meu perfil</Link> para atualizar seus dados e preferências.
                </p>
              </details>
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 marker:hidden dark:text-slate-100">
                  Onde encontro as questões que salvei?
                  <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Abra a área de <Link href="/profile/saved-questions" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">questões salvas</Link> no seu perfil.
                </p>
              </details>
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 marker:hidden dark:text-slate-100">
                  Como consultar minha assinatura e pagamentos?
                  <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Consulte o status da assinatura e as opções de cobrança em <Link href="/profile/billing" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">assinatura no perfil</Link>.
                </p>
              </details>
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
