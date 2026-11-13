import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { profileSchema, teamRoleSchema } from '@/lib/profile-schema';

export const getAccount = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, role] = await Promise.all([
      context.supabase.from('profiles').select('id, display_name, avatar_url, created_at, updated_at').eq('id', context.userId).single(),
      context.supabase.from('user_roles').select('role').eq('user_id', context.userId).maybeSingle(),
    ]);
    if (profile.error || role.error) throw new Error('Não foi possível carregar sua conta.');
    return { profile: profile.data, role: role.data?.role ?? null };
  });

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase.from('profiles')
      .update({ display_name: data.display_name }).eq('id', context.userId)
      .select('id, display_name, avatar_url, created_at, updated_at').single();
    if (error) throw new Error('Não foi possível salvar seu nome.');
    return profile;
  });

export const listTeam = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: caller } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId).maybeSingle();
    if (caller?.role !== 'gestor') throw new Error('Apenas gestores podem consultar a equipe.');
    const profiles: { id: string; display_name: string; created_at: string }[] = [];
    const roles: { user_id: string; role: 'gestor' | 'corretor' }[] = [];
    // Paginate every read instead of silently losing rows at the Data API limit.
    for (let offset = 0; ; offset += 500) {
      const result = await context.supabase.from('profiles').select('id, display_name, created_at').order('created_at').order('id').range(offset, offset + 499);
      if (result.error) throw new Error('Não foi possível carregar a equipe.');
      profiles.push(...result.data); if (result.data.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const result = await context.supabase.from('user_roles').select('user_id, role').order('user_id').range(offset, offset + 499);
      if (result.error) throw new Error('Não foi possível carregar os papéis.');
      roles.push(...result.data); if (result.data.length < 500) break;
    }
    const byId = new Map(roles.map(row => [row.user_id, row.role]));
    // E-mails only exist in auth.users; the admin client is loaded inside this handler and never leaves the server.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const emails = new Map<string, string>();
    for (let page = 1; ; page += 1) {
      const listed = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (listed.error) throw new Error('Não foi possível carregar os e-mails da equipe.');
      listed.data.users.forEach(user => { if (user.email) emails.set(user.id, user.email); });
      if (listed.data.users.length < 200) break;
    }
    return profiles.map(profile => ({ ...profile, email: emails.get(profile.id) ?? null, role: byId.get(profile.id) ?? null, self: profile.id === context.userId }));
  });

export const setUserRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => teamRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('assign_user_role', { p_user_id: data.userId, p_role: data.role });
    if (result.error) throw new Error(result.error.code === '42501' ? 'Apenas gestores podem configurar usuários.' : result.error.code === '22023' ? result.error.message : 'Não foi possível alterar o papel do usuário.');
    return { userId: data.userId, role: data.role };
  });