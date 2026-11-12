import { useEffect, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Clock3, RefreshCw, UsersRound, QrCode, CircleCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { attendanceQueryOptions, attendanceQrQueryOptions } from '@/services/attendance.queries';
import { attendanceTime, isAttendanceActive, secondsRemaining } from '@/lib/attendance-schema';

export function useAttendanceClock(serverNow: string) {
  const [now, setNow] = useState(Date.parse(serverNow));
  useEffect(() => { const start = Date.now(); const server = Date.parse(serverNow); setNow(server); const timer = setInterval(() => setNow(server + Date.now() - start), 1000); return () => clearInterval(timer); }, [serverNow]);
  return now;
}
function ManagerQr({ userId }: { userId: string }) {
  const { data, refetch, isRefetchError } = useSuspenseQuery(attendanceQrQueryOptions(userId));
  const now = useAttendanceClock(data.server_now);
  const remaining = secondsRemaining(data.expires_at, now);
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { const delay = Math.max(0, Date.parse(data.expires_at) - Date.parse(data.server_now)); const timer = setTimeout(() => { void refetch(); }, delay + 50); return () => clearTimeout(timer); }, [data.expires_at, data.server_now, refetch]);
  return <section className="attendance-qr"><div className="section-kicker"><QrCode size={16}/>PRESENÇA DA EQUIPE</div><h2>QR Code vigente</h2><div className="qr-surface">{remaining > 0 && origin ? <QRCodeSVG value={`${origin}/presence#token=${data.token}`} size={256} level="M" marginSize={4} title="QR Code para confirmar presença"/> : <span>Atualizando QR Code…</span>}</div><div className="qr-countdown"><Clock3 size={16}/><span>{remaining > 0 ? `Próxima atualização em ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Código anterior expirado'}</span></div>{isRefetchError && <p role="alert">Não foi possível atualizar o código.</p>}<Button variant="outline" onClick={() => { void refetch(); }}><RefreshCw/>Atualizar</Button></section>;
}
export function AttendancePanel({ userId }: { userId: string }) {
  const { data, refetch, isRefetching } = useSuspenseQuery(attendanceQueryOptions(userId));
  const now = useAttendanceClock(data.serverNow);
  const active = data.rows.filter(row => row.position !== null && isAttendanceActive(row.expires_at, now));
  const own = data.rows[0];
  return <main className="crm-workspace"><div className="crm-heading"><div><div className="section-kicker"><UsersRound size={15}/>EQUIPE SAN REMO</div><h1>Presença dos corretores</h1></div><Button variant="ghost" size="icon" title="Atualizar presença" aria-label="Atualizar presença" disabled={isRefetching} onClick={() => { void refetch(); }}><RefreshCw className={isRefetching ? 'animate-spin' : ''}/></Button></div>{data.role === 'gestor' ? <div className="attendance-layout"><ManagerQr userId={userId}/><section className="attendance-list"><header><h2>Corretores habilitados</h2><span className="status-tag">{active.length} presentes</span></header>{active.length ? <ol>{active.map((row, index) => <li key={row.broker_id}><span className="queue-number">{index + 1}</span><div><strong>{row.display_name}</strong><span>Presença até {attendanceTime(row.expires_at)}</span></div><CircleCheck size={18} className="text-primary"/></li>)}</ol> : <div className="crm-empty"><UsersRound/><h2>Nenhum corretor habilitado</h2><p>Nenhuma presença vigente.</p></div>}</section></div> : <section className="attendance-own"><CircleCheck size={32} className="text-primary"/><h2>{own && isAttendanceActive(own.expires_at, now) ? 'Sua presença está confirmada' : 'Você está sem presença vigente'}</h2>{own && isAttendanceActive(own.expires_at, now) && <p>Válida até {attendanceTime(own.expires_at)}</p>}<Button variant="outline" asChild><Link to="/presence"><QrCode/>Confirmar presença</Link></Button></section>}</main>;
}