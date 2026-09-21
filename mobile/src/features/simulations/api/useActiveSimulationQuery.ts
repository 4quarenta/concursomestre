import { useQuery } from '@tanstack/react-query';
import { simulationQueryKeys } from '@/features/simulations/api/queryKeys';
import { simulationsService } from '@/services/simulations/simulationsService';
import { useAuth } from '@/providers/AuthProvider';

export const useActiveSimulationQuery = () => {
  const { user, isBootstrapped } = useAuth();
  const canQueryRemote = Boolean(
    isBootstrapped && user?.id && user.id !== 'visual-preview-user',
  );

  return useQuery({
  queryKey: [...simulationQueryKeys.active(), user?.id || 'guest'],
  queryFn: () => simulationsService.getActiveRemote(user?.id),
  staleTime: 30_000,
  retry: 1,
  enabled: canQueryRemote,
  });
};
