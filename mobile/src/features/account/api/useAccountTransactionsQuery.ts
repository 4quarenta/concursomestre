import { useQuery } from '@tanstack/react-query';
import { accountQueryKeys } from '@/features/account/api/queryKeys';
import { transactionsService } from '@/services/transactions/transactionsService';

export const useAccountTransactionsQuery = () => useQuery({
  queryKey: accountQueryKeys.transactions(),
  queryFn: () => transactionsService.list({ page: 1, limit: 20 }),
  staleTime: 60_000,
  retry: 1,
});
