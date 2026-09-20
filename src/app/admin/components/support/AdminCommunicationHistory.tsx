'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { adminService, type AdminCommunicationHistoryItem } from '@services/admin/adminService';
import { clientLog } from '@services/monitoring/clientLog';
import { ADMIN_MUTED_SURFACE_CLASS, ADMIN_PRIMARY_BUTTON_CLASS, ADMIN_SECONDARY_BUTTON_CLASS } from '../shared/adminPanelStyles';

const statusLabel = (value?: string | null) => value || 'desconhecido';

const AdminCommunicationHistory = () => {
  const [items, setItems] = useState<AdminCommunicationHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminService.getCommunicationHistory({ page: nextPage, search, status, perPage: 25 });
      setItems(payload.items || []);
      setPage(payload.page || nextPage);
      setPages(payload.pages || 1);
    } catch (reason) {
      clientLog.warn('[admin-communications] falha ao carregar historico', reason);
      setError('Não foi possível carregar o histórico de comunicações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(1); }, 0);
    return () => window.clearTimeout(timer);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-4" aria-labelledby="admin-communications-title">
      <div className={`${ADMIN_MUTED_SURFACE_CLASS} flex flex-col gap-3 rounded-md p-4 md:flex-row md:items-end md:justify-between`}>
        <div>
          <h2 id="admin-communications-title" className="text-lg font-black text-slate-900 dark:text-slate-100">Histórico de comunicações</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Entrega, tentativas, reconciliação e auditoria em uma fila paginada.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="communication-search">Buscar comunicação</label>
          <input id="communication-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar evento ou identidade" className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <label className="sr-only" htmlFor="communication-status">Filtrar status</label>
          <select id="communication-status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="processed">Processado</option>
            <option value="failed">Falhou</option>
            <option value="suppressed">Suprimido</option>
          </select>
          <button type="button" className={ADMIN_PRIMARY_BUTTON_CLASS} onClick={() => void load(1)} title="Atualizar histórico">
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="min-w-[780px] w-full text-left text-sm">
          <caption className="sr-only">Fila de comunicações</caption>
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900">
            <tr><th scope="col" className="p-3">Evento</th><th scope="col" className="p-3">Canal</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Tentativas</th><th scope="col" className="p-3">Identidade do provedor</th><th scope="col" className="p-3">Criado</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto animate-spin" aria-label="Carregando" /></td></tr> : null}
            {!loading && items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma comunicação encontrada.</td></tr> : null}
            {!loading && items.map((item) => <tr key={`${item.id}-${item.channel}`} className="border-t border-slate-100 dark:border-slate-800">
              <td className="p-3"><div className="font-bold text-slate-900 dark:text-slate-100">{item.event_type || '—'}</div><div className="text-xs text-slate-500">{item.recipient || 'destinatário protegido'}</div></td>
              <td className="p-3">{item.channel || '—'}</td>
              <td className="p-3"><span className="font-semibold">{statusLabel(item.delivery_status || item.intent_status)}</span>{item.source_state ? <div className="text-xs text-slate-500">{item.source_state}</div> : null}</td>
              <td className="p-3">{item.attempts ?? 0}</td>
              <td className="p-3 font-mono text-xs">{item.provider_message_id || 'aguardando'}</td>
              <td className="p-3 text-xs text-slate-500">{item.created_at || '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Página {page} de {pages}</span>
        <div className="flex gap-2">
          <button type="button" className={ADMIN_SECONDARY_BUTTON_CLASS} disabled={page <= 1} onClick={() => void load(page - 1)} title="Página anterior"><ChevronLeft size={15} aria-hidden="true" /> Anterior</button>
          <button type="button" className={ADMIN_SECONDARY_BUTTON_CLASS} disabled={page >= pages} onClick={() => void load(page + 1)} title="Próxima página">Próxima <ChevronRight size={15} aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
};

export default AdminCommunicationHistory;
