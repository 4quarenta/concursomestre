import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AdminRevenueProjectionOverduePayment } from '@services/admin/adminService';
import { ADMIN_SURFACE_CLASS } from '../shared/adminPanelStyles';

interface FinanceStats {
  grossCaptured: number;
  refunded: number;
  recognizedGross: number;
  commercialPlatformRevenue: number;
  totalPayable: number;
  providerFees: number | null;
  platformNet: number;
}

interface AdminFinanceTransactionOverviewProps {
  financeStats: FinanceStats;
  isRevenueProjectionLoading: boolean;
  futureProjectedAmount: number;
  futureProjectedTransactionCount: number;
  activeContracts: number;
  overduePaymentRows: AdminRevenueProjectionOverduePayment[];
  overduePaymentAmount: number;
}

const formatMoney = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AdminFinanceTransactionOverview: React.FC<AdminFinanceTransactionOverviewProps> = ({
  financeStats,
  isRevenueProjectionLoading,
  futureProjectedAmount,
  futureProjectedTransactionCount,
  activeContracts,
  overduePaymentRows,
  overduePaymentAmount,
}) => (
  <>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Bruto capturado</p>
        <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">{formatMoney(financeStats.grossCaptured)}</p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Capturas confirmadas antes dos reembolsos.</p>
      </div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Reembolsado</p>
        <p className="mt-3 text-2xl font-black text-rose-600 dark:text-rose-400">{formatMoney(financeStats.refunded)}</p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Valores devolvidos e baixados do resultado.</p>
      </div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Líquido reconhecido</p>
        <p className="mt-3 text-2xl font-black text-sky-700 dark:text-sky-300">{formatMoney(financeStats.recognizedGross)}</p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Bruto capturado menos reembolsos.</p>
      </div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Receita comercial</p>
        <p className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(financeStats.commercialPlatformRevenue)}</p>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Assinaturas + participação nas vendas.</p>
      </div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxas do provedor</p><p className="mt-3 text-2xl font-black">{financeStats.providerFees === null ? 'Não informadas' : formatMoney(financeStats.providerFees)}</p><p className="mt-2 text-xs text-slate-500">Nunca estimadas pela taxa comercial.</p></div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor a repassar</p><p className="mt-3 text-2xl font-black text-amber-700">{formatMoney(financeStats.totalPayable)}</p><p className="mt-2 text-xs text-slate-500">Vendedores + indicações ainda em aberto.</p></div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resultado da plataforma</p><p className="mt-3 text-2xl font-black text-indigo-700">{formatMoney(financeStats.platformNet)}</p><p className="mt-2 text-xs text-slate-500">Antes das taxas do provedor.</p></div>
      <div className={`${ADMIN_SURFACE_CLASS} p-5`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receita projetada</p><p className="mt-3 text-2xl font-black text-violet-700">{isRevenueProjectionLoading ? '...' : formatMoney(futureProjectedAmount)}</p><p className="mt-2 text-xs text-slate-500">{futureProjectedTransactionCount} parcela(s) futura(s) em {activeContracts} contrato(s).</p></div>
    </div>

    {overduePaymentRows.length > 0 ? (
      <div className="overflow-hidden rounded-sm border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/15">
        <div className="flex flex-col gap-2 border-b border-amber-200 px-4 py-3 dark:border-amber-900/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-amber-900 dark:text-amber-100"><AlertTriangle size={16} />Pagamentos em atraso para averiguar</p>
            <p className="mt-1 text-xs font-semibold text-amber-800/80 dark:text-amber-200/80">Parcelas que deveriam ter virado transação real e não podem permanecer como projeção futura.</p>
          </div>
          <span className="inline-flex items-center justify-center rounded-sm border border-amber-300 bg-white px-3 py-1 text-xs font-black text-amber-800 dark:border-amber-800 dark:bg-slate-950/40 dark:text-amber-200">{overduePaymentRows.length} pendência(s) - {formatMoney(overduePaymentAmount)}</span>
        </div>
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="sticky top-0 z-10 bg-amber-100 dark:bg-amber-950"><tr className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-900 dark:text-amber-100"><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Aluno</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Parcela</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3 text-right">Valor</th></tr></thead>
            <tbody className="divide-y divide-amber-100 bg-white/70 dark:divide-amber-900/40 dark:bg-slate-950/20">
              {overduePaymentRows.map((row, index) => {
                const dueDate = row.dueAt ? new Date(row.dueAt) : null;
                const dueLabel = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toLocaleString('pt-BR') : row.dueAt || '-';
                return (
                  <tr key={`${row.subscriptionId}-${row.installmentNumber}-${index}`}>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{dueLabel}<p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">{Number(row.daysOverdue || 0)} dia(s) em atraso</p></td>
                    <td className="px-4 py-3"><p className="text-xs font-black text-slate-900 dark:text-slate-100">{row.userName || '-'}</p><p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{row.userEmail || '-'}</p></td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{row.planName || '-'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{row.installmentNumber ? `${row.installmentNumber}/${row.installmentCount || '-'}` : '-'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{row.reason || 'Pagamento em atraso'}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-amber-800 dark:text-amber-200">{formatMoney(Number(row.amount || 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ) : null}
  </>
);

export default AdminFinanceTransactionOverview;
