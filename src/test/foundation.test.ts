import { describe, expect, it } from 'vitest';
import { canAccessRole } from '@/types/auth';
import { allowsManualPresence, resolveEnvironment } from '@/lib/app-config';
describe('Foundation boundaries', () => {
  it('does not grant gestor access to a corretor', () => { expect(canAccessRole('corretor', 'gestor')).toBe(false); });
  it('does not grant an unassigned user either role', () => { expect(canAccessRole(null, 'gestor')).toBe(false); expect(canAccessRole(null, 'corretor')).toBe(false); });
  it('recognizes homologation without selecting a database', () => { expect(resolveEnvironment('hlg')).toBe('hlg'); });
  it('recognizes production', () => { expect(resolveEnvironment('prd')).toBe('prd'); });
  it('defaults an unconfigured or invalid environment to development', () => { expect(resolveEnvironment(undefined)).toBe('dev'); expect(resolveEnvironment('other')).toBe('dev'); });
  it('keeps the manual presence button outside production, where only the QR Code is used', () => { expect(allowsManualPresence('dev')).toBe(true); expect(allowsManualPresence('hlg')).toBe(true); expect(allowsManualPresence('prd')).toBe(false); });
});