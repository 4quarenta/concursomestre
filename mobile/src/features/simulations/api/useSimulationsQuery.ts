import { useQuery } from '@tanstack/react-query';
import { simulationsService } from '@/services/simulations/simulationsService';
import { simulationQueryKeys } from '@/features/simulations/api/queryKeys';

export const useSimulationsQuery = () => useQuery({
  queryKey: simulationQueryKeys.list(),
  queryFn: () => simulationsService.list(),
});
