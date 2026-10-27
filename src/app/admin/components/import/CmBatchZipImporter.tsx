'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Download, FileCheck2, Loader2, Pause, Play, ShieldCheck, Square } from 'lucide-react';
import { fetchAuthenticatedResource } from '@services/api/client';
import { getCsrfToken } from '@services/auth/session';
import CmBatchQueueDiagnostics from './CmBatchQueueDiagnostics';
import type { CmBatchQueueItem } from './cmBatchDiagnostics';
import { queueActivityLabel, queueProgress } from './cmBatchProgress';

type CmBatchJob = {
  jobId: string | null;
  batchId: string;
  archiveSha256: string;
  datasetLabel: string;
  status: string;
  progress?: { completedExams?: number; completedQuestions?: number; failed?: number; blocked?: number; pending?: number; totalExams?: number; totalQuestions?: number } | null;
  items?: CmBatchQueueItem[];
  planHash: string | null;
  manifest: { yearsCovered?: number[] };
  plan: {
    canonicalWrites: number;
    questionWrites: number;
    taxonomy: { declared: number; matchedExisting: number; needsReview: number; entities: Array<{ category: string; key: string; name: string; parentKey: string | null; status: string; canonicalId: number | null; reason: string }> };
    exams: Array<{
      externalKey: string;
      correctYear: number;
      questionCount: number;
      needsReview: number;
      action: 'create' | 'link' | 'conflict' | 'needs_review';
      metadata: Record<string, string>;
      missingFields: string[];
      provenance: { source?: { provider?: string; externalExamId?: string; sourceFile?: string } };
      questionSamples: Array<{ tempId: string; questionNumber: number | string | null; statement: string; type: string; reviewStatus: string; answerStatus: string }>;
    }>;
    warnings: Array<{ code: string; examExternalKey?: string; questionTempId?: string }>;
    questions: { total: number; needsReview: number; pendingPublication: number; publishable: number; actions: Record<string, number>; items?: Array<{ action: string; examExternalKey: string; tempId: string; questionNumber?: number | string | null; externalQuestionId?: string | null; reason?: string; externalIdentityQuestionIds?: number[]; candidateQuestionIds?: number[] }> };
    mediaCount: number;
    blockers: string[];
  };
};

