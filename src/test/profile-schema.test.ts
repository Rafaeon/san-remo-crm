import { describe, expect, it } from 'vitest';
import { profileSchema } from '@/lib/profile-schema';
describe('Profile input', () => {
  it('rejects blank names', () => { expect(profileSchema.safeParse({ display_name: '   ' }).success).toBe(false); });
  it('rejects more than 100 characters', () => { expect(profileSchema.safeParse({ display_name: 'a'.repeat(101) }).success).toBe(false); });
  it('trims names and does not accept a role in profile updates', () => {
    expect(profileSchema.parse({ display_name: '  Nome fictício  ', role: 'gestor' })).toEqual({ display_name: 'Nome fictício' });
  });
});