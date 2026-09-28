export const resolveQuestionStatsTotal = (apiTotal: number, distributionTotal: number): number => {
  const total = Number.isFinite(apiTotal) ? Math.max(0, apiTotal) : 0;
  const distribution = Number.isFinite(distributionTotal) ? Math.max(0, distributionTotal) : 0;

  return total > 0 || distribution === 0 ? total : distribution;
};
