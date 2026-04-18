'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock, Send, XCircle } from 'lucide-react';
import { normalizeQuestionRichHtml } from '@/services/questions/questionHtmlSanitizer';
import type { Question, UserAnswer } from '@/types';

type QuestionAttemptCardProps = {
  answer?: UserAnswer;
  canAnswer?: boolean;
  hideFeedback?: boolean;
  indexDisplay?: number;
  isSaving?: boolean;
  lockedMessage?: string;
  mode?: 'practice' | 'simulation' | 'review';
  onAnswerSubmit: (answer: UserAnswer) => void | Promise<void>;
  onAuthRequired?: () => void;
  question: Question;
};

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveCorrectOptionIndex = (question: Question): number => {
  const rawAnswer = question.resposta;
  const numericAnswer = toNumber(rawAnswer);
  const normalizedAnswer = String(rawAnswer ?? '').trim().toLowerCase();

  const byId = question.itens?.findIndex((item) => toNumber(item.id) === numericAnswer);
  if (typeof byId === 'number' && byId >= 0) {
    return byId;
  }

  const byZeroBasedIndex = question.itens?.findIndex((_, index) => index === numericAnswer);
  if (typeof byZeroBasedIndex === 'number' && byZeroBasedIndex >= 0) {
    return byZeroBasedIndex;
  }

  const byOneBasedIndex = question.itens?.findIndex((_, index) => index + 1 === numericAnswer);
  if (typeof byOneBasedIndex === 'number' && byOneBasedIndex >= 0) {
    return byOneBasedIndex;
  }

  const byLabel = question.itens?.findIndex((item, index) => {
    const label = String(item.rotulo || optionLetters[index] || '').trim().toLowerCase();
    return label === normalizedAnswer;
  });

  return typeof byLabel === 'number' && byLabel >= 0 ? byLabel : -1;
};

const getQuestionTitle = (question: Question) => (
  question.assuntos?.find((item) => item.materia)?.nome
  || question.assuntos?.[0]?.nome
  || question.topic
  || 'Questao'
);

export default function QuestionAttemptCard({
  answer,
  canAnswer = true,
  hideFeedback = false,
  indexDisplay,
  isSaving = false,
  lockedMessage = 'Entre para responder e salvar seu historico.',
  mode = 'practice',
  onAnswerSubmit,
  onAuthRequired,
  question,
}: QuestionAttemptCardProps) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [localAnswer, setLocalAnswer] = useState<UserAnswer | undefined>(answer);

  useEffect(() => {
    setSelectedOptionIndex(answer?.selectedOptionIndex ?? null);
    setLocalAnswer(answer);
  }, [answer, question.id]);

  const correctOptionIndex = useMemo(() => resolveCorrectOptionIndex(question), [question]);
  const submittedAnswer = answer || localAnswer;
  const isSubmitted = submittedAnswer?.selectedOptionIndex !== undefined;
  const selectedIndex = submittedAnswer?.selectedOptionIndex ?? selectedOptionIndex;
  const isCorrect = submittedAnswer?.isCorrect ?? (
    selectedOptionIndex !== null && correctOptionIndex >= 0 && selectedOptionIndex === correctOptionIndex
  );
  const shouldShowFeedback = isSubmitted && !hideFeedback;

  const handleSubmit = async () => {
    if (!canAnswer) {
      onAuthRequired?.();
      return;
    }

    if (selectedOptionIndex === null || selectedOptionIndex === undefined) {
      return;
    }

    const nextAnswer: UserAnswer = {
      questionId: Number(question.id),
      selectedOptionIndex,
      isCorrect: correctOptionIndex >= 0 && selectedOptionIndex === correctOptionIndex,
      timestamp: Date.now(),
    };

    setLocalAnswer(nextAnswer);
    await onAnswerSubmit(nextAnswer);
  };

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              {mode === 'simulation' ? 'Simulado' : mode === 'review' ? 'Revisao' : 'Pratica'}
            </p>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {indexDisplay ? `Questao ${indexDisplay}` : 'Questao'}: {getQuestionTitle(question)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {question.bancas?.[0] ? (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                {question.bancas[0].sigla || question.bancas[0].nome}
              </span>
            ) : null}
            {question.anos?.[0] ? (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                {question.anos[0]}
              </span>
            ) : null}
            {question.dificuldade ? (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                Dificuldade {question.dificuldade}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div
          className="prose prose-slate max-w-none text-sm leading-7 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(question.enunciado || question.enunciado_clean || '') }}
        />

        {Array.isArray(question.itens) && question.itens.length > 0 ? (
          <div className="space-y-3">
            {question.itens.map((item, index) => {
              const isSelected = selectedIndex === index;
              const isCorrectOption = correctOptionIndex === index;
              const feedbackClass = shouldShowFeedback
                ? isCorrectOption
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500/70 dark:bg-emerald-950/25 dark:text-emerald-100'
                  : isSelected
                    ? 'border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-500/70 dark:bg-rose-950/25 dark:text-rose-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300'
                : isSelected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500/70 dark:bg-emerald-950/25 dark:text-emerald-100'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-emerald-700';

              return (
                <button
                  key={`${question.id}-${item.id}-${index}`}
                  type="button"
                  disabled={isSubmitted || isSaving}
                  onClick={() => setSelectedOptionIndex(index)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition disabled:cursor-default ${feedbackClass}`}
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                      {item.rotulo || optionLetters[index] || index + 1}
                    </span>
                    <div
                      className="prose prose-slate max-w-none text-sm leading-6 dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(item.corpo || item.corpo_clean || '') }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            Esta questao ainda nao possui alternativas estruturadas.
          </div>
        )}

        {!canAnswer ? (
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            <Lock className="mt-0.5 shrink-0" size={16} />
            {lockedMessage}
          </div>
        ) : null}

        {shouldShowFeedback ? (
          <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-bold ${
            isCorrect
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200'
          }`}>
            {isCorrect ? <CheckCircle2 className="mt-0.5 shrink-0" size={16} /> : <XCircle className="mt-0.5 shrink-0" size={16} />}
            {isCorrect
              ? 'Resposta correta. Progresso registrado.'
              : `Resposta incorreta. Alternativa correta: ${optionLetters[correctOptionIndex] || correctOptionIndex + 1}.`}
          </div>
        ) : null}

        {correctOptionIndex < 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertCircle className="mt-0.5 shrink-0" size={16} />
            O gabarito desta questao precisa ser revisado no banco antes de validar respostas.
          </div>
        ) : null}

        {!isSubmitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || selectedOptionIndex === null || correctOptionIndex < 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
            Responder
          </button>
        ) : null}
      </div>
    </article>
  );
}
