export const simulationQueryKeys = {
  all: ['simulations'] as const,
  list: () => [...simulationQueryKeys.all, 'list'] as const,
  active: () => [...simulationQueryKeys.all, 'active'] as const,
  detail: (simulationId: string) => [...simulationQueryKeys.all, 'detail', simulationId] as const,
};
