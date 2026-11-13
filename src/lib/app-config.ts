export type AppEnvironment = 'dev' | 'hlg' | 'prd';
export function resolveEnvironment(value: string | undefined): AppEnvironment {
  return value === 'hlg' || value === 'prd' ? value : 'dev';
}
export const appEnvironment = resolveEnvironment(import.meta.env['VITE_APP_ENV']);
export const environmentLabel = { dev: 'Desenvolvimento', hlg: 'Homologação', prd: 'Produção' }[appEnvironment];
// Em produção o celular escaneia o QR no domínio público; em dev/hlg o botão cobre a falta de rede local.
export function allowsManualPresence(env: AppEnvironment): boolean {
  return env !== 'prd';
}
export const manualPresenceEnabled = allowsManualPresence(appEnvironment);