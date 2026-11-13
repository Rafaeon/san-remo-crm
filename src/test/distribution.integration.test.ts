// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '@/integrations/supabase/types';

// The distribution RPC reads the global reservoir and queue, so mutating cases run
// only when both start empty of real records. Otherwise they skip to avoid touching
// live data. Role refusal cases always run because they mutate nothing.
describe.skipIf(process.env['RUN_SECURITY_INTEGRATION'] !== '1')('Live lead distribution rules', () => {
  let admin: SupabaseClient<Database>;
  let manager: SupabaseClient<Database>;
  let second: SupabaseClient<Database>;
  let broker: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let pending: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  let managerId = '';
  let secondId = '';
  let brokerId = '';
  let otherId = '';
  const leadIds: string[] = [];
  const userIds: string[] = [];
  let reservoirFree = false;
  let ready = false;

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
    const email = `distribution-${randomUUID()}@sanremo-test.invalid`;
    const password = randomUUID() + 'Ab9!';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Conta fictícia de distribuição' } });
    if (created.error || !created.data.user) throw new Error('Test account creation failed');
    const id = created.data.user.id;
    userIds.push(id);
    if (role) {
      const assigned = await admin.from('user_roles').insert({ user_id: id, role });
      if (assigned.error) throw assigned.error;
    }
    const session = client(process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '');
    if ((await session.auth.signInWithPassword({ email, password })).error) throw new Error('Test sign-in failed');
    return { client: session, id };
  }

  async function seedLead(name: string, createdAt: string) {
    const { data, error } = await admin.from('leads').insert({
      name,
      phone: '11999999999',
      source: 'Teste de distribuição',
      property_interest: 'Apartamento de teste',
      stage: 'novo',
      created_by: managerId,
      created_at: createdAt,
    }).select('id').single();
    if (error) throw error;
    leadIds.push(data.id);
    return data.id;
  }

  function oldestId(a: string, b: string) {
    return a < b ? { min: a, max: b } : { min: b, max: a };
  }

  beforeAll(async () => {
    if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) throw new Error('Missing private test bindings');
    admin = client(process.env['SUPABASE_SERVICE_ROLE_KEY']);
    anon = client(process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '');
    manager = (await account('gestor')).client;
    const secondAccount = await account('gestor');
    second = secondAccount.client; secondId = secondAccount.id;
    const brokerAccount = await account('corretor');
    broker = brokerAccount.client; brokerId = brokerAccount.id;
    const otherAccount = await account('corretor');
    other = otherAccount.client; otherId = otherAccount.id;
    pending = (await account()).client;
    managerId = userIds[0] ?? '';
    const queue = await admin.from('broker_queue').select('broker_id');
    const reservoir = await admin.from('leads').select('created_at').is('responsible_id', null);
    reservoirFree = (reservoir.data?.length ?? 0) === 0;
    // Test leads use year-2000 timestamps so real records are never picked first.
    ready = (queue.data?.length ?? 0) === 0 && (reservoir.data ?? []).every(row => row.created_at > '2000-01-02');
    if (!ready) console.warn('[distribution tests] shared environment: mutating cases skipped');
  }, 60000);

  afterAll(async () => {
    if (!admin) return;
    if (leadIds.length) {
      await admin.from('lead_distribution_history').delete().in('lead_id', leadIds);
      await admin.from('lead_observations').delete().in('lead_id', leadIds);
      await admin.from('leads').delete().in('id', leadIds);
    }
    if (userIds.length) {
      await admin.from('broker_queue').delete().in('broker_id', userIds);
      await admin.from('broker_attendance').delete().in('broker_id', userIds);
    }
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }, 60000);

  it('refuses distribution unless the caller is a gestor', async () => {
    expect((await broker.rpc('distribute_next_lead')).error?.code).toBe('42501');
    expect((await pending.rpc('distribute_next_lead')).error?.code).toBe('42501');
    expect((await anon.rpc('distribute_next_lead')).error).not.toBeNull();
  });

  it('reports an empty reservoir before any queue check', async () => {
    if (!reservoirFree) return;
    expect((await manager.rpc('distribute_next_lead')).error?.code).toBe('P0002');
  });

  it('reports an empty queue when no broker is present', async () => {
    if (!ready) return;
    await seedLead('Lead sem fila', '2000-01-01T00:00:00Z');
    expect((await manager.rpc('distribute_next_lead')).error?.code).toBe('22023');
  });

  it('distributes the oldest lead to the first broker and rotates the queue', async () => {
    if (!ready) return;
    const leadA = leadIds[0]!;
    const qr = await manager.rpc('current_attendance_qr').single();
    if (qr.error) throw qr.error;
    expect((await broker.rpc('confirm_broker_attendance', { p_token: qr.data.token })).error).toBeNull();
    expect((await other.rpc('confirm_broker_attendance', { p_token: qr.data.token })).error).toBeNull();
    const result = await manager.rpc('distribute_next_lead').single();
    expect(result.error).toBeNull();
    expect(result.data?.lead_id).toBe(leadA);
    expect(result.data?.broker_id).toBe(brokerId);
    const history = await admin.from('lead_distribution_history').select('lead_id,broker_id,distributed_by,operation_id').eq('lead_id', leadA).single();
    expect(history.error).toBeNull();
    expect(history.data?.broker_id).toBe(brokerId);
    expect(history.data?.distributed_by).toBe(managerId);
    expect(history.data?.operation_id).toBe(result.data?.operation_id);
    const lead = await admin.from('leads').select('responsible_id').eq('id', leadA).single();
    expect(lead.data?.responsible_id).toBe(brokerId);
    const rotated = await admin.from('broker_queue').select('broker_id,position').order('position', { ascending: false }).limit(1).single();
    expect(rotated.data?.broker_id).toBe(brokerId);
  });

  it('breaks created_at ties by UUID and serves the next broker in line', async () => {
    if (!ready) return;
    const leadB = await seedLead('Lead empatado B', '2000-01-01T01:00:00Z');
    const leadC = await seedLead('Lead empatado C', '2000-01-01T01:00:00Z');
    const { min, max } = oldestId(leadB, leadC);
    const first = await manager.rpc('distribute_next_lead').single();
    expect(first.error).toBeNull();
    expect(first.data?.lead_id).toBe(min);
    expect(first.data?.broker_id).toBe(otherId);
    const secondCall = await manager.rpc('distribute_next_lead').single();
    expect(secondCall.error).toBeNull();
    expect(secondCall.data?.lead_id).toBe(max);
    expect(secondCall.data?.broker_id).toBe(brokerId);
  });

  it('skips brokers whose attendance already expired', async () => {
    if (!ready) return;
    const confirmed = Date.now() - 21600000;
    const expired = await admin.from('broker_attendance').update({ confirmed_at: new Date(confirmed).toISOString(), expires_at: new Date(confirmed + 18000000).toISOString() }).eq('broker_id', otherId);
    expect(expired.error).toBeNull();
    const leadD = await seedLead('Lead com fila parcial', '2000-01-01T02:00:00Z');
    const result = await manager.rpc('distribute_next_lead').single();
    expect(result.error).toBeNull();
    expect(result.data?.lead_id).toBe(leadD);
    expect(result.data?.broker_id).toBe(brokerId);
  });

  it('returns a manually freed lead to the pool and logs every distribution', async () => {
    if (!ready) return;
    const leadD = leadIds[3]!;
    const freed = await admin.from('leads').update({ responsible_id: null }).eq('id', leadD);
    expect(freed.error).toBeNull();
    const result = await manager.rpc('distribute_next_lead').single();
    expect(result.error).toBeNull();
    expect(result.data?.lead_id).toBe(leadD);
    const history = await admin.from('lead_distribution_history').select('id').eq('lead_id', leadD);
    expect(history.data).toHaveLength(2);
  });

  it('serializes concurrent gestores without duplicating leads or brokers', async () => {
    if (!ready) return;
    const qr = await manager.rpc('current_attendance_qr').single();
    if (qr.error) throw qr.error;
    expect((await other.rpc('confirm_broker_attendance', { p_token: qr.data.token })).error).toBeNull();
    const leadF = await seedLead('Lead concorrente F', '2000-01-01T04:00:00Z');
    const leadG = await seedLead('Lead concorrente G', '2000-01-01T04:00:00Z');
    const [one, two] = await Promise.all([
      manager.rpc('distribute_next_lead').single(),
      second.rpc('distribute_next_lead').single(),
    ]);
    expect(one.error).toBeNull();
    expect(two.error).toBeNull();
    expect(new Set([one.data?.lead_id, two.data?.lead_id])).toEqual(new Set([leadF, leadG]));
    expect(new Set([one.data?.broker_id, two.data?.broker_id])).toEqual(new Set([brokerId, otherId]));
    expect(one.data?.operation_id).not.toBe(two.data?.operation_id);
  });

  it('keeps distribution history immutable and leads scoped per broker', async () => {
    if (!ready) return;
    const target = leadIds[0]!;
    expect((await manager.from('lead_distribution_history').update({ distributed_at: new Date().toISOString() }).eq('lead_id', target)).error).not.toBeNull();
    expect((await manager.from('lead_distribution_history').delete().eq('lead_id', target)).error).not.toBeNull();
    expect((await broker.from('lead_distribution_history').insert({ operation_id: randomUUID(), lead_id: target, broker_id: brokerId, distributed_by: brokerId })).error).not.toBeNull();
    expect((await pending.from('lead_distribution_history').select('*')).data).toEqual([]);
    const visible = await other.from('leads').select('id').in('id', leadIds);
    expect(visible.data?.every(row => row.id !== target)).toBe(true);
  });
});
