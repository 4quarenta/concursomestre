/**
 * Formata duracao de estudo em leitura curta para UI mobile.
 * @since v1.0.0
 */
export const formatStudyDuration = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${normalized}s`;
};
