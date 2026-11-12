import { queryOptions } from '@tanstack/react-query';
import { getCrm, getLeadDetail } from './crm.functions';
export const crmQueryOptions = (userId: string) => queryOptions({ queryKey: ['crm', userId], queryFn: () => getCrm(), staleTime: 0 });
export const leadQueryOptions = (userId: string, id: string) => queryOptions({ queryKey: ['lead', userId, id], queryFn: () => getLeadDetail({ data: { id } }), staleTime: 0 });