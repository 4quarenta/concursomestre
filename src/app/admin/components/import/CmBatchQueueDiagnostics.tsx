'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { queueDiagnostic, type CmBatchQueueItem } from './cmBatchDiagnostics';

type QuestionPlan = { examExternalKey: string; tempId: string; questionNumber?: number | string | null; externalQuestionId?: string | null; reason?: string; candidateQuestionIds?: number[]; externalIdentityQuestionIds?: number[] };
type Props = {
  items: CmBatchQueueItem[];
  exams: Array<{ externalKey: string; metadata: Record<string, string> }>;
  questions: QuestionPlan[];
};
const labels: Record<string, string> = { blocked: 'Bloqueado', failed: 'Falha', planned: 'Pendente', retry: 'Nova tentativa', done: 'Concluído' };

export default function CmBatchQueueDiagnostics({ items, exams, questions }: Props) {
  const [status, setStatus] = useState('attention');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const questionMap = new Map(questions.map((question) => [`${question.examExternalKey}:${question.tempId}`, question]));
  const examMap = new Map(exams.map((exam) => [exam.externalKey, exam.metadata.examTitle || exam.externalKey]));
  const rows = items.map((item) => {
    const question = questionMap.get(item.externalKey);
    const examKey = question?.examExternalKey || (item.entityType === 'exam' ? item.externalKey : '');
    return { item, question, examName: examMap.get(examKey) || examKey, ...queueDiagnostic(item) };
  });
  const filtered = rows.filter((row) => {
    const statusMatches = status === 'all' || (status === 'attention' ? row.item.status !== 'done' : row.item.status === status);
    return statusMatches && [row.item.externalKey, row.item.canonicalId, row.examName, row.question?.externalQuestionId, row.message, row.technical].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  });
  const groups = new Map<string, number>();
  for (const row of filtered) groups.set(row.message, (groups.get(row.message) || 0) + 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const control = 'rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

  return <section aria-label="Diagnóstico da fila" className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
    <h3 className="font-semibold">Detalhes do processamento</h3>
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar por motivo, prova ou ID</span><Search size={16} aria-hidden className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Buscar motivo, prova ou ID" className={`${control} w-full pl-9`} /></label>
      <label><span className="sr-only">Situação dos itens</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className={`${control} w-full`}><option value="attention">Pendências, bloqueios e falhas</option><option value="all">Todos os itens</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label} ({items.filter((item) => item.status === value).length})</option>)}</select></label>
    </div>
    <details open className="text-sm"><summary className="cursor-pointer font-medium">Resumo por motivo ({groups.size})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto">{Array.from(groups).sort((a, b) => b[1] - a[1]).map(([message, count]) => <li key={message} className="flex gap-3 border-b border-slate-100 pb-2 dark:border-slate-800"><strong className="w-10 shrink-0 text-right tabular-nums">{count}</strong><span className="break-words">{message}</span></li>)}</ul></details>
    <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{filtered.length} itens encontrados · página {currentPage + 1} de {pageCount}</p>
    {filtered.length === 0 && <p className="text-sm">Nenhum item corresponde aos filtros selecionados.</p>}
    <ul className="divide-y divide-slate-200 dark:divide-slate-700">{filtered.slice(currentPage * 25, currentPage * 25 + 25).map((row) => <li key={row.item.id} className="min-w-0 space-y-2 py-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong className="min-w-0 break-words">{row.item.entityType === 'exam' ? 'Prova' : `Questão ${row.question?.questionNumber ?? row.question?.tempId ?? ''}`} · {row.examName || row.item.externalKey}</strong><span className="shrink-0 text-xs font-semibold">{labels[row.item.status] || row.item.status}</span></div>
      <p className="break-words">{row.message}</p><p className="text-xs text-slate-600 dark:text-slate-400">{row.nextStep}</p>
      <p className="break-all text-xs text-slate-500 dark:text-slate-400">Chave: {row.item.externalKey} · ID Gran: {row.question?.externalQuestionId || 'Não informado'} · ID CM: {row.item.canonicalId || 'Não vinculado'} · Tentativas: {row.item.attempts}</p>
      <details><summary className="cursor-pointer text-xs font-medium">Ver diagnóstico técnico e prévia</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">{JSON.stringify({ diagnostics: row.item.diagnostics, plan: row.question ?? null }, null, 2)}</pre></details>
    </li>)}</ul>
    <div className="flex justify-end gap-2"><button type="button" aria-label="Página anterior dos diagnósticos" title="Página anterior" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={`${control} disabled:opacity-40`}><ChevronLeft size={18} /></button><button type="button" aria-label="Próxima página dos diagnósticos" title="Próxima página" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className={`${control} disabled:opacity-40`}><ChevronRight size={18} /></button></div>
  </section>;
}
