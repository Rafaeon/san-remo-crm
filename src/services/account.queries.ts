import { queryOptions } from '@tanstack/react-query';
import { getAccount } from '@/services/account.functions';

// Include identity in the key so different accounts never share profile cache.
export const accountQueryOptions = (userId: string) => queryOptions({
  queryKey: ['account', userId],
  queryFn: () => getAccount(),
  staleTime: 0,
});