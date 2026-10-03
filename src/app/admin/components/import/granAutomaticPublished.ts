export type GranPublishedLedger = {
  runKey: string;
  batches: Record<string, { year: number; published: number }>;
};

export const recordGranPublishedBatch = (
  ledger: GranPublishedLedger,
  runKey: string,
  batchId: string,
  year: number,
  published: number,
): GranPublishedLedger => {
  const batches = ledger.runKey === runKey ? ledger.batches : {};
  return {
    runKey,
    batches: {
      ...batches,
      [batchId]: { year, published: Math.max(batches[batchId]?.published || 0, Math.max(0, published)) },
    },
  };
};

export const countGranPublishedYear = (ledger: GranPublishedLedger, year: number) =>
  Object.values(ledger.batches).reduce((total, batch) => total + (batch.year === year ? batch.published : 0), 0);
