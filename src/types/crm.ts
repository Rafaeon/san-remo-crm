import type { Database } from '@/integrations/supabase/types';
export type Lead = Database['public']['Tables']['leads']['Row'];
export type Stage = Database['public']['Enums']['lead_stage'];
export type Broker = { id: string; display_name: string };
export type DistributionHistoryRow = { operation_id: string; lead_id: string; lead_name: string; broker_name: string; distributed_at: string };
export type TeamMember = { id: string; display_name: string; email: string | null; created_at: string; role: 'gestor' | 'corretor' | null; self: boolean };