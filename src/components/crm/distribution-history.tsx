import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { History, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { historyQueryOptions } from '@/services/crm.queries';

export function DistributionHistory({ userId, onOpenLead }: { userId: string; onOpenLead: (leadId: string) => void }) {
  return <Suspense fallback={<LoaderCircle className="animate-spin" aria-label="Carregando histórico"/>}><HistoryList userId={userId} onOpenLead={onOpenLead}/></Suspense>;
}
function HistoryList({ userId, onOpenLead }: { userId: string; onOpenLead: (leadId: string) => void }) {
  const { data } = useSuspenseQuery(historyQueryOptions(userId));
  return <section className="attendance-list"><header><h2>Histórico de distribuição</h2><span className="status-tag">{data.length} {data.length === 1 ? 'registro' : 'registros'}</span></header>{data.length ? <ol>{data.map(row => <li key={row.operation_id}><div><Button variant="link" className="lead-name" onClick={() => onOpenLead(row.lead_id)}>{row.lead_name}</Button><span>{row.broker_name} · {new Date(row.distributed_at).toLocaleString('pt-BR')}</span></div></li>)}</ol> : <div className="crm-empty"><History size={30}/><h2>Nenhuma distribuição registrada</h2><p>Os leads distribuídos pela fila aparecem aqui.</p></div>}</section>;
}
