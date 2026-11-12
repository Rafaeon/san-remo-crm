import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState, type FormEvent } from 'react';
import { LogOut, ShieldCheck, UserRound, Save, LoaderCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand';
import { Input } from '@/components/ui/input';
import { profileSchema } from '@/lib/profile-schema';
import { accountQueryOptions } from '@/services/account.queries';
import { updateProfile } from '@/services/account.functions';
export const Route = createFileRoute('/_authenticated/account')({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQueryOptions(context.user.id)),
  head: () => ({ meta: [{ title: 'Meu perfil | San Remo CRM' }, { name: 'description', content: 'Dados da sua conta San Remo Imóveis.' }, { property: 'og:title', content: 'Meu perfil | San Remo CRM' }, { property: 'og:description', content: 'Gerencie seu nome e consulte seu acesso.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Account,
});
function Account() {
  const { user } = Route.useRouteContext(); const { data: account } = useSuspenseQuery(accountQueryOptions(user.id));
  const client = useQueryClient(); const navigate = useNavigate(); const saveFn = useServerFn(updateProfile);
  const [name, setName] = useState(account.profile.display_name); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) { e.preventDefault(); const parsed = profileSchema.safeParse({ display_name: name }); if (!parsed.success) { setMessage('Informe um nome válido.'); return; } setBusy(true); try { await saveFn({ data: parsed.data }); await client.invalidateQueries({ queryKey: ['account', user.id] }); setMessage('Nome atualizado.'); } catch { setMessage('Não foi possível salvar.'); } finally { setBusy(false); } }
  async function logout() { await client.cancelQueries(); client.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }
  return <div className="account-page"><header className="account-header"><Brand/><Button variant="outline" onClick={logout}><LogOut/>Sair</Button></header><main className="account-content"><Button variant="link" asChild><Link to="/dashboard"><ArrowLeft/>Voltar ao painel</Link></Button><div className="section-kicker mt-6"><ShieldCheck size={16}/>MINHA CONTA</div><h1>Olá, {account.profile.display_name}.</h1><section className="account-status"><UserRound/><p>{user.email}</p><span className="status-tag">{account.role === 'gestor' ? 'Gestor' : account.role === 'corretor' ? 'Corretor' : 'Sem perfil de acesso'}</span></section><form className="profile-form" onSubmit={save}><div><label className="field-label" htmlFor="profile-name">Nome de exibição</label><Input id="profile-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></div><Button disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin"/> : <Save/>}Salvar nome</Button>{message && <p role="status">{message}</p>}</form></main></div>;
}