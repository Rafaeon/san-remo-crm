import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState, type FormEvent } from 'react';
import { LogOut, ShieldCheck, UserRound, LockKeyhole, Save, LoaderCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand';
import { environmentLabel } from '@/lib/app-config';
import { Input } from '@/components/ui/input';
import { profileSchema } from '@/lib/profile-schema';
import { accountQueryOptions } from '@/services/account.queries';
import { updateProfile } from '@/services/account.functions';
export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQueryOptions(context.user.id)),
  head: () => ({ meta: [{ title: 'Minha conta | San Remo CRM' }, { name: 'description', content: 'Área autenticada da equipe San Remo Imóveis.' }, { property: 'og:title', content: 'Minha conta | San Remo CRM' }, { property: 'og:description', content: 'Acesso seguro da equipe San Remo Imóveis.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Dashboard,
});
function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: account } = useSuspenseQuery(accountQueryOptions(user.id));
  const saveProfile = useServerFn(updateProfile);
  const [name, setName] = useState(account.profile.display_name);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setFailed(false);
    const parsed = profileSchema.safeParse({ display_name: name });
    if (!parsed.success) { setFailed(true); setMessage(parsed.error.issues[0]?.message ?? 'Nome inválido.'); return; }
    setSaving(true);
    try {
      await saveProfile({ data: parsed.data });
      await client.invalidateQueries({ queryKey: ['account', user.id] });
      setMessage('Nome atualizado.');
    } catch { setFailed(true); setMessage('Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  }
  async function logout() {
    await client.cancelQueries(); client.clear();
    await supabase.auth.signOut();
    await navigate({ to: '/auth', replace: true });
  }
  return <div className="account-page"><header className="account-header"><Brand/><div className="flex items-center gap-4"><span className="environment"><span/>{environmentLabel}</span><Button variant="outline" onClick={logout}><LogOut/>Sair</Button></div></header><main className="account-content"><div className="section-kicker"><ShieldCheck size={16}/> ACESSO CONFIRMADO</div><h1>Olá, {account.profile.display_name}.</h1><p className="text-muted-foreground">Bem-vindo à San Remo Imóveis.</p><section className="account-status"><UserRound size={24}/><div><h2>Minha conta</h2><p>{user.email}</p></div><span className="status-tag">{account.role === 'gestor' ? 'Gestor' : account.role === 'corretor' ? 'Corretor' : 'Sem perfil de acesso'}</span></section><form className="profile-form" onSubmit={save}><div><label className="field-label" htmlFor="profile-name">Nome de exibição</label><Input id="profile-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={100} required/></div><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin"/> : <Save/>}Salvar nome</Button>{message && <p className={failed ? 'text-destructive' : 'text-primary'} role={failed ? 'alert' : 'status'}>{message}</p>}</form>{!account.role && <section className="pending-access"><LockKeyhole size={30}/><h2>Acesso aguardando liberação</h2><p>Seu perfil de acesso ainda não foi definido. Nenhum lead está disponível para esta conta.</p><span>Gestor e corretor · liberação por administrador autorizado</span></section>}</main><footer className="account-footer">© 2026 San Remo Imóveis</footer></div>;
}