'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { adminService, type AdminReferralPayoutOverview } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
} from '../shared/adminPanelStyles';

interface AdminReferralPayoutPanelProps {
  onFinancialChanged?: () => void | Promise<void>;
}

const formatMoney = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AdminReferralPayoutPanel: React.FC<AdminReferralPayoutPanelProps> = ({ onFinancialChanged }) => {
  const { addToast } = useToast();
  const [overview, setOverview] = useState<AdminReferralPayoutOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [references, setReferences] = useState<Record<number, string>>({});

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setOverview(await adminService.getReferralPayoutOverview());
    } catch (error) {
      clientLog.warn('Failed to load referral payout overview:', error);
      if (!silent) addToast('Não foi possível carregar os repasses de indicação.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const pendingPayoutItems = useMemo(
    () => (overview?.payoutItems || []).filter((item) => ['review', 'approved'].includes(item.status)),
    [overview?.payoutItems],
  );

  const refreshFinancialState = async () => {
    await Promise.all([loadOverview(true), Promise.resolve(onFinancialChanged?.())]);
  };

  const handleCreateCycle = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const result = await adminService.createReferralPayoutCycle(false);
      await refreshFinancialState();
      if (result.created) {
        addToast(`Ciclo criado com ${result.items || 0} repasse(s), total ${formatMoney(result.amount || 0)}.`, 'success');
      } else if (result.reason === 'outside_payout_day') {
        addToast(`O próximo ciclo está programado para ${result.scheduledFor || 'a data configurada'}.`, 'warning');
      } else {
        addToast('Não há saldo maduro disponível para um novo ciclo.', 'info');
      }
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Não foi possível processar o ciclo de repasses.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async (itemId: number) => {
    const reference = String(references[itemId] || '').trim();
    if (!reference) {
      addToast('Informe a referência ou comprovante do repasse.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await adminService.markReferralPayoutPaid(itemId, reference);
      await refreshFinancialState();
      setReferences((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      addToast('Repasse confirmado com evidência.', 'success');
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Não foi possível confirmar o repasse.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Repasses de indicação</h3>
          <p className="mt-1 text-xs text-slate-500">Somente comissões após a carência entram no ciclo.</p>
        </div>
        <button type="button" onClick={handleCreateCycle} disabled={actionLoading || loading} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-xs`}>
          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
          Gerar ciclo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-5 dark:border-slate-800 md:grid-cols-3">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Em carência</p><p className="mt-1 text-lg font-black">{formatMoney(overview?.summary.pending || 0)}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Disponível</p><p className="mt-1 text-lg font-black text-emerald-600">{formatMoney(overview?.summary.availableToSchedule || 0)}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Próximo ciclo</p><p className="mt-1 text-lg font-black">{overview?.settings.nextPayoutDate || '-'}</p></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/60"><tr><th className="p-4">Indicação</th><th className="p-4 text-center">Indicados</th><th className="p-4 text-right">Em carência</th><th className="p-4 text-right">Repassar</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(overview?.transfers || []).map((transfer) => (
              <tr key={transfer.referrerId}>
                <td className="p-4"><div className="font-bold">{transfer.referrerName || 'Usuário'}</div><div className="text-xs text-slate-500">{transfer.referrerEmail}</div></td>
                <td className="p-4 text-center font-bold">{transfer.referredUsers}</td>
                <td className="p-4 text-right">{formatMoney(transfer.pendingAmount)}</td>
                <td className="p-4 text-right font-black text-emerald-600">{formatMoney(transfer.availableAmount)}</td>
              </tr>
            ))}
            {!loading && (overview?.transfers || []).length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-sm text-slate-500">Nenhuma indicação financeira registrada.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {pendingPayoutItems.length > 0 ? (
        <div className="space-y-3 border-t border-slate-200 p-5 dark:border-slate-800">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Repasses aguardando comprovante</h4>
          {pendingPayoutItems.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-sm border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_140px_minmax(220px,1fr)_auto] md:items-center">
              <div><div className="font-bold">{item.referrerName}</div><div className="text-xs text-slate-500">{item.referrerEmail}</div></div>
              <div className="font-black">{formatMoney(item.amount)}</div>
              <input value={references[item.id] || ''} onChange={(event) => setReferences((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Referência/comprovante" className={ADMIN_FIELD_CLASS} />
              <button type="button" onClick={() => handleMarkPaid(item.id)} disabled={actionLoading} className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs`}>Confirmar pago</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default AdminReferralPayoutPanel;
