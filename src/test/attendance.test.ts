import { describe, expect, it } from 'vitest';
import { attendanceTokenSchema, isAttendanceActive, secondsRemaining } from '@/lib/attendance-schema';

describe('Attendance boundaries', () => {
  it('marks presence expired exactly after five hours', () => {
    const expiry = '2026-11-12T20:00:00Z';
    expect(isAttendanceActive(expiry, Date.parse('2026-11-12T19:59:59Z'))).toBe(true);
    expect(isAttendanceActive(expiry, Date.parse('2026-11-12T20:00:00Z'))).toBe(false);
  });
  it('hides expired QR codes at the five-minute boundary', () => {
    expect(secondsRemaining('2026-11-12T15:05:00Z', Date.parse('2026-11-12T15:00:00Z'))).toBe(300);
    expect(secondsRemaining('2026-11-12T15:05:00Z', Date.parse('2026-11-12T15:05:00Z'))).toBe(0);
  });
  it('rejects malformed QR payloads', () => {
    expect(attendanceTokenSchema.safeParse({ token: 'x'.repeat(64) }).success).toBe(false);
    expect(attendanceTokenSchema.safeParse({ token: 'a'.repeat(64) }).success).toBe(true);
  });
});