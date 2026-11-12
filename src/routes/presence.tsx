import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { QrCode, CircleCheck, LoaderCircle, ArrowLeft } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { confirmAttendance } from '@/services/attendance.functions';
import { attendanceTokenSchema, attendanceTime } from '@/lib/attendance-schema';

export const Route = createFileRoute('/presence')({
  head: () => ({ meta: [{ title: 'Confirmar presença | San Remo CRM' }, { name: 'description', content: 'Confirme sua presença na equipe San Remo Imóveis.' }, { property: 'og:title', content: 'Confirmar presença | San Remo CRM' }, { property: 'og:description', content: 'Confirmação segura de presença dos corretores.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: Presence,
});
function Presence() {
  const [token, setToken] = useState(''); const [userId, setUserId] = useState<string | null>(null); const [role, setRole] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [expiry, setExpiry] = useState('');
  const confirm = useServerFn(confirmAttendance); const client = useQueryClient();
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (incoming !== null) { sessionStorage.removeItem('sanremo-presence-token'); if (attendanceTokenSchema.safeParse({ token: incoming }).success) sessionStorage.setItem('sanremo-presence-token', incoming); window.history.replaceState(null, '', '/presence'); }
    setToken(sessionStorage.getItem('sanremo-presence-token') ?? ''); sessionStorage.removeItem('sanremo-presence-return');
    let mounted = true;
    void (async () => { try { const { data } = await supabase.auth.getUser(); if (!mounted) return; setUserId(data.user?.id ?? null); if (data.user) { const result = await supabase.from('user_roles').select('role').eq('user_id', data.user.id).maybeSingle(); if (mounted) setRole(result.data?.role ?? null); } } catch { if (mounted) setMessage('Não foi possível consultar seu acesso.'); } finally { if (mounted) setLoading(false); } })();
    return () => { mounted = false; };
  }, []);
  async function save() { setBusy(true); setMessage(''); try { const result = await confirm({ data: { token } }); setExpiry(result.expires_at); setMessage(result.renewed ? 'Presença renovada. Sua posição na fila foi mantida.' : 'Presença confirmada. Você entrou no final da fila.'); if (userId) await client.invalidateQueries({ queryKey: ['attendance', userId] }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar presença.'); setExpiry(''); } finally { setBusy(false); } }
  return <main className="reset-page"><div className="reset-content presence-content"><Brand/><QrCode className="presence-symbol" size={38}/><h1>Confirmar presença</h1>{loading ? <LoaderCircle className="animate-spin" aria-label="Consultando acesso"/> : !token ? <p role="status">Nenhum QR Code válido foi lido.</p> : !userId ? <Button asChild><Link to="/auth" onClick={() => sessionStorage.setItem('sanremo-presence-return', '1')}>Entrar para confirmar presença</Link></Button> : role !== 'corretor' ? <p role="status">{role === 'gestor' ? 'Apenas corretores podem confirmar presença.' : 'Seu perfil de corretor ainda não foi liberado.'}</p> : <Button disabled={busy} onClick={save}>{busy ? <LoaderCircle className="animate-spin"/> : <CircleCheck/>}{busy ? 'Confirmando…' : expiry ? 'Renovar presença' : 'Confirmar minha presença'}</Button>}{message && <div className={`auth-message${expiry ? '' : ' error'}`} role={expiry ? 'status' : 'alert'}>{message}{expiry && <p className="mt-3">Válida até {attendanceTime(expiry)}</p>}</div>}<Button variant="link" asChild><Link to={userId ? '/attendance' : '/auth'}><ArrowLeft/>{userId ? 'Voltar para presença' : 'Voltar para o login'}</Link></Button></div></main>;
}