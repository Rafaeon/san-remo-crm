import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { attendanceTokenSchema } from '@/lib/attendance-schema';
import type { Database } from '@/integrations/supabase/types';

export const getAttendance = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId).maybeSingle();
  if (role.error || !role.data) throw new Error('Seu acesso ainda não foi liberado.');
  const rows: Database['public']['Tables']['broker_attendance']['Row'][] = [];
  const queue: Database['public']['Tables']['broker_queue']['Row'][] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await context.supabase.from('broker_attendance').select('*').order('broker_id').range(offset, offset + 499);
    if (result.error) throw new Error('Não foi possível consultar a presença.');
    rows.push(...result.data); if (result.data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const result = await context.supabase.from('broker_queue').select('*').order('position').range(offset, offset + 499);
    if (result.error) throw new Error('Não foi possível consultar a fila.');
    queue.push(...result.data); if (result.data.length < 500) break;
  }
  const names = new Map<string, string>();
  const permitted = new Set<string>();
  // Recheck current roles so a revoked broker is never shown as eligible.
  for (let offset = 0; offset < rows.length; offset += 500) {
    const ids = rows.slice(offset, offset + 500).map(row => row.broker_id);
    const [profiles, roles] = await Promise.all([
      context.supabase.from('profiles').select('id,display_name').in('id', ids),
      context.supabase.from('user_roles').select('user_id').eq('role', 'corretor').in('user_id', ids),
    ]);
    if (profiles.error || roles.error) throw new Error('Não foi possível consultar os corretores.');
    profiles.data.forEach(row => names.set(row.id, row.display_name));
    roles.data.forEach(row => permitted.add(row.user_id));
  }
  return { role: role.data.role, serverNow: new Date().toISOString(), rows: rows.filter(row => permitted.has(row.broker_id)).map(row => ({ ...row, display_name: names.get(row.broker_id) ?? 'Corretor', position: queue.find(q => q.broker_id === row.broker_id)?.position ?? null })).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)) };
});
export const getAttendanceQr = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const result = await context.supabase.rpc('current_attendance_qr').single();
  if (result.error) throw new Error('Não foi possível carregar o QR Code. Tente novamente.');
  return result.data;
});
export const confirmAttendance = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => attendanceTokenSchema.parse(input)).handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('confirm_broker_attendance', { p_token: data.token }).single();
    if (result.error) throw new Error(result.error.code === '22023' ? 'QR Code inválido ou expirado. Leia o código vigente.' : result.error.code === '42501' ? 'Apenas corretores podem confirmar presença.' : 'Não foi possível confirmar a presença. Tente novamente.');
    return result.data;
  });