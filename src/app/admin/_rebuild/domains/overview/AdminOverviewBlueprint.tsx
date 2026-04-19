import { AlertTriangle, BarChart3, CheckCircle2, ReceiptText } from 'lucide-react';
import {
  AdminActionButton,
  AdminDataPanel,
  AdminMetricCard,
  AdminQueueRow,
  AdminSectionHeader,
} from '../../design-system';
import { buildAdminOverviewModel, type AdminOverviewModelInput } from './adminOverviewModel';

const metricIcons = {
  total_revenue: <BarChart3 size={18} />,
  refunds: <ReceiptText size={18} />,
  support: <AlertTriangle size={18} />,
  seo: <CheckCircle2 size={18} />,
} as const;

export default function AdminOverviewBlueprint(input: AdminOverviewModelInput) {
  const overview = buildAdminOverviewModel(input);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Overview"
        title="Cockpit administrativo"
        description="A primeira tela do novo admin deve priorizar decisoes, risco, receita e filas operacionais com evidencia suficiente para agir."
        actions={(
          <>
            <AdminActionButton variant="secondary">Ver filas</AdminActionButton>
            <AdminActionButton variant="primary">Abrir incidentes</AdminActionButton>
          </>
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Metricas principais">
        {overview.metrics.map((metric) => (
          <AdminMetricCard
            key={metric.key}
            {...metric}
            icon={metricIcons[metric.key as keyof typeof metricIcons]}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
        <AdminDataPanel
          title="Fila operacional"
          description="Toda linha precisa ter severidade, responsavel, prazo e acao primaria quando virar tela real."
        >
          {overview.queue.map((queue) => (
            <AdminQueueRow
              key={queue.key}
              title={queue.title}
              description={queue.description}
              severity={queue.severity}
              meta={queue.meta}
              action={<AdminActionButton variant="quiet">Detalhar</AdminActionButton>}
            />
          ))}
          {overview.queue.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d8e2dc] bg-[#f8faf9] p-6 text-sm leading-6 text-[#5f6f68]">
              Nenhuma fila critica foi encontrada com os dados recebidos.
            </div>
          ) : null}
        </AdminDataPanel>

        <AdminDataPanel
          title="Contrato de paridade"
          description="Nenhuma funcao antiga sai do admin sem destino aprovado."
        >
          <div className="space-y-3 text-sm leading-6 text-[#5f6f68]">
            <p>1. Preservar funcoes existentes.</p>
            <p>2. Reorganizar por dominio de trabalho.</p>
            <p>3. Criar UI nova, sem casca antiga.</p>
            <p>4. Adicionar analytics, auditoria e RBAC no mesmo desenho.</p>
          </div>
        </AdminDataPanel>
      </div>
    </div>
  );
}
