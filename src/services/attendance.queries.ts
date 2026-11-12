import { queryOptions } from '@tanstack/react-query';
import { getAttendance, getAttendanceQr } from '@/services/attendance.functions';

export const attendanceQueryOptions = (userId: string) => queryOptions({ queryKey: ['attendance', userId], queryFn: () => getAttendance(), staleTime: 0, refetchInterval: 15000 });
export const attendanceQrQueryOptions = (userId: string) => queryOptions({ queryKey: ['attendance-qr', userId], queryFn: () => getAttendanceQr(), staleTime: 0, gcTime: 0, refetchInterval: 15000, retry: 1 });