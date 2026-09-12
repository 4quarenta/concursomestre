import { useQuery } from '@tanstack/react-query';
import { simulationQueryKeys } from '@/features/simulations/api/queryKeys';
import { simulationsService } from '@/services/simulations/simulationsService';

export const useSimulationDetailQuery = (simulationId: string) => useQuery({
  queryKey: simulationQueryKeys.detail(simulationId),
  queryFn: () => simulationsService.getDetail(simulationId),
  enabled: Boolean(simulationId),
  staleTime: 60_000,
});
