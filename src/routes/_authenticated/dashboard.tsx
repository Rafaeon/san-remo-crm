import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { LogOut, UserRound, LockKeyhole, LoaderCircle, LayoutDashboard, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand';
import { environmentLabel } from '@/lib/app-config';
import { accountQueryOptions } from '@/services/account.queries';
import { crmQueryOptions } from '@/services/crm.queries';
import { CrmBoard } from '@/components/crm/crm-board';
export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: async ({ context }) => { const account = await context.queryClient.ensureQueryData(accountQueryOptions(context.user.id)); if (account.role) await context.queryClient.ensureQueryData(crmQueryOptions(context.user.id)); },
  head: () => ({ meta: [{ title: 'Painel de leads | San Remo CRM' }, { name: 'description', content: 'Gerencie os relacionamentos e leads da San Remo Imóveis.' }, { property: 'og:title', content: 'Painel de leads | San Remo CRM' }, { property: 'og:description', content: 'Kanban, reservatório e acompanhamento imobiliário.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Dashboard,
});
function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: account } = useSuspenseQuery(accountQueryOptions(user.id));
  async function logout() {
    await client.cancelQueries(); client.clear();
    await supabase.auth.signOut();
    await navigate({ to: '/auth', replace: true });
  }
  return <div className="crm-page"><header className="crm-header"><Brand/><div className="crm-header-actions"><span className="environment"><span/>{environmentLabel}</span><span className="status-tag">{account.role === 'gestor' ? 'Gestor' : account.role === 'corretor' ? 'Corretor' : 'Sem perfil'}</span><Button variant="ghost" asChild><Link to="/account"><UserRound/>Minha conta</Link></Button><Button variant="ghost" size="icon" onClick={logout} title="Sair" aria-label="Sair"><LogOut/></Button></div></header><div className="crm-subnav"><LayoutDashboard size={16}/><span>Painel de leads</span>{account.role && <Button variant="ghost" asChild><Link to="/attendance"><QrCode/>Presença</Link></Button>}</div>{account.role ? <Suspense fallback={<div className="crm-empty"><LoaderCircle className="animate-spin"/>Carregando leads…</div>}><CrmBoard userId={user.id}/></Suspense> : <main className="account-content"><section className="pending-access"><LockKeyhole size={30}/><h2>Acesso aguardando liberação</h2><p>Seu perfil de acesso ainda não foi definido. Nenhum lead está disponível para esta conta.</p></section></main>}<footer className="crm-footer">San Remo Imóveis <span>CRM · 2026</span></footer></div>;
}