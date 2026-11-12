import { useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { leadSchema, stages, stageLabels } from '@/lib/lead-schema';
import { createLead, editLead } from '@/services/crm.functions';
import type { Lead, Broker, Stage } from '@/types/crm';
export function LeadForm({ lead, brokers, onClose }: { lead: Lead | null; brokers: Broker[]; onClose: () => void }) {
  const [fields, setFields] = useState({ name: lead?.name ?? '', phone: lead?.phone ?? '', email: lead?.email ?? '', source: lead?.source ?? '', property_interest: lead?.property_interest ?? '', stage: lead?.stage ?? 'novo', responsible_id: lead?.responsible_id ?? null });
  const [error, setError] = useState('');
  const create = useServerFn(createLead); const edit = useServerFn(editLead); const client = useQueryClient();
  const mutation = useMutation({ mutationFn: async () => {
    const parsed = leadSchema.safeParse(fields);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Revise os campos.');
    if (lead) await edit({ data: { ...fields, id: lead.id } }); else await create({ data: fields });
  }, onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['crm'] }), client.invalidateQueries({ queryKey: ['lead'] })]); onClose(); }, onError: err => setError(err.message) });
  function submit(event: FormEvent) { event.preventDefault(); setError(''); mutation.mutate(); }
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}><DialogContent className="crm-modal"><DialogTitle>{lead ? 'Editar lead' : 'Novo lead'}</DialogTitle><DialogDescription>Dados do contato e interesse imobiliário.</DialogDescription><form onSubmit={submit} className="lead-form"><div className="lead-form-grid">{([{ key: 'name', label: 'Nome', max: 100 }, { key: 'phone', label: 'Telefone', max: 30 }, { key: 'email', label: 'E-mail (opcional)', max: 255 }, { key: 'source', label: 'Origem', max: 100 }] as const).map(field => <div key={field.key}><label className="field-label" htmlFor={`lead-${field.key}`}>{field.label}</label><Input id={`lead-${field.key}`} type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'} required={field.key !== 'email'} maxLength={field.max} value={fields[field.key]} onChange={e => setFields({ ...fields, [field.key]: e.target.value })}/></div>)}</div><div><label className="field-label" htmlFor="lead-interest">Interesse imobiliário</label><Input id="lead-interest" required maxLength={500} value={fields.property_interest} onChange={e => setFields({ ...fields, property_interest: e.target.value })}/></div><div className="lead-form-grid"><div><label className="field-label">Etapa</label><Select value={fields.stage} onValueChange={stage => setFields({ ...fields, stage: stage as Stage })}><SelectTrigger aria-label="Etapa do lead"><SelectValue/></SelectTrigger><SelectContent>{stages.map(stage => <SelectItem key={stage} value={stage}>{stageLabels[stage]}</SelectItem>)}</SelectContent></Select></div><div><label className="field-label">Responsável</label><Select value={fields.responsible_id ?? 'none'} onValueChange={value => setFields({ ...fields, responsible_id: value === 'none' ? null : value })}><SelectTrigger aria-label="Responsável do lead"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Sem responsável</SelectItem>{brokers.map(b => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent></Select></div></div>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" type="button" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin"/> : <Save/>}Salvar lead</Button></div></form></DialogContent></Dialog>;
}