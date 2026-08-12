'use client';

import { BookmarkCheck, ExternalLink, Loader2, Target, Trash2 } from 'lucide-react';
import type { Question } from '../../../types';
import { buildQuestionPath } from '@services/seo';

type SavedQuestionRow = { id: string; question: Question | null };
type AnswerSummary = { questionId: string | number; isCorrect?: boolean };

type Props = {
    rows: SavedQuestionRow[];
    total: number;
    answeredCount: number;
    isLoading: boolean;
    answers: AnswerSummary[];
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadMore: () => void;
    navigate: (href: string) => void;
    remove: (questionId: string) => void;
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (value: string, max: number) => value.length > max ? `${value.slice(0, max).trimEnd()}...` : value;
const title = (question: Question | null, id: string) => question
    ? truncate(stripHtml(question.enunciado_clean || question.enunciado || `Questão #${id}`), 160)
    : `Questão #${id}`;
const subject = (question: Question | null) => {
    const values = Array.isArray(question?.assuntos) ? question.assuntos.map((item) => item.nome || item.name).filter(Boolean) : [];
    return values.length ? values.slice(0, 2).join(' • ') : 'Assunto não informado';
};
const board = (question: Question | null) => {
    const values = Array.isArray(question?.bancas) ? question.bancas.map((item) => item.sigla || item.nome || item.name).filter(Boolean) : [];
    return values.length ? values.slice(0, 2).join(' / ') : 'Banca não informada';
};
const year = (question: Question | null) => {
    const values = Array.isArray(question?.anos) ? question.anos.filter(Boolean) : [];
    return values.length ? values.join(', ') : 'Ano não informado';
};
const difficulty = (question: Question | null) => question
    ? question.difficulty || ['', 'Muito Fácil', 'Fácil', 'Médio', 'Difícil', 'Muito Difícil'][Number(question.dificuldade)] || `Dificuldade ${question.dificuldade || '-'}`
    : 'Dificuldade não informada';

const Metric = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{value}</p>
    </div>
);

export default function SavedQuestionsPanel({ rows, total, answeredCount, isLoading, answers, hasNextPage, isFetchingNextPage, loadMore, navigate, remove }: Props) {
    return <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Questões salvas</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Seu banco pessoal para voltar, revisar e resolver depois.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">{total} salvas</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Total salvo" value={total} />
            <Metric label="Carregadas" value={rows.filter((row) => row.question).length} />
            <Metric label="Respondidas" value={answeredCount} />
        </div>
        {isLoading && rows.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Loader2 size={36} className="mx-auto mb-3 animate-spin text-indigo-400" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando questões salvas...</p>
        </div> : rows.length > 0 ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500"><span>Questão</span><span>Ação</span></div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map(({ id, question }) => {
                const publicHref = question ? buildQuestionPath(question) : `/practice?questionId=${id}`;
                const answer = answers.find((item) => String(item.questionId) === id);
                return <article key={id} className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/60"><BookmarkCheck size={12} />Salva</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Q{id}</span>
                            {answer && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${answer.isCorrect ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-900/25 dark:text-rose-300'}`}>{answer.isCorrect ? 'Certa' : 'Errada'}</span>}
                            {!question && isLoading && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Loader2 size={11} className="animate-spin" />Carregando</span>}
                        </div>
                        <button type="button" onClick={() => navigate(publicHref)} className="mt-2 block max-w-full text-left text-sm font-black text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-300">{title(question, id)}</button>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{question ? subject(question) : 'Detalhes da questão ainda não carregados.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">{[board(question), year(question), difficulty(question)].map((label) => <span key={label} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">{label}</span>)}</div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => navigate(`/practice?questionId=${id}`)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700"><Target size={13} />Resolver</button>
                        <button type="button" onClick={() => navigate(publicHref)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><ExternalLink size={13} />Abrir</button>
                        <button type="button" onClick={() => remove(id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300" title="Remover dos salvos" aria-label="Remover dos salvos"><Trash2 size={14} /></button>
                    </div>
                </article>;
            })}</div>
        </div> : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <BookmarkCheck size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma questão salva.</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Use o marcador nas questões para montar seu banco pessoal.</p>
        </div>}
        {hasNextPage && <div className="flex justify-center">
            <button type="button" onClick={loadMore} disabled={isFetchingNextPage} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {isFetchingNextPage && <Loader2 size={14} className="animate-spin" />}
                Carregar mais
            </button>
        </div>}
    </div>;
}
