import { AlertTriangle, Clock, Headphones, MessageSquareWarning } from 'lucide-react';
import {
  AdminActionButton,
  AdminDataPanel,
  AdminEmptyState,
  AdminMetricCard,
  AdminQueueRow,
  AdminSectionHeader,
} from '../../design-system';
import {
  buildAdminSupportModel,
  type AdminSupportModelInput,
} from './adminSupportModel';

const metricIcons = {
  inbox: <Headphones size={18} />,
  reports: <MessageSquareWarning size={18} />,
  without_reply: <AlertTriangle size={18} />,
  sla: <Clock size={18} />,
} as const;

export default function AdminSupportBlueprint(input: AdminSupportModelInput) {
  const support = buildAdminSupportModel(input);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Support"
        title="Inbox, denuncias e SLA"
        description="O novo suporte precisa unificar feedback, threads e denuncias em uma fila operacional unica, com prioridade e prazo claros."
        actions={(
          <>
            <AdminActionButton variant="secondary">Filtrar SLA</AdminActionButton>
            <AdminActionButton variant="primary">Abrir inbox</AdminActionButton>
          </>
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Metricas de suporte">
        {support.metrics.map((metric) => (
          <AdminMetricCard
            key={metric.key}
            {...metric}
            icon={metricIcons[metric.key as keyof typeof metricIcons]}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <AdminDataPanel
          title="Fila unica de suporte"
          description="Casos combinados por risco: denuncia, SLA estourado e atendimento sem resposta."
        >
          {support.queue.length > 0 ? (
            support.queue.slice(0, 12).map((item) => (
              <AdminQueueRow
                key={item.key}
                title={item.title}
                description={item.description}
                severity={item.severity}
                meta={item.meta}
                action={<AdminActionButton variant="quiet">Abrir caso</AdminActionButton>}
              />
            ))
          ) : (
            <AdminEmptyState
              title="Sem casos criticos no suporte"
              description="Nao ha denuncias pendentes, SLA estourado ou atendimento sem resposta nos dados carregados."
            />
          )}
        </AdminDataPanel>

        <AdminDataPanel
          title="Distribuicao"
          description="Tipos de feedback recebidos para priorizar produto, suporte e moderacao."
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <p className="text-sm font-black text-[#16211d]">Resumo</p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#5f6f68]">Threads</span>
                  <span className="font-black text-[#16211d]">{support.totals.feedbackThreads}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#5f6f68]">Novos</span>
                  <span className="font-black text-[#16211d]">{support.totals.newFeedback}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#5f6f68]">Denuncias</span>
                  <span className="font-black text-[#16211d]">{support.totals.pendingReports}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <p className="text-sm font-black text-[#16211d]">Tipos</p>
              <div className="mt-3 grid gap-2 text-sm">
                {support.distribution.length > 0 ? (
                  support.distribution.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <span className="text-[#5f6f68]">{item.label}</span>
                      <span className="font-black text-[#16211d]">{item.total}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#5f6f68]">Nenhuma thread carregada.</p>
                )}
              </div>
            </div>
          </div>
        </AdminDataPanel>
      </div>
    </div>
  );
}
