export const accountQueryKeys = {
  all: ['account'] as const,
  transactions: () => [...accountQueryKeys.all, 'transactions'] as const,
};
