import { AlertTriangle, BarChart3, ReceiptText, WalletCards } from 'lucide-react';
import {
  AdminActionButton,
  AdminDataPanel,
  AdminEmptyState,
  AdminMetricCard,
  AdminQueueRow,
  AdminSectionHeader,
} from '../../design-system';
import {
  buildAdminRevenueModel,
  formatAdminCurrency,
  type AdminRevenueModelInput,
} from './adminRevenueModel';

export default function AdminRevenueBlueprint(input: AdminRevenueModelInput) {
  const revenue = buildAdminRevenueModel(input);
  const hasRefundQueue = revenue.pendingRefunds > 0;
  const hasFailedTransactions = revenue.failedTransactions > 0;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Revenue"
        title="Receita, billing e conciliacao"
        description="A area financeira do novo admin deve responder rapidamente quanto entrou, o que falhou, o que precisa de decisao e quanto esta disponivel para sellers."
        actions={(
          <>
            <AdminActionButton variant="secondary">Exportar CSV</AdminActionButton>
            <AdminActionButton variant="primary">Abrir matriz Stripe</AdminActionButton>
          </>
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Metricas financeiras">
        <AdminMetricCard
          label="Receita total"
          value={formatAdminCurrency(revenue.totalRevenue)}
          description={`${revenue.paidTransactions} transacao(oes) paga(s).`}
          trend={revenue.totalRevenue > 0 ? 'Ativo' : 'Sem receita'}
          severity={revenue.totalRevenue > 0 ? 'healthy' : 'low'}
          icon={<BarChart3 size={18} />}
        />
        <AdminMetricCard
          label="Receita liquida"
          value={formatAdminCurrency(revenue.netRevenue)}
          description={`${formatAdminCurrency(revenue.platformFees)} em taxas de plataforma.`}
          trend="Conciliacao"
          severity="healthy"
          icon={<WalletCards size={18} />}
        />
        <AdminMetricCard
          label="Reembolsos"
          value={String(revenue.pendingRefunds)}
          description={`${formatAdminCurrency(revenue.refundedAmount)} ja reembolsado.`}
          trend={hasRefundQueue ? 'Decidir' : 'Saudavel'}
          severity={hasRefundQueue ? 'high' : 'healthy'}
          icon={<ReceiptText size={18} />}
        />
        <AdminMetricCard
          label="Falhas"
          value={String(revenue.failedTransactions)}
          description="Transacoes rejeitadas, falhas ou canceladas."
          trend={hasFailedTransactions ? 'Investigar' : 'Saudavel'}
          severity={hasFailedTransactions ? 'medium' : 'healthy'}
          icon={<AlertTriangle size={18} />}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminDataPanel
          title="Distribuicao de receita"
          description="Separacao inicial entre assinaturas, marketplace e taxas para evoluir MRR, churn e cohorts."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-4">
              <p className="text-xs font-bold uppercase text-[#5f6f68]">Planos</p>
              <p className="mt-2 text-2xl font-black text-[#16211d]">{formatAdminCurrency(revenue.planRevenue)}</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-4">
              <p className="text-xs font-bold uppercase text-[#5f6f68]">Marketplace</p>
              <p className="mt-2 text-2xl font-black text-[#16211d]">{formatAdminCurrency(revenue.marketplaceRevenue)}</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-4">
              <p className="text-xs font-bold uppercase text-[#5f6f68]">Taxas</p>
              <p className="mt-2 text-2xl font-black text-[#16211d]">{formatAdminCurrency(revenue.platformFees)}</p>
            </div>
          </div>

          <div className="mt-4">
            {hasRefundQueue ? (
              <AdminQueueRow
                title="Reembolsos pendentes"
                description="Fila financeira que precisa de decisao administrativa antes de encerrar o ciclo do usuario."
                severity="high"
                meta={`${revenue.pendingRefunds} pendente(s)`}
                action={<AdminActionButton variant="quiet">Abrir fila</AdminActionButton>}
              />
            ) : (
              <AdminEmptyState
                title="Sem reembolsos pendentes"
                description="A fila financeira esta limpa para os dados carregados neste momento."
              />
            )}
          </div>
        </AdminDataPanel>

        <AdminDataPanel
          title="Sellers e payout"
          description="Primeira leitura por vendedor para evoluir repasses e conciliacao."
        >
          {revenue.sellers.length > 0 ? (
            <div className="space-y-3">
              {revenue.sellers.slice(0, 5).map((seller) => (
                <div key={seller.sellerId} className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#16211d]">{seller.sellerName}</p>
                      <p className="truncate text-xs text-[#5f6f68]">{seller.sellerEmail}</p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-[#15803d]">{formatAdminCurrency(seller.availablePayout)}</p>
                  </div>
                  <p className="mt-2 text-xs text-[#5f6f68]">
                    {seller.transactionCount} venda(s), {formatAdminCurrency(seller.platformFees)} em taxas.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              title="Nenhum seller com payout calculado"
              description="Quando houver vendas de marketplace pagas, os repasses aparecem aqui."
            />
          )}
        </AdminDataPanel>
      </div>
    </div>
  );
}
