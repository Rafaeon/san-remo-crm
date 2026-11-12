import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { AttendancePanel } from '@/components/crm/attendance-panel';
import { accountQueryOptions } from '@/services/account.queries';
import { attendanceQueryOptions, attendanceQrQueryOptions } from '@/services/attendance.queries';

export const Route = createFileRoute('/_authenticated/attendance')({
  loader: async ({ context }) => { const account = await context.queryClient.ensureQueryData(accountQueryOptions(context.user.id)); if (account.role) { await context.queryClient.ensureQueryData(attendanceQueryOptions(context.user.id)); if (account.role === 'gestor') await context.queryClient.ensureQueryData(attendanceQrQueryOptions(context.user.id)); } },
  head: () => ({ meta: [{ title: 'Presença da equipe | San Remo CRM' }, { name: 'description', content: 'Presença dos corretores San Remo e QR Code vigente.' }, { property: 'og:title', content: 'Presença da equipe | San Remo CRM' }, { property: 'og:description', content: 'Consulte a fila contínua de corretores com presença válida.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Attendance,
});
function Attendance() { const { user } = Route.useRouteContext(); const { data } = useSuspenseQuery(accountQueryOptions(user.id)); return <div className="crm-page"><header className="crm-header"><Brand/><Button variant="outline" asChild><Link to="/dashboard"><ArrowLeft/>Painel de leads</Link></Button></header>{data.role ? <AttendancePanel userId={user.id}/> : <main className="account-content"><h1>Acesso aguardando liberação</h1></main>}<footer className="crm-footer">San Remo Imóveis<span>CRM · 2026</span></footer></div>; }