import { z } from 'zod';
export const stages = ['novo', 'em_contato', 'visita_agendada', 'proposta', 'ganho', 'perdido'] as const;
export const stageLabels = { novo: 'Novo', em_contato: 'Em contato', visita_agendada: 'Visita agendada', proposta: 'Proposta', ganho: 'Ganho', perdido: 'Perdido' };
export const leadSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(100),
  phone: z.string().trim().min(8, 'Informe um telefone válido.').max(30),
  email: z.union([z.string().trim().email('E-mail inválido.').max(255), z.literal('')]).transform(value => value || null),
  source: z.string().trim().min(1, 'Informe a origem.').max(100),
  property_interest: z.string().trim().min(1, 'Informe o interesse imobiliário.').max(500),
  stage: z.enum(stages),
  responsible_id: z.string().uuid().nullable(),
});
export const idSchema = z.object({ id: z.string().uuid() });
export const stageSchema = idSchema.extend({ stage: z.enum(stages) });
export const observationSchema = idSchema.extend({ content: z.string().trim().min(1, 'Escreva uma observação.').max(5000) });