import type { Database } from '@/integrations/supabase/types';
export type Lead = Database['public']['Tables']['leads']['Row'];
export type Stage = Database['public']['Enums']['lead_stage'];
export type Broker = { id: string; display_name: string };