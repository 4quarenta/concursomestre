'use client';

import React from 'react';
import { Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { readApiErrorMessage } from '@services/api';
import {
  supportService,
  type PublicSuggestion,
  type PublicSuggestionVote,
} from '@services/support/supportService';

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Em votação', className: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
  under_review: { label: 'Em análise', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  approved: { label: 'Aprovada', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  planned: { label: 'Planejada', className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  in_progress: { label: 'Em desenvolvimento', className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  completed: { label: 'Concluída', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' },
};

export const applyPublicSuggestionVote = (
  suggestion: PublicSuggestion,
  nextVote: PublicSuggestionVote | null,
): PublicSuggestion => {
  let likes = Number(suggestion.likes || 0);
  let dislikes = Number(suggestion.dislikes || 0);

  if (suggestion.user_vote === 'like') likes = Math.max(0, likes - 1);
  if (suggestion.user_vote === 'dislike') dislikes = Math.max(0, dislikes - 1);
  if (nextVote === 'like') likes += 1;
  if (nextVote === 'dislike') dislikes += 1;

  return { ...suggestion, likes, dislikes, score: likes - dislikes, user_vote: nextVote };
};

export default function PublicSuggestionsBoard({ initialSuggestions }: { initialSuggestions: PublicSuggestion[] }) {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();
  const { addToast } = useToast();
  const [suggestions, setSuggestions] = React.useState(initialSuggestions);
  const [votingId, setVotingId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!currentUser) return;
    let active = true;
    supportService.listPublicSuggestions()
      .then((items) => { if (active) setSuggestions(items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [currentUser]);

  const vote = async (suggestion: PublicSuggestion, value: PublicSuggestionVote) => {
    if (isLoading) return;
    if (!currentUser) {
      window.sessionStorage.setItem('redirectAfterLogin', '/novidades#sugestoes');
      router.push('/auth');
      return;
    }

    const nextVote = suggestion.user_vote === value ? null : value;
    const previous = suggestion;
    setVotingId(suggestion.id);
    setSuggestions((items) => items.map((item) => (
      item.id === suggestion.id ? applyPublicSuggestionVote(item, nextVote) : item
    )));

    try {
      const saved = await supportService.votePublicSuggestion(suggestion.id, nextVote);
      if (saved) {
        setSuggestions((items) => items.map((item) => item.id === saved.id ? saved : item));
      }
    } catch (error) {
      setSuggestions((items) => items.map((item) => item.id === previous.id ? previous : item));
      addToast(readApiErrorMessage(error, 'Não foi possível registrar seu voto.'), 'error');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <section id="sugestoes" className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
          <Lightbulb size={16} /> Ideias da comunidade
        </div>
        <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 dark:text-white">Sugestões em votação</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Acompanhe as melhorias aprovadas e ajude a definir as próximas prioridades do ConcursoMestre.
        </p>

        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {suggestions.length === 0 ? (
            <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-slate-950 dark:text-white">Nenhuma sugestão moderada está em votação.</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Envie uma ideia para a equipe avaliar e publicar neste espaço.</p>
              </div>
              <Link href="/support?category=feedback" className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700">
                Enviar sugestão
              </Link>
            </div>
          ) : suggestions.map((suggestion) => {
            const status = STATUS_META[suggestion.product_status || 'pending'] || STATUS_META.pending;
            const isVoting = votingId === suggestion.id;
            return (
              <article key={suggestion.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${status.className}`}>{status.label}</span>
                    {suggestion.platform_version ? (
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Versão {suggestion.platform_version}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-black text-slate-950 dark:text-white">{suggestion.reason}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{suggestion.details}</p>
                </div>
                <div className="flex items-center gap-2" aria-label="Votação da sugestão">
                  <button type="button" disabled={isVoting} aria-pressed={suggestion.user_vote === 'like'} onClick={() => void vote(suggestion, 'like')} className={`inline-flex h-10 min-w-20 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-black transition-colors disabled:opacity-60 ${suggestion.user_vote === 'like' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300'}`}>
                    <ThumbsUp size={15} /> {suggestion.likes}
                  </button>
                  <button type="button" disabled={isVoting} aria-pressed={suggestion.user_vote === 'dislike'} onClick={() => void vote(suggestion, 'dislike')} className={`inline-flex h-10 min-w-20 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-black transition-colors disabled:opacity-60 ${suggestion.user_vote === 'dislike' ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-300 text-slate-600 hover:border-rose-400 hover:text-rose-700 dark:border-slate-700 dark:text-slate-300'}`}>
                    <ThumbsDown size={15} /> {suggestion.dislikes}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
