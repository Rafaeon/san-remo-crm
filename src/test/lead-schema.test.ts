import { describe, expect, it } from 'vitest';
import { leadSchema, stages, stageSchema, observationSchema } from '@/lib/lead-schema';
const example = { name: 'Contato fictício', phone: '11999990000', email: '', source: 'Site', property_interest: 'Apartamento', stage: 'novo', responsible_id: null };
describe('CRM rules', () => {
  it('accepts precisely the six required stages', () => { expect(stages).toEqual(['novo','em_contato','visita_agendada','proposta','ganho','perdido']); expect(stageSchema.safeParse({ id: 'd4095aab-ca47-4c8d-9df0-814446eb7411', stage: 'invalid' }).success).toBe(false); });
  it('allows optional email and no responsible broker', () => { const result = leadSchema.parse(example); expect(result.email).toBeNull(); expect(result.responsible_id).toBeNull(); });
  it('requires name phone origin and interest', () => { for (const field of ['name','phone','source','property_interest']) expect(leadSchema.safeParse({ ...example, [field]: '' }).success).toBe(false); });
  it('rejects malformed email and empty observations', () => { expect(leadSchema.safeParse({ ...example, email: 'invalid' }).success).toBe(false); expect(observationSchema.safeParse({ id:'d4095aab-ca47-4c8d-9df0-814446eb7411', content:' ' }).success).toBe(false); });
});