export default function CmBatchZipImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<CmBatchJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [lastResponse, setLastResponse] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const runner = useRef(false);
  const stopRequested = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(timer); stopRequested.current = true; };
  }, []);
  const [selectedKey, setSelectedKey] = useState('');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Array<{ id: number; name: string }>>([]);
  const [canonicalId, setCanonicalId] = useState('');
  const [reason, setReason] = useState('');
  const requestVersion = useRef(0);
  const selected = job?.plan.taxonomy.entities.find((entity) => `${entity.category}:${entity.key}` === selectedKey);
  const canStart = Boolean(job?.jobId && job.status === 'needs_review' && job.planHash && !busy);
  const skippedExamKeys = new Set((job?.plan.exams ?? []).filter((exam) => ['blocked', 'conflict', 'needs_review'].includes(exam.action)).map((exam) => exam.externalKey));
  const skippedQuestionItems = (job?.plan.questions.items ?? []).filter((question) => ['blocked', 'conflict', 'needs_review'].includes(question.action) || skippedExamKeys.has(question.examExternalKey));

  const searchCandidates = async () => {
    if (!job?.jobId || !selected || busy) return;
    const version = ++requestVersion.current;
    setBusy(true);
    setError('');
    setCandidates([]);
    setCanonicalId('');
    try {
      const params = new URLSearchParams({ action: 'taxonomy_candidates', job_id: job.jobId, category: selected.category, key: selected.key, search });
      const response = await fetchAuthenticatedResource(`admin/cm_batch.php?${params}`);
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Falha ao buscar cadastros.');
      if (version === requestVersion.current) setCandidates(payload.data ?? payload);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Falha na pesquisa.');
    } finally {
      setBusy(false);
    }
  };

  const resolveTaxonomy = async (operation: 'link' | 'propose_create') => {
    if (!job?.jobId || !job.planHash || !selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const csrfToken = getCsrfToken();
      if (!csrfToken) throw new Error('Atualize a sessão antes de registrar a decisão.');
      const form = new FormData();
      Object.entries({ action: 'resolve_taxonomy', jobId: job.jobId, planHash: job.planHash, category: selected.category, key: selected.key, operation, canonicalId, reason }).forEach(([key, value]) => form.set(key, value));
      const response = await fetchAuthenticatedResource('admin/cm_batch.php', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: form });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Falha ao registrar a decisão.');
      setJob(payload.data ?? payload);
      setReason('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao registrar a decisão.');
    } finally {
      setBusy(false);
    }
  };

  const validate = async (persist = false) => {
    if (!file || busy || runner.current) return;
    setBusy(true);
    setError('');
    try {
      const csrfToken = getCsrfToken();
      if (!csrfToken) throw new Error('Sessao sem token de seguranca. Atualize a pagina e tente novamente.');
      const form = new FormData();
      form.set('action', persist ? 'preview' : 'dry_run');
      form.set('archive', file);
      const response = await fetchAuthenticatedResource('admin/cm_batch.php', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        body: form,
      });
      const payload = await response.json();
      const data = payload?.data ?? payload;
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || 'Falha ao validar o ZIP.');
      setJob(data as CmBatchJob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao validar o ZIP.');
    } finally {
      setBusy(false);
    }
  };

  const postAction = async (values: Record<string, string>) => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) throw new Error('Atualize a sessão antes de continuar.');
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => form.set(key, value));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetchAuthenticatedResource('admin/cm_batch.php', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: form, signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Não foi possível atualizar a importação.');
      setLastResponse(Date.now());
      return payload.data ?? payload;
    } catch (cause) {
      if (controller.signal.aborted) throw new Error('O servidor não respondeu em 2 minutos. O bloco pode ainda estar finalizando. Atualize o status antes de continuar; checkpoints confirmados serão preservados.');
      throw cause;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const processUntilStopped = async (currentJob: CmBatchJob) => {
    if (runner.current) return;
    runner.current = true;
    stopRequested.current = false;
    let latest = currentJob;
    setProcessing(true);
    setError('');
    setLastResponse(Date.now());
    try {
      while (!stopRequested.current && ['queued', 'running'].includes(latest.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        if (stopRequested.current) break;
        const result = await postAction({ action: 'process', jobId: latest.jobId ?? '', limit: '5' });
        latest = result.job as CmBatchJob;
        if (!stopRequested.current) setJob(latest);
      }
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : 'Falha de comunicação.'} O envio de novos blocos foi interrompido nesta aba.`);
    } finally {
      runner.current = false;
      setProcessing(false);
    }
  };

  const refreshStatus = async () => {
    if (!job?.jobId || busy || runner.current) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetchAuthenticatedResource(`admin/cm_batch.php?job_id=${encodeURIComponent(job.jobId)}`);
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Falha ao consultar a fila.');
      setJob(payload.data ?? payload);
      setLastResponse(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao consultar a fila.');
    } finally { setBusy(false); }
  };

  const approveAndStart = async () => {
    if (!job?.jobId || !job.planHash || !canStart) return;
    if (skippedExamKeys.size + skippedQuestionItems.length > 0 && !window.confirm(`${skippedExamKeys.size} prova(s) e ${skippedQuestionItems.length} questão(ões) com identidade/conteúdo pendente serão puladas. Nenhuma duplicata será criada; os demais itens aptos serão vinculados ou enriquecidos como rascunhos. Deseja iniciar?`)) return;
    setBusy(true);
    setError('');
    try {
      const result = await postAction({ action: 'approve_and_start', jobId: job.jobId, planHash: job.planHash, archiveSha256: job.archiveSha256, limit: '5' });
      const latest = result.job as CmBatchJob;
      setJob(latest);
      setBusy(false);
      await processUntilStopped(latest);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao iniciar a importação.');
    } finally {
      setBusy(false);
    }
  };

  const refreshTaxonomies = async () => {
    if (!job?.jobId || busy) return;
    setBusy(true);
    setError('');
    try {
      setJob(await postAction({ action: 'refresh_taxonomies', jobId: job.jobId }) as CmBatchJob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao reanalisar taxonomias.');
    } finally {
      setBusy(false);
    }
  };

  const transition = async (operation: 'pause' | 'resume' | 'cancel' | 'retry' | 'retry_dependencies') => {
    if (!job?.jobId || (busy && !processing)) return;
    setBusy(true);
    setError('');
    if (operation === 'pause' || operation === 'cancel') stopRequested.current = true;
    try {
      const next = await postAction({ action: 'transition', jobId: job.jobId, operation });
      const latest = next as CmBatchJob;
      setJob(latest);
      setBusy(false);
      if (operation === 'resume' || operation === 'retry' || operation === 'retry_dependencies') await processUntilStopped(latest);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao alterar a fila.');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!job) return;
    const blob = new Blob([JSON.stringify(job, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cm-batch-dry-run-${job.jobId}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-md bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><Archive size={19} /></span>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Importar lote CM Batch</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Valide um ZIP versionado e confira a prévia antes de qualquer gravação de provas ou questões.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          disabled={busy || processing}
          accept=".zip,application/zip"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setJob(null); setError(''); }}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800"
        />
        <button type="button" onClick={() => void validate(true)} disabled={!file || busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
          {busy ? 'Validando e preparando...' : 'Validar ZIP e preparar importação'}
        </button>
        <button type="button" onClick={() => void validate(false)} disabled={!file || busy} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm disabled:opacity-50 dark:border-slate-700">Apenas validar sem salvar</button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {job && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{job.datasetLabel}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lote {job.batchId} · SHA-256 {job.archiveSha256.slice(0, 16)}… · {job.manifest.yearsCovered?.join(', ')}</p>
            </div>
            <div className="flex items-center gap-2"><button type="button" onClick={downloadReport} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download size={14} /> Baixar relatório</button><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle size={14} /> {queueActivityLabel(job.status, processing)}</span></div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Provas', job.plan.exams.length],
              ['Questões', job.plan.questions.total],
              ['Taxonomias a resolver', job.plan.taxonomy.needsReview],
              ['Mídias validadas', job.plan.mediaCount],
            ].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</dd></div>)}
          </dl>

          <p className="text-sm text-slate-600 dark:text-slate-300">Plano de questões: <strong>{job.plan.questions.actions.create ?? 0}</strong> novas como rascunho, <strong>{job.plan.questions.actions.link_existing ?? 0}</strong> já existentes e vinculadas, <strong>{job.plan.questions.actions.enrich_existing ?? 0}</strong> existentes que receberão apenas dados faltantes e <strong>{skippedQuestionItems.length}</strong> questões que serão puladas por pendência.</p>

          {skippedQuestionItems.length > 0 && <details className="rounded-md border border-amber-200 p-3 text-sm dark:border-amber-900/50">
            <summary className="cursor-pointer font-semibold text-amber-900 dark:text-amber-200">Questões que serão puladas para evitar duplicatas ({skippedQuestionItems.length})</summary>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs text-slate-700 dark:text-slate-300">
              {skippedQuestionItems.map((question) => <li key={`${question.examExternalKey}:${question.tempId}`} className="border-t border-amber-100 pt-2 first:border-0 dark:border-amber-900/40">
                <strong>{question.examExternalKey} · Questão {question.questionNumber ?? question.tempId}</strong>
                {question.externalQuestionId ? <span className="ml-2">ID Gran: {question.externalQuestionId}</span> : null}
                <span className="ml-2 text-slate-500 dark:text-slate-400">{question.reason || 'Conteúdo divergente ou identidade ambígua'}</span>
                {question.externalIdentityQuestionIds?.length ? <span className="block">IDs existentes: {question.externalIdentityQuestionIds.join(', ')}</span> : null}
                {question.candidateQuestionIds?.length ? <span className="block">Candidatos: {question.candidateQuestionIds.join(', ')}</span> : null}
              </li>)}
            </ul>
          </details>}

          <div className="space-y-3 border-y border-slate-200 py-4 dark:border-slate-700">
            <h3 className="font-semibold">Revisar taxonomias</h3>
            {job.jobId && job.status === 'needs_review' && <button type="button" disabled={busy} onClick={() => void refreshTaxonomies()} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600">Reanalisar taxonomias automaticamente</button>}
            <label className="block text-sm">Entidade do lote
              <select disabled={busy} value={selectedKey} onChange={(event) => { requestVersion.current++; setSelectedKey(event.target.value); setCandidates([]); setCanonicalId(''); setReason(''); setSearch(''); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                <option value="">Selecione uma entidade</option>
                {job.plan.taxonomy.entities.map((entity) => <option key={`${entity.category}:${entity.key}`} value={`${entity.category}:${entity.key}`}>{entity.category} · {entity.name} · {entity.canonicalId ? `ID ${entity.canonicalId}` : entity.status}</option>)}
              </select>
            </label>
            {selected && job.jobId && <>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pai: {selected.parentKey ?? 'Raiz'} · {selected.reason}</p>
              <form onSubmit={(event) => { event.preventDefault(); void searchCandidates(); }} className="flex gap-2">
                <input aria-label="Buscar cadastro existente" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={150} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950" />
                <button disabled={busy} className="rounded-md border border-slate-300 px-3 dark:border-slate-700">Pesquisar</button>
              </form>
              <label className="block text-sm">Cadastro existente
                <select disabled={busy} value={canonicalId} onChange={(event) => setCanonicalId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                  <option value="">Selecione o cadastro correspondente</option>
                  {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · ID {candidate.id}</option>)}
                </select>
              </label>
              <label className="block text-sm">Justificativa da decisão
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || !canonicalId || reason.trim().length < 8} onClick={() => void resolveTaxonomy('link')} className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">Confirmar vínculo</button>
                <button type="button" disabled={busy || reason.trim().length < 8} onClick={() => void resolveTaxonomy('propose_create')} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700">Propor novo cadastro</button>
              </div>
            </>}
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"><tr><th className="px-3 py-2">Prova</th><th className="px-3 py-2">Ano oficial</th><th className="px-3 py-2">Questões</th><th className="px-3 py-2">Pendente</th><th className="px-3 py-2">Ação planejada</th><th className="px-3 py-2">Amostra</th></tr></thead>
              <tbody>{job.plan.exams.map((exam) => <tr key={exam.externalKey} className="border-t border-slate-200 dark:border-slate-700"><td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200"><span>{exam.metadata.examTitle || exam.externalKey}</span><span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{exam.provenance.source?.provider}:{exam.provenance.source?.externalExamId}{exam.missingFields.length > 0 ? ` · ausente: ${exam.missingFields.join(', ')}` : ''}</span></td><td className="px-3 py-2">{exam.correctYear}</td><td className="px-3 py-2">{exam.questionCount}</td><td className="px-3 py-2">{exam.needsReview}</td><td className="px-3 py-2">{exam.action === 'link' ? 'Vincular existente' : exam.action === 'conflict' || exam.action === 'needs_review' ? 'Pular para revisão' : 'Criar rascunho'}</td><td className="px-3 py-2"><details><summary className="cursor-pointer text-indigo-700 dark:text-indigo-300">Ver amostra</summary><ul className="mt-2 min-w-64 space-y-2 text-xs normal-case text-slate-600 dark:text-slate-300">{exam.questionSamples.map((question) => <li key={question.tempId}><span className="font-semibold">#{question.questionNumber ?? '—'} · {question.answerStatus}</span><p className="mt-0.5">{question.statement}</p></li>)}</ul></details></td></tr>)}</tbody>
            </table>
          </div>

          {job.plan.warnings.length > 0 && <div className="rounded-md border border-amber-200 p-3 text-sm dark:border-amber-900/50"><p className="font-semibold">Avisos da validação ({job.plan.warnings.length})</p><ul className="mt-2 list-inside list-disc text-slate-600 dark:text-slate-300">{job.plan.warnings.slice(0, 12).map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.code}{warning.examExternalKey ? ` · ${warning.examExternalKey}` : ''}</li>)}</ul></div>}

          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <div><p className="font-semibold">Importação aditiva e sem publicação</p><p className="mt-1">Questões Gran existentes são reutilizadas; taxonomias e comentários/análises só preenchem dados ausentes, sem substituir conteúdo existente. Provas e questões novas ficam como rascunho privado. Gabaritos permanecem não verificados. Conflitos e mídias pendentes são pulados.</p></div>
          </div>
          {job.progress && <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>Progresso da fila</strong><span>{job.progress.completedExams ?? 0}/{job.progress.totalExams ?? job.plan.exams.length} provas · {job.progress.completedQuestions ?? 0}/{job.progress.totalQuestions ?? job.plan.questions.total} questões</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${queueProgress(job.progress, (job.progress.totalExams ?? job.plan.exams.length) + (job.progress.totalQuestions ?? job.plan.questions.total)).percent}%` }} /></div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{job.progress.pending ?? 0} pendentes · {job.progress.blocked ?? 0} bloqueados · {job.progress.failed ?? 0} falhas</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A barra inclui itens concluídos, bloqueados e com falha; bloqueados não foram importados.</p>
            {['queued', 'running'].includes(job.status) && <p role="status" className="mt-3 text-sm font-medium">{processing ? 'Enviando blocos ao servidor. Mantenha esta aba aberta.' : 'Nenhum bloco está sendo enviado por esta aba. Continue o processamento abaixo.'}</p>}
            {lastResponse !== null && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Última resposta do servidor há {Math.max(0, Math.floor((now - lastResponse) / 1000))} s.{processing && now - lastResponse > 30000 ? ' Aguardando confirmação do bloco atual; ainda não há novo progresso confirmado.' : ''}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {['queued', 'running'].includes(job.status) && !processing && <button type="button" disabled={busy} onClick={() => void processUntilStopped(job)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Play size={16} />Continuar processamento</button>}
              <button type="button" disabled={busy || processing} onClick={() => void refreshStatus()} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700">Atualizar status</button>
            </div>
          </div>}
          {!!job.items?.length && <CmBatchQueueDiagnostics key={job.jobId} items={job.items} exams={job.plan.exams} questions={job.plan.questions.items ?? []} />}
          <div className="flex flex-wrap items-center gap-2">
            {['completed','failed','paused','running','queued'].includes(job.status) && job.items?.some((item) => item.status === 'blocked' && (item.diagnostics.message?.startsWith('Ano oficial diverge da prova existente') || item.diagnostics.message === 'Prova ainda nao foi materializada; o checkpoint da prova precisa concluir primeiro.')) && <button type="button" disabled={busy || processing} onClick={() => void transition('retry_dependencies')} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Play size={16} />Retomar prova e questões dependentes</button>}
            {job.status === 'validated_only' && <button type="button" onClick={() => void validate(true)} disabled={!file || busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Archive size={16} />Salvar prévia e habilitar importação</button>}
            {job.status === 'needs_review' && <button type="button" onClick={() => void approveAndStart()} disabled={!canStart} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Play size={16} />Aprovar e iniciar importação</button>}
            {['queued', 'running'].includes(job.status) && <button type="button" onClick={() => void transition('pause')} disabled={busy && !processing} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700"><Pause size={15} />Pausar</button>}
            {job.status === 'paused' && <button type="button" onClick={() => void transition('resume')} disabled={busy} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-indigo-600 px-3 text-sm text-white"><Play size={15} />Retomar</button>}
            {job.status === 'failed' && <button type="button" onClick={() => void transition('retry')} disabled={busy} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-indigo-600 px-3 text-sm text-white"><Play size={15} />Tentar novamente</button>}
            {['needs_review', 'queued', 'running', 'paused', 'failed'].includes(job.status) && <button type="button" onClick={() => void transition('cancel')} disabled={busy && !processing} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-rose-300 px-3 text-sm text-rose-700 dark:border-rose-900 dark:text-rose-300"><Square size={14} />Cancelar</button>}
            {processing && <span role="status" className="text-xs text-slate-500 dark:text-slate-400">Processando em blocos...</span>}
            {job.status === 'validated_only' && <p className="basis-full text-xs text-slate-500 dark:text-slate-400">A validação não gravou nada. Salve a prévia privada para revisar as correspondências e habilitar o início.</p>}
            {job.status === 'needs_review' && <p className="text-xs text-slate-500 dark:text-slate-400">IDs de origem são reutilizados e novos cadastros seguros são criados ao aprovar. Apenas os itens que dependem de taxonomias não resolvidas ficarão bloqueados, com o motivo no relatório. Comentários e análises ausentes são acrescentados como rascunhos, sem substituir conteúdo existente.</p>}
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><CheckCircle2 size={14} /> {job.jobId ? 'ZIP mantido em armazenamento privado; cada item é confirmado por checkpoint e pode ser retomado.' : 'Validação sem gravação. Salve a prévia para registrar decisões.'}</p>
        </div>
      )}
    </section>
  );
}
