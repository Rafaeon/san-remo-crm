import { Suspense, useState } from 'react';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { teamQueryOptions } from '@/services/account.queries';
import { setUserRole } from '@/services/account.functions';
import type { TeamMember } from '@/types/crm';

export function TeamPanel({ userId }: { userId: string }) {
  return <Suspense fallback={<LoaderCircle className="animate-spin" aria-label="Carregando equipe"/>}><TeamList userId={userId}/></Suspense>;
}
function TeamList({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery(teamQueryOptions(userId));
  const client = useQueryClient();
  const assignFn = useServerFn(setUserRole);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<TeamMember | null>(null);
  const [confirming, setConfirming] = useState<{ member: TeamMember; role: 'gestor' | 'corretor' | null } | null>(null);
  const assign = useMutation({ mutationFn: assignFn, onSuccess: async () => { setError(''); setConfirming(null); await client.invalidateQueries({ queryKey: ['team', userId] }); }, onError: err => { setError(err.message); setConfirming(null); } });
  function requestChange(member: TeamMember, role: 'gestor' | 'corretor' | null) {
    setError('');
    if (role === 'gestor' || member.role === 'gestor') setConfirming({ member, role });
    else assign.mutate({ data: { userId: member.id, role } });
  }
  return <section className="attendance-list">
    <header><h2>Equipe</h2><span className="status-tag">{data.length} {data.length === 1 ? 'conta' : 'contas'}</span></header>
    <p className="text-muted-foreground text-sm">Defina quem é gestor ou corretor. Clique no nome para ver o perfil completo.</p>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <ol>{data.map(member => <li key={member.id}>
      <div><Button variant="link" className="lead-name" onClick={() => setDetail(member)}>{member.display_name}{member.self && ' (você)'}</Button></div>
      <Select value={member.role ?? 'none'} disabled={member.self || assign.isPending} onValueChange={value => requestChange(member, value === 'none' ? null : (value as 'gestor' | 'corretor'))}>
        <SelectTrigger className="w-[150px] shrink-0" aria-label={`Papel de ${member.display_name}`}><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="none">Sem papel</SelectItem><SelectItem value="corretor">Corretor</SelectItem><SelectItem value="gestor">Gestor</SelectItem></SelectContent>
      </Select>
    </li>)}</ol>
    {detail && <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}>
      <DialogContent className="crm-modal">
        <DialogTitle>{detail.display_name}</DialogTitle>
        <DialogDescription>Perfil da conta na equipe.</DialogDescription>
        <dl className="detail-meta">
          <div><dt>E-mail</dt><dd>{detail.email ?? '—'}</dd></div>
          <div><dt>Papel</dt><dd>{detail.role === 'gestor' ? 'Gestor' : detail.role === 'corretor' ? 'Corretor' : 'Sem perfil de acesso'}</dd></div>
          <div><dt>Conta criada</dt><dd>{new Date(detail.created_at).toLocaleString('pt-BR')}</dd></div>
          <div><dt>Identificador</dt><dd>{detail.id}</dd></div>
        </dl>
        <div className="flex justify-end"><Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button></div>
      </DialogContent>
    </Dialog>}
    {confirming && <Dialog open onOpenChange={open => { if (!open) setConfirming(null); }}>
      <DialogContent className="crm-modal">
        <DialogTitle>{confirming.role === 'gestor' ? `Tornar ${confirming.member.display_name} gestor?` : `Alterar o papel de ${confirming.member.display_name}?`}</DialogTitle>
        <DialogDescription>{confirming.role === 'gestor' ? 'Gestores enxergam todos os leads, distribuem leads e configuram a equipe.' : confirming.role === null ? 'A conta ficará sem perfil de acesso.' : 'A conta passa a atuar como corretor.'}</DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
          <Button onClick={() => assign.mutate({ data: { userId: confirming.member.id, role: confirming.role } })}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>}
  </section>;
}
