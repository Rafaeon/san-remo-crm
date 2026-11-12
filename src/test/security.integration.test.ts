// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '@/integrations/supabase/types';

// Explicit opt-in: runs against the configured backend with disposable fictitious accounts.
const enabled = process.env['RUN_SECURITY_INTEGRATION'] === '1';
describe.skipIf(!enabled)('Live database access boundaries', () => {
  let admin: SupabaseClient<Database>;
  let manager: SupabaseClient<Database>;
  let broker: SupabaseClient<Database>;
  let otherBroker: SupabaseClient<Database>;
  let pending: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  const users: string[] = [];
  const leads: string[] = [];
  const observations: string[] = [];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '';
  const url = process.env['SUPABASE_URL'] ?? '';
  function client(apiKey: string) {
    return createClient<Database>(url, apiKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (apiKey.startsWith('sb_') && headers.get('Authorization') === `Bearer ${apiKey}`) headers.delete('Authorization');
        headers.set('apikey', apiKey);
        return fetch(input, { ...init, headers });
      } },
    });
  }
  async function account(role?: 'gestor' | 'corretor', metadata = {}) {
    const email = `security-${randomUUID()}@sanremo-test.invalid`;
    const password = randomUUID() + 'Ab9!';
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Pessoa fictícia de validação', ...metadata } });
    if (result.error || !result.data.user) throw new Error('Unable to create disposable security account');
    const id = result.data.user.id;
    users.push(id);
    if (role) {
      const assigned = await admin.from('user_roles').insert({ user_id: id, role });
      if (assigned.error) throw new Error('Unable to provision test role');
    }
    const signed = client(key);
    const login = await signed.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error('Unable to sign in disposable test account');
    return signed;
  }
  beforeAll(async () => {
    if (!url || !key || !process.env['SUPABASE_SERVICE_ROLE_KEY']) throw new Error('Missing private test bindings');
    admin = client(process.env['SUPABASE_SERVICE_ROLE_KEY']); anon = client(key);
    manager = await account('gestor'); broker = await account('corretor'); otherBroker = await account('corretor');
    pending = await account(undefined, { role: 'gestor' });
    const response = await manager.from('leads').insert([
      { name: 'Lead fictício A', phone: '11999990001', source: 'Teste', property_interest: 'Apartamento fictício', responsible_id: users[1] ?? '' },
      { name: 'Lead fictício B', phone: '11999990002', source: 'Teste', property_interest: 'Casa fictícia', responsible_id: users[2] ?? '' },
      { name: 'Lead fictício C', phone: '11999990003', source: 'Teste', property_interest: 'Terreno fictício' },
    ]).select('id');
    if (response.error || response.data.length !== 3) throw new Error('Unable to prepare test leads');
    leads.push(...response.data.map(row => row.id));
  }, 60000);
  afterAll(async () => {
    if (!admin) return;
    if (observations.length) await admin.from('lead_observations').delete().in('id', observations);
    if (leads.length) await admin.from('leads').delete().in('id', leads);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  }, 60000);
  it('creates a profile automatically for each signup', async () => {
    const result = await admin.from('profiles').select('id,display_name').in('id', users);
    expect(result.error).toBeNull(); expect(result.data).toHaveLength(4);
    expect(result.data?.every(row => row.display_name === 'Pessoa fictícia de validação')).toBe(true);
  });
  it('ignores gestor metadata and refuses self-promotion', async () => {
    const own = await pending.from('user_roles').select('role');
    expect(own.data).toEqual([]);
    const write = await pending.from('user_roles').insert({ user_id: users[3] ?? '', role: 'gestor' });
    expect(write.error).not.toBeNull();
  });
  it('allows gestores to see all leads including the reservoir', async () => {
    const result = await manager.from('leads').select('id').in('id', leads);
    expect(result.error).toBeNull(); expect(result.data).toHaveLength(3);
  });
  it('allows corretores to see only their own leads', async () => {
    const result = await broker.from('leads').select('id').in('id', leads);
    expect(result.error).toBeNull(); expect(result.data?.map(row => row.id)).toEqual([leads[0]]);
  });
  it('allows a corretor to update the stage of their own lead', async () => {
    const result = await broker.from('leads').update({ stage: 'em_contato' }).eq('id', leads[0] ?? '').select('stage');
    expect(result.error).toBeNull(); expect(result.data?.[0]?.stage).toBe('em_contato');
  });
  it('refuses reassignment by a corretor', async () => {
    const result = await broker.from('leads').update({ responsible_id: users[2] ?? '' }).eq('id', leads[0] ?? '');
    expect(result.error).not.toBeNull();
    const stored = await admin.from('leads').select('responsible_id').eq('id', leads[0] ?? '').single();
    expect(stored.data?.responsible_id).toBe(users[1]);
  });
  it('refuses changes to lead details by a corretor', async () => {
    const result = await broker.from('leads').update({ name: 'Alteração não permitida' }).eq('id', leads[0] ?? '');
    expect(result.error).not.toBeNull();
  });
  it('does not update another corretor lead', async () => {
    const result = await broker.from('leads').update({ stage: 'ganho' }).eq('id', leads[1] ?? '').select('id');
    expect(result.data).toEqual([]);
    const stored = await admin.from('leads').select('stage').eq('id', leads[1] ?? '').single();
    expect(stored.data?.stage).toBe('novo');
  });
  it('allows observations only for an accessible lead and the actual author', async () => {
    const own = await broker.from('lead_observations').insert({ lead_id: leads[0] ?? '', content: 'Observação fictícia' }).select('id').single();
    expect(own.error).toBeNull(); if (own.data) observations.push(own.data.id);
    const other = await broker.from('lead_observations').insert({ lead_id: leads[1] ?? '', content: 'Não permitida' });
    expect(other.error).not.toBeNull();
    const forged = await broker.from('lead_observations').insert({ lead_id: leads[0] ?? '', author_id: users[0] ?? '', content: 'Autor falso' });
    expect(forged.error).not.toBeNull();
  });
  it('protects anonymous leads, attendance tokens and client presence writes', async () => {
    expect((await anon.from('leads').select('id')).error).not.toBeNull();
    expect((await manager.from('attendance_tokens').select('id')).error).not.toBeNull();
    const confirmed = new Date().toISOString();
    expect((await broker.from('broker_attendance').insert({ broker_id: users[1] ?? '', confirmed_at: confirmed, expires_at: new Date(Date.now() + 18000000).toISOString() })).error).not.toBeNull();
  });
  it('allows own name edits but not another profile', async () => {
    const own = await broker.from('profiles').update({ display_name: 'Nome fictício atualizado' }).eq('id', users[1] ?? '').select('display_name');
    expect(own.error).toBeNull(); expect(own.data?.[0]?.display_name).toBe('Nome fictício atualizado');
    const other = await broker.from('profiles').update({ display_name: 'Proibido' }).eq('id', users[2] ?? '').select('id');
    expect(other.data).toEqual([]);
  });
  it('keeps unassigned accounts from reading leads', async () => {
    const result = await pending.from('leads').select('id').in('id', leads);
    expect(result.error).toBeNull(); expect(result.data).toEqual([]);
    expect((await otherBroker.from('leads').select('id').in('id', leads)).data?.map(row => row.id)).toEqual([leads[1]]);
  });
});