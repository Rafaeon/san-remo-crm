// Only this fixed same-origin destination can be restored after sign-in.
export function attendanceReturnRequested() { return sessionStorage.getItem('sanremo-presence-return') === '1'; }