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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, History, Loader2, Play, ShieldCheck } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import {
  adminService,
  type SafeOperationCatalogPayload,
  type SafeOperationPreviewPayload,
} from '@services/admin/adminService';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

const DEFAULT_NAMESPACE = 'm20f06-browser-demo';

const SafeOperationsPanel = () => {
  const { addToast } = useToast();
  const [catalog, setCatalog] = useState<SafeOperationCatalogPayload | null>(null);
  const [operationType, setOperationType] = useState('cache.synthetic_expired_cleanup');
  const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE);
  const [preview, setPreview] = useState<SafeOperationPreviewPayload | null>(null);
  const [confirmationToken, setConfirmationToken] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);

  const selectedOperation = useMemo(
    () => catalog?.operations.find((item) => item.operation_type === operationType) || null,
    [catalog, operationType],
  );

  const load = useCallback(async () => {
    setBusy('load');
    try {
      const [nextCatalog, nextHistory] = await Promise.all([
        adminService.getSafeOperationCatalog(),
        adminService.getSafeOperationHistory(),
      ]);
      setCatalog(nextCatalog);
      setHistory(nextHistory);
      if (nextCatalog.operations[0] && !nextCatalog.operations.some((item) => item.operation_type === operationType)) {
        setOperationType(nextCatalog.operations[0].operation_type);
      }
    } catch {
      setError('Não foi possível carregar as Operações Seguras.');
    } finally {
      setBusy(null);
    }
  }, [operationType]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (action: 'preview' | 'confirm' | 'execute') => {
    if (busy) return;
    setBusy(action);
    setError('');
    setMessage('');
    try {
      if (action === 'preview') {
        const nextPreview = await adminService.previewSafeOperation({
          operation_type: operationType,
          namespace,
          idempotency_key: `m20f06-browser-${namespace}-${operationType}`,
        });
        setPreview(nextPreview);
        setConfirmationToken('');
        setConfirmed(false);
        setMessage('Preview calculado. Nenhum recurso foi alterado.');
      } else if (action === 'confirm' && preview) {
        const result = await adminService.confirmSafeOperation({
          operation_id: preview.operation_id,
          preview_fingerprint: preview.preview_fingerprint,
        });
        setConfirmationToken(result.confirmation_token);
        setMessage('Escopo confirmado. A confirmação é vinculada à sessão e ao fingerprint.');
      } else if (action === 'execute' && preview && confirmationToken) {
        const result = await adminService.executeSafeOperation({
          operation_id: preview.operation_id,
          preview_fingerprint: preview.preview_fingerprint,
          confirmation_token: confirmationToken,
        });
        setMessage(`Operação concluída. Recursos afetados: ${result.actual_count ?? 0}.`);
        setPreview(null);
        setConfirmationToken('');
        setConfirmed(false);
        setHistory(await adminService.getSafeOperationHistory());
      }
      addToast(action === 'execute' ? 'Operação segura concluída.' : 'Operação segura atualizada.', 'success');
    } catch (nextError: unknown) {
      const nextMessage = nextError instanceof Error && nextError.message
        ? nextError.message
        : 'A operação segura foi interrompida.';
      setError(nextMessage);
      addToast(nextMessage, 'error');
    } finally {
      setBusy(null);
    }
  };

  const resetFlow = () => {
    setPreview(null);
    setConfirmationToken('');
    setConfirmed(false);
    setMessage('');
    setError('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-black">Operações Seguras</h3>
          <p className="mt-1 text-xs leading-relaxed">Toda mutação operacional exige escopo sintético, preview, fingerprint e confirmação vinculada à sessão.</p>
        </div>
      </div>

      {message && <div role="status" className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} />{message}</div>}
      {error && <div role="alert" className="border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
        <section className={`${ADMIN_PAGE_PANEL_CLASS} space-y-5`} aria-labelledby="safe-operation-title">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            <h3 id="safe-operation-title" className="text-sm font-black text-slate-900 dark:text-slate-100">Fluxo controlado</h3>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="safe-operation-type" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Operação autorizada</label>
            <select id="safe-operation-type" value={operationType} onChange={(event) => { setOperationType(event.target.value); resetFlow(); }} className={`w-full ${ADMIN_FIELD_CLASS}`} disabled={!!busy}>
              {(catalog?.operations || []).map((item) => <option key={item.operation_type} value={item.operation_type}>{item.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="safe-operation-namespace" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Namespace sintético</label>
            <input id="safe-operation-namespace" value={namespace} onChange={(event) => { setNamespace(event.target.value); resetFlow(); }} className={`w-full ${ADMIN_FIELD_CLASS}`} maxLength={120} aria-describedby="safe-operation-namespace-help" />
            <p id="safe-operation-namespace-help" className="text-xs text-slate-500">Use o prefixo obrigatório `m20f06-`.</p>
          </div>

          {selectedOperation && (
            <div className={`${ADMIN_MUTED_SURFACE_CLASS} grid gap-3 p-4 text-xs sm:grid-cols-3`}>
              <div><span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Risco</span><strong>{selectedOperation.risk_class}</strong></div>
              <div><span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Recuperação</span><strong>{selectedOperation.recovery_class}</strong></div>
              <div><span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Execução</span><strong>{selectedOperation.execution_allowed ? 'Permitida no escopo' : 'Somente preview'}</strong></div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void run('preview')} disabled={!!busy || !catalog} className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center disabled:opacity-60`}><Eye size={15} />{busy === 'preview' ? 'Calculando...' : 'Gerar preview'}</button>
            <button type="button" onClick={resetFlow} disabled={!!busy} className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center`}>Limpar fluxo</button>
          </div>

          {preview && (
            <div className="space-y-4 border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20" aria-live="polite">
              <div className="flex items-center gap-2 text-sm font-black text-sky-950 dark:text-sky-100"><Eye size={16} />Preview #{preview.operation_id}</div>
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <div><dt className="font-bold text-slate-500">Recursos afetados</dt><dd className="font-black text-slate-900 dark:text-slate-100">{preview.snapshot.affected_count}</dd></div>
                <div><dt className="font-bold text-slate-500">Expira em</dt><dd className="font-black text-slate-900 dark:text-slate-100">{new Date(preview.preview_expires_at).toLocaleString('pt-BR')}</dd></div>
                <div className="sm:col-span-2"><dt className="font-bold text-slate-500">Fingerprint</dt><dd className="break-all font-mono text-[11px] text-slate-800 dark:text-slate-200">{preview.preview_fingerprint}</dd></div>
              </dl>
              {!preview.execution_allowed && <p className="text-xs font-bold text-amber-800">Este contrato não executa destruição ampla; a política permite somente análise.</p>}
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" disabled={!!confirmationToken || !!busy} />
                <span>Confirmo exatamente este namespace, fingerprint e quantidade exibidos.</span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void run('confirm')} disabled={!confirmed || !!confirmationToken || !!busy} className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center disabled:opacity-60`}><ShieldCheck size={15} />Confirmar escopo</button>
                <button type="button" onClick={() => void run('execute')} disabled={!confirmationToken || !!busy || !preview.execution_allowed} className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center disabled:opacity-60`}><Play size={15} />{busy === 'execute' ? 'Executando...' : 'Executar'}</button>
              </div>
            </div>
          )}
        </section>

        <section className={`${ADMIN_PAGE_PANEL_CLASS}`} aria-labelledby="safe-operation-history-title">
          <div className="flex items-center gap-2"><History size={18} className="text-sky-700" /><h3 id="safe-operation-history-title" className="text-sm font-black text-slate-900 dark:text-slate-100">Histórico da sessão</h3></div>
          <div className="mt-4 space-y-2">
            {busy === 'load' && <Loader2 size={18} className="animate-spin text-sky-700" />}
            {!busy && history.length === 0 && <p className="text-xs text-slate-500">Nenhuma operação registrada.</p>}
            {history.map((item) => <div key={String(item.operation_id)} className={`${ADMIN_MUTED_SURFACE_CLASS} p-3 text-xs`}><div className="flex items-center justify-between gap-3"><strong>{String(item.operation_type)}</strong><span className="font-black">{String(item.status)}</span></div><p className="mt-1 text-slate-500">{String(item.namespace_key || '')} · esperados {String(item.expected_count ?? 0)} · afetados {String(item.actual_count ?? '-')}</p></div>)}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SafeOperationsPanel;
