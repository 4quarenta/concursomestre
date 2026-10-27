export type CmBatchQueueItem = {
  id: number;
  entityType: string;
  externalKey: string;
  action: string;
  status: string;
  canonicalId: string | null;
  attempts: number;
  diagnostics: { message?: string; reason?: string; code?: string; [key: string]: unknown };
};

const reasons: Record<string, string> = {
  statement_matches_but_ordered_alternatives_differ: 'O enunciado coincide, mas as alternativas ou sua ordem são diferentes.',
  gran_external_id_content_conflict: 'O ID Gran já existe, mas o conteúdo recebido diverge da questão cadastrada.',
  question_excluded_by_dry_run: 'Questão excluída pela validação prévia ou por uma pendência na prova de origem.',
  blocked_by_dry_run: 'Item bloqueado na validação prévia.',
  database_retry: 'Erro temporário no banco; aguardando nova tentativa.',
};

export function queueDiagnostic(item: CmBatchQueueItem): { message: string; nextStep: string; technical: string } {
  const technical = item.diagnostics.message || item.diagnostics.reason || item.diagnostics.code || '';
  if (item.status === 'planned') return { message: 'Aguardando processamento na fila.', nextStep: 'Retome a fila se estiver pausada. Este item ainda não teve uma tentativa de importação.', technical };
  if (item.status === 'retry') return { message: 'Aguardando nova tentativa automática.', nextStep: 'O processamento respeita o intervalo de retentativa registrado pelo servidor.', technical };
  if (item.status === 'done') return { message: 'Processamento concluído.', nextStep: 'Confira o ID canônico e o resultado técnico abaixo.', technical };
  const message = reasons[technical] || technical || 'O servidor não registrou um motivo detalhado para este item.';
  let nextStep = 'Revise os dados de origem e os detalhes técnicos antes de tentar novamente.';
  if (technical.includes('Filtro canonico') || technical.includes('Taxonomia')) nextStep = 'Confira a categoria, o nome e a hierarquia da taxonomia indicada. Não crie outro cadastro sem verificar o existente.';
  else if (technical.includes('checkpoint da prova')) nextStep = 'Resolva primeiro o bloqueio da prova de origem; esta questão depende dela.';
  else if (technical.includes('Ano oficial')) nextStep = 'Compare o ano do ZIP com o cadastro da prova e sua fonte oficial.';
  else if (technical.includes('content_conflict') || technical.includes('alternatives_differ')) nextStep = 'Compare enunciado, contexto e alternativas com os IDs candidatos da prévia. Não force a fusão.';
  return { message, nextStep, technical };
}
