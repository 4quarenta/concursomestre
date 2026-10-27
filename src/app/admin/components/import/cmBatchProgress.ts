export function queueProgress(progress: { completedExams?: number; completedQuestions?: number; blocked?: number; failed?: number }, total: number) {
  const completed = (progress.completedExams ?? 0) + (progress.completedQuestions ?? 0);
  const evaluated = completed + (progress.blocked ?? 0) + (progress.failed ?? 0);
  return { completed, evaluated, percent: Math.min(100, Math.max(0, evaluated / Math.max(1, total) * 100)) };
}

export function queueActivityLabel(status: string, processing: boolean) {
  if (status === 'running' || status === 'queued') return processing ? 'Processando nesta aba' : 'Aguardando continuação';
  return ({ completed: 'Concluída', failed: 'Falha', paused: 'Pausada', cancelled: 'Cancelada', validated_only: 'Validação sem gravação' } as Record<string, string>)[status] ?? 'Revisão necessária';
}
