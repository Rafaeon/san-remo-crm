import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldCheck, UserRound, LockKeyhole } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand';
import { environmentLabel } from '@/lib/app-config';
export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => ({ meta: [{ title: 'Minha conta | San Remo CRM' }, { name: 'description', content: 'Área autenticada da equipe San Remo Imóveis.' }, { property: 'og:title', content: 'Minha conta | San Remo CRM' }, { property: 'og:description', content: 'Acesso seguro da equipe San Remo Imóveis.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Dashboard,
});
function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const client = useQueryClient();
  const name = typeof user.user_metadata['display_name'] === 'string' ? user.user_metadata['display_name'] : 'Boas-vindas';
  async function logout() {
    await client.cancelQueries(); client.clear();
    await supabase.auth.signOut();
    await navigate({ to: '/auth', replace: true });
  }
  return <div className="account-page"><header className="account-header"><Brand/><div className="flex items-center gap-4"><span className="environment"><span/>{environmentLabel}</span><Button variant="outline" onClick={logout}><LogOut/>Sair</Button></div></header><main className="account-content"><div className="section-kicker"><ShieldCheck size={16}/> ACESSO CONFIRMADO</div><h1>Olá, {name}.</h1><p className="text-muted-foreground">Bem-vindo à San Remo Imóveis.</p><section className="account-status"><UserRound size={24}/><div><h2>Minha conta</h2><p>{user.email}</p></div><span className="status-tag">Conectado</span></section><section className="pending-access"><LockKeyhole size={30}/><h2>Acesso aguardando liberação</h2><p>Seu perfil de acesso ainda não foi definido. Nenhum lead está disponível para esta conta.</p><span>Gestor e corretor · permissões pendentes</span></section></main><footer className="account-footer">© 2026 San Remo Imóveis</footer></div>;
}