import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { profileSchema } from '@/lib/profile-schema';

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