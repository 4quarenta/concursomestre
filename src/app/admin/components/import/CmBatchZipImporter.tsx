'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Download, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';
import { fetchAuthenticatedResource } from '@services/api/client';
import { getCsrfToken } from '@services/auth/session';

type CmBatchJob = {
  jobId: string | null;
  batchId: string;
  archiveSha256: string;
  datasetLabel: string;
  status: string;
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
    questions: { total: number; needsReview: number; pendingPublication: number; publishable: number; actions: Record<string, number> };
    mediaCount: number;
    blockers: string[];
  };
};

export default function CmBatchZipImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<CmBatchJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Array<{ id: number; name: string }>>([]);
  const [canonicalId, setCanonicalId] = useState('');
  const [reason, setReason] = useState('');
  const requestVersion = useRef(0);
  const selected = job?.plan.taxonomy.entities.find((entity) => `${entity.category}:${entity.key}` === selectedKey);

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
    if (!file || busy) return;
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
          accept=".zip,application/zip"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setJob(null); setError(''); }}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800"
        />
        <button type="button" onClick={() => void validate(false)} disabled={!file || busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
          {busy ? 'Validando...' : 'Apenas validar'}
        </button>
        <button type="button" onClick={() => void validate(true)} disabled={!file || busy} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm disabled:opacity-50 dark:border-slate-700">Salvar prévia para revisão</button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {job && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{job.datasetLabel}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lote {job.batchId} · SHA-256 {job.archiveSha256.slice(0, 16)}… · {job.manifest.yearsCovered?.join(', ')}</p>
            </div>
            <div className="flex items-center gap-2"><button type="button" onClick={downloadReport} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download size={14} /> Baixar relatório</button><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle size={14} /> Revisão necessária</span></div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Provas', job.plan.exams.length],
              ['Questões', job.plan.questions.total],
              ['Taxonomias a resolver', job.plan.taxonomy.needsReview],
              ['Mídias validadas', job.plan.mediaCount],
            ].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</dd></div>)}
          </dl>

          <p className="text-sm text-slate-600 dark:text-slate-300">Plano de questões: <strong>{job.plan.questions.actions.create ?? 0}</strong> novas como rascunho, <strong>{job.plan.questions.actions.link ?? 0}</strong> vínculos por conteúdo idêntico e <strong>{job.plan.questions.actions.conflict ?? 0}</strong> conflitos bloqueados.</p>

          <div className="space-y-3 border-y border-slate-200 py-4 dark:border-slate-700">
            <h3 className="font-semibold">Revisar taxonomias</h3>
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
              <tbody>{job.plan.exams.map((exam) => <tr key={exam.externalKey} className="border-t border-slate-200 dark:border-slate-700"><td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200"><span>{exam.metadata.examTitle || exam.externalKey}</span><span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{exam.provenance.source?.provider}:{exam.provenance.source?.externalExamId}{exam.missingFields.length > 0 ? ` · ausente: ${exam.missingFields.join(', ')}` : ''}</span></td><td className="px-3 py-2">{exam.correctYear}</td><td className="px-3 py-2">{exam.questionCount}</td><td className="px-3 py-2">{exam.needsReview}</td><td className="px-3 py-2">{exam.action === 'link' ? 'Vincular existente' : exam.action === 'conflict' ? 'Conflito' : 'Criar rascunho'}</td><td className="px-3 py-2"><details><summary className="cursor-pointer text-indigo-700 dark:text-indigo-300">Ver amostra</summary><ul className="mt-2 min-w-64 space-y-2 text-xs normal-case text-slate-600 dark:text-slate-300">{exam.questionSamples.map((question) => <li key={question.tempId}><span className="font-semibold">#{question.questionNumber ?? '—'} · {question.answerStatus}</span><p className="mt-0.5">{question.statement}</p></li>)}</ul></details></td></tr>)}</tbody>
            </table>
          </div>

          {job.plan.warnings.length > 0 && <div className="rounded-md border border-amber-200 p-3 text-sm dark:border-amber-900/50"><p className="font-semibold">Avisos da validação ({job.plan.warnings.length})</p><ul className="mt-2 list-inside list-disc text-slate-600 dark:text-slate-300">{job.plan.warnings.slice(0, 12).map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.code}{warning.examExternalKey ? ` · ${warning.examExternalKey}` : ''}</li>)}</ul></div>}

          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <div><p className="font-semibold">Prévia sem gravação canônica</p><p className="mt-1">As questões do lote exigem revisão. Gabaritos e taxonomias ainda não foram confirmados; nenhum item será publicado ou importado nesta etapa.</p></div>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><CheckCircle2 size={14} /> {job.jobId ? 'Arquivo validado e mantido em armazenamento privado para revisão.' : 'Validação sem gravação. Salve a prévia para registrar decisões.'}</p>
        </div>
      )}
    </section>
  );
}
