export type AppEnvironment = 'dev' | 'hlg' | 'prd';
export function resolveEnvironment(value: string | undefined): AppEnvironment {
  return value === 'hlg' || value === 'prd' ? value : 'dev';
}
export const appEnvironment = resolveEnvironment(import.meta.env['VITE_APP_ENV']);
export const environmentLabel = { dev: 'Desenvolvimento', hlg: 'Homologação', prd: 'Produção' }[appEnvironment];