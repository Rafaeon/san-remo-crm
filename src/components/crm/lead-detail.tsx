import { Suspense, useState } from 'react';
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Mail, Phone, Pencil, Send, LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { leadQueryOptions } from '@/services/crm.queries';
import { changeStage, addObservation } from '@/services/crm.functions';
import { observationSchema, stageLabels, stages } from '@/lib/lead-schema';
import type { Lead, Broker } from '@/types/crm';
export function LeadDetail(props: { id: string; userId: string; manager: boolean; brokers: Broker[]; onEdit: (lead: Lead) => void; onClose: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open) props.onClose(); }}><DialogContent className="crm-modal"><Suspense fallback={<><DialogTitle>Carregando lead</DialogTitle><DialogDescription>Aguarde um instante.</DialogDescription><LoaderCircle className="animate-spin"/></>}><DetailContent {...props}/></Suspense></DialogContent></Dialog>;
}
function DetailContent({ id, userId, manager, brokers, onEdit }: { id: string; userId: string; manager: boolean; brokers: Broker[]; onEdit: (lead: Lead) => void }) {
  const { data } = useSuspenseQuery(leadQueryOptions(userId, id)); const [content, setContent] = useState(''); const [error, setError] = useState('');
  const client = useQueryClient(); const stageFn = useServerFn(changeStage); const observeFn = useServerFn(addObservation);
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey: ['crm'] }), client.invalidateQueries({ queryKey: ['lead', userId, id] })]); }
  const stageMutation = useMutation({ mutationFn: stageFn, onSuccess: refresh, onError: () => setError('Não foi possível alterar a etapa.') });
  const observation = useMutation({ mutationFn: observeFn, onSuccess: async () => { setContent(''); await refresh(); }, onError: () => setError('Não foi possível salvar a observação.') });
  const busy = stageMutation.isPending || observation.isPending;
  const lead = data.lead; const broker = brokers.find(b => b.id === lead.responsible_id);
  return <><DialogTitle>{lead.name}</DialogTitle><DialogDescription>{lead.property_interest}</DialogDescription><div className="detail-contact"><span><Phone size={15}/>{lead.phone}</span>{lead.email && <span><Mail size={15}/>{lead.email}</span>}</div><dl className="detail-meta"><div><dt>Origem</dt><dd>{lead.source}</dd></div><div><dt>Responsável</dt><dd>{broker?.display_name ?? (lead.responsible_id ? 'Corretor' : 'Sem responsável')}</dd></div><div><dt>Cadastro</dt><dd>{new Date(lead.created_at).toLocaleString('pt-BR')}</dd></div></dl><div className="flex gap-3 items-center"><Select value={lead.stage} disabled={stageMutation.isPending} onValueChange={stage => { setError(''); stageMutation.mutate({ data: { id, stage } }); }}><SelectTrigger aria-label="Alterar etapa"><SelectValue/></SelectTrigger><SelectContent>{stages.map(stage => <SelectItem key={stage} value={stage}>{stageLabels[stage]}</SelectItem>)}</SelectContent></Select>{manager && <Button variant="outline" disabled={busy} onClick={() => onEdit(lead)}><Pencil/>Editar</Button>}</div><section className="observations"><h3>Observações <span>{data.observations.length}</span></h3><form onSubmit={e => { e.preventDefault(); const parsed = observationSchema.safeParse({ id, content }); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Observação inválida.'); return; } setError(''); observation.mutate({ data: parsed.data }); }}><Textarea aria-label="Nova observação" placeholder="Registrar observação" required maxLength={5000} value={content} onChange={e => setContent(e.target.value)}/><Button type="submit" disabled={observation.isPending}>{observation.isPending ? <LoaderCircle className="animate-spin"/> : <Send/>}Registrar</Button></form>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}<div className="observation-list">{data.observations.length ? data.observations.map(item => <article key={item.id}><div><span>{item.author_id === userId ? 'Você' : 'Equipe San Remo'}</span><time>{new Date(item.created_at).toLocaleString('pt-BR')}</time></div><p>{item.content}</p></article>) : <p className="text-muted-foreground text-sm">Nenhuma observação registrada.</p>}</div></section></>;
}