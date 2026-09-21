import { useQuery } from '@tanstack/react-query';
import { simulationQueryKeys } from '@/features/simulations/api/queryKeys';
import { simulationsService } from '@/services/simulations/simulationsService';

export const useActiveSimulationQuery = () => useQuery({
  queryKey: simulationQueryKeys.active(),
  queryFn: () => simulationsService.getActiveRemote(),
  staleTime: 30_000,
  retry: 1,
});
