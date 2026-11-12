import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { idSchema, leadSchema, observationSchema, stageSchema } from '@/lib/lead-schema';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

async function roleOf(client: SupabaseClient<Database>, id: string) {
  const result = await client.from('user_roles').select('role').eq('user_id', id).maybeSingle();
  if (result.error || !result.data) throw new Error('Seu acesso ainda não foi liberado.');
  return result.data.role;
}
async function requireManager(client: SupabaseClient<Database>, id: string) {
  if (await roleOf(client, id) !== 'gestor') throw new Error('Apenas gestores podem cadastrar ou editar leads.');
}
export const getCrm = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await roleOf(context.supabase, context.userId);
  const leads: Database['public']['Tables']['leads']['Row'][] = [];
  // Paginate every read instead of silently losing rows at the Data API limit.
  for (let offset = 0; ; offset += 500) {
    const result = await context.supabase.from('leads').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (result.error) throw new Error('Não foi possível carregar os leads.');
    leads.push(...result.data); if (result.data.length < 500) break;
  }
  const brokers: { id: string; display_name: string }[] = [];
  if (role === 'gestor') {
    for (let offset = 0; ; offset += 500) {
      const result = await context.supabase.from('user_roles').select('user_id').eq('role', 'corretor').order('user_id').range(offset, offset + 499);
      if (result.error) throw new Error('Não foi possível carregar os corretores.');
      if (result.data.length) {
        const profiles = await context.supabase.from('profiles').select('id,display_name').in('id', result.data.map(row => row.user_id));
        if (profiles.error) throw new Error('Não foi possível carregar os corretores.');
        brokers.push(...profiles.data);
      }
      if (result.data.length < 500) break;
    }
  } else {
    const profile = await context.supabase.from('profiles').select('id,display_name').eq('id', context.userId).single();
    if (profile.data) brokers.push(profile.data);
  }
  return { role, leads, brokers };
});
export const createLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leadSchema.parse(input)).handler(async ({ data, context }) => {
    await requireManager(context.supabase, context.userId);
    const result = await context.supabase.from('leads').insert({ ...data, created_by: context.userId }).select('id').single();
    if (result.error) throw new Error('Não foi possível cadastrar o lead. Verifique o responsável.');
    return result.data;
  });
export const editLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leadSchema.extend(idSchema.shape).parse(input)).handler(async ({ data, context }) => {
    await requireManager(context.supabase, context.userId);
    const { id, ...fields } = data;
    const result = await context.supabase.from('leads').update(fields).eq('id', id).select('id').single();
    if (result.error) throw new Error('Não foi possível editar o lead.'); return result.data;
  });
export const changeStage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => stageSchema.parse(input)).handler(async ({ data, context }) => {
    await roleOf(context.supabase, context.userId);
    const result = await context.supabase.from('leads').update({ stage: data.stage }).eq('id', data.id).select('id').single();
    if (result.error) throw new Error('Não foi possível alterar a etapa.'); return result.data;
  });
export const getLeadDetail = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input)).handler(async ({ data, context }) => {
    await roleOf(context.supabase, context.userId);
    const lead = await context.supabase.from('leads').select('*').eq('id', data.id).single();
    if (lead.error) throw new Error('Lead indisponível para sua conta.');
    const observations: Database['public']['Tables']['lead_observations']['Row'][] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await context.supabase.from('lead_observations').select('*').eq('lead_id', data.id).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
      if (result.error) throw new Error('Não foi possível carregar as observações.');
      observations.push(...result.data); if (result.data.length < 500) break;
    }
    return { lead: lead.data, observations };
  });
export const distributeNextLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const result = await context.supabase.rpc('distribute_next_lead').single();
  if (result.error) throw new Error(result.error.code === '42501' ? 'Apenas gestores podem distribuir leads.' : result.error.code === 'P0002' ? 'Nenhum lead disponível para distribuição.' : result.error.code === '22023' ? 'Nenhum corretor disponível na fila de presença.' : 'Não foi possível distribuir o lead. Tente novamente.');
  return result.data;
});
export const addObservation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => observationSchema.parse(input)).handler(async ({ data, context }) => {
    await roleOf(context.supabase, context.userId);
    const result = await context.supabase.from('lead_observations').insert({ lead_id: data.id, content: data.content, author_id: context.userId }).select('id').single();
    if (result.error) throw new Error('Não foi possível registrar a observação.'); return result.data;
  });