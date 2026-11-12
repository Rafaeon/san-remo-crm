import { z } from 'zod';

export const attendanceTokenSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/, 'QR Code inválido.') });
export function isAttendanceActive(expiresAt: string, now: number) { return Date.parse(expiresAt) > now; }
export function secondsRemaining(expiresAt: string, now: number) { return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)); }
export function attendanceTime(value: string) { return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }