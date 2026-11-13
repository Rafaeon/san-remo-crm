// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '@/integrations/supabase/types';

describe.skipIf(process.env['RUN_SECURITY_INTEGRATION'] !== '1')('Live role management rules', () => {
  let admin: SupabaseClient<Database>;
  let manager: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let broker: SupabaseClient<Database>;
  let pending: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  const ids: string[] = [];

  function client(key: string) {
    return createClient<Database>(process.env['SUPABASE_URL'] ?? '', key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
  }

  async function account(role?: 'gestor' | 'corretor') {
    const email = `roles-${randomUUID()}@sanremo-test.invalid`;
    const password = randomUUID() + 'Ab9!';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Conta fictícia de papéis' } });
    if (created.error || !created.data.user) throw new Error('Test account creation failed');
    ids.push(created.data.user.id);
    if (role) {
      const assigned = await admin.from('user_roles').insert({ user_id: created.data.user.id, role });
      if (assigned.error) throw assigned.error;
    }
    const session = client(process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '');
    if ((await session.auth.signInWithPassword({ email, password })).error) throw new Error('Test sign-in failed');
    return session;
  }

  beforeAll(async () => {
    if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) throw new Error('Missing private test bindings');
    admin = client(process.env['SUPABASE_SERVICE_ROLE_KEY']);
    anon = client(process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '');
    manager = await account('gestor');
    other = await account('gestor');
    broker = await account('corretor');
    pending = await account();
  }, 60000);

  afterAll(async () => {
    if (!admin) return;
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }, 60000);

  it('lets a gestor promote and revoke the corretor role', async () => {
    const target = ids[3]!;
    expect((await manager.rpc('assign_user_role', { p_user_id: target, p_role: 'corretor' })).error).toBeNull();
    const promoted = await admin.from('user_roles').select('role').eq('user_id', target).single();
    expect(promoted.data?.role).toBe('corretor');
    expect((await manager.rpc('assign_user_role', { p_user_id: target, p_role: null })).error).toBeNull();
    const revoked = await admin.from('user_roles').select('role').eq('user_id', target);
    expect(revoked.data).toEqual([]);
  });

  it('refuses role changes from corretores, pending accounts and visitors', async () => {
    const target = ids[3]!;
    expect((await broker.rpc('assign_user_role', { p_user_id: target, p_role: 'corretor' })).error?.code).toBe('42501');
    expect((await pending.rpc('assign_user_role', { p_user_id: target, p_role: 'corretor' })).error?.code).toBe('42501');
    expect((await anon.rpc('assign_user_role', { p_user_id: target, p_role: 'corretor' })).error).not.toBeNull();
  });

  it('refuses self role changes', async () => {
    expect((await manager.rpc('assign_user_role', { p_user_id: ids[0]!, p_role: 'corretor' })).error?.code).toBe('22023');
    expect((await manager.rpc('assign_user_role', { p_user_id: ids[0]!, p_role: null })).error?.code).toBe('22023');
  });

  it('lets a gestor grant and revoke the gestor role on others', async () => {
    const target = ids[3]!;
    expect((await manager.rpc('assign_user_role', { p_user_id: target, p_role: 'gestor' })).error).toBeNull();
    const promoted = await admin.from('user_roles').select('role').eq('user_id', target).single();
    expect(promoted.data?.role).toBe('gestor');
    expect((await manager.rpc('assign_user_role', { p_user_id: ids[1]!, p_role: 'corretor' })).error).toBeNull();
    const demoted = await admin.from('user_roles').select('role').eq('user_id', ids[1]!).single();
    expect(demoted.data?.role).toBe('corretor');
  });
});
