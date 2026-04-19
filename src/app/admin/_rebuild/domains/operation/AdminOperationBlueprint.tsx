import { BookOpenCheck, FileText, PackageCheck, Users } from 'lucide-react';
import {
  AdminActionButton,
  AdminDataPanel,
  AdminEmptyState,
  AdminMetricCard,
  AdminQueueRow,
  AdminSectionHeader,
  AdminStatusPill,
} from '../../design-system';
import {
  buildAdminOperationModel,
  type AdminOperationModelInput,
} from './adminOperationModel';

const metricIcons = {
  questions: <BookOpenCheck size={18} />,
  users: <Users size={18} />,
  materials: <PackageCheck size={18} />,
  rankings: <FileText size={18} />,
} as const;

export default function AdminOperationBlueprint(input: AdminOperationModelInput) {
  const operation = buildAdminOperationModel(input);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Operation"
        title="Conteudo, usuarios e qualidade da base"
        description="O dominio operacional do novo admin concentra questoes, provas, importacao, taxonomias, usuarios, materiais e rankings com foco em qualidade e fila de decisao."
        actions={(
          <>
            <AdminActionButton variant="secondary">Abrir importacao</AdminActionButton>
            <AdminActionButton variant="primary">Nova questao</AdminActionButton>
          </>
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Metricas operacionais">
        {operation.metrics.map((metric) => (
          <AdminMetricCard
            key={metric.key}
            {...metric}
            icon={metricIcons[metric.key as keyof typeof metricIcons]}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <AdminDataPanel
          title="Fila de operacao"
          description="Itens que precisam de revisao humana antes de afetarem estudo, marketplace ou busca."
        >
          {operation.queue.length > 0 ? (
            operation.queue.map((queue) => (
              <AdminQueueRow
                key={queue.key}
                title={queue.title}
                description={queue.description}
                severity={queue.severity}
                meta={queue.meta}
                action={<AdminActionButton variant="quiet">Abrir {queue.targetSection}</AdminActionButton>}
              />
            ))
          ) : (
            <AdminEmptyState
              title="Sem filas operacionais criticas"
              description="Os dados carregados nao apontam pendencias de moderacao, taxonomia ou ranking."
            />
          )}
        </AdminDataPanel>

        <AdminDataPanel
          title="Cobertura operacional"
          description="Leitura inicial dos blocos que sustentam filtros, importacao e catalogo."
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[#16211d]">Questoes carregadas</p>
                <AdminStatusPill
                  severity={operation.quality.questionCoveragePercent === null ? 'low' : 'healthy'}
                  label={operation.quality.questionCoveragePercent === null ? 'Sem base' : `${operation.quality.questionCoveragePercent}%`}
                />
              </div>
              <p className="mt-2 text-sm text-[#5f6f68]">
                {operation.totals.loadedQuestions} de {operation.totals.expectedQuestions || operation.totals.loadedQuestions} registro(s).
              </p>
            </div>

            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <p className="text-sm font-black text-[#16211d]">Banco de provas</p>
              <p className="mt-2 text-sm text-[#5f6f68]">{operation.totals.exams} prova(s) carregada(s).</p>
            </div>

            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <p className="text-sm font-black text-[#16211d]">Taxonomias</p>
              <div className="mt-3 grid gap-2">
                {operation.quality.taxonomyBuckets.map((bucket) => (
                  <div key={bucket.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#5f6f68]">{bucket.label}</span>
                    <span className="font-black text-[#16211d]">{bucket.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AdminDataPanel>
      </div>
    </div>
  );
}
