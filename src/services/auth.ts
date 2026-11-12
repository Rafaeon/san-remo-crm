import { supabase } from '@/integrations/supabase/client';
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function register(email: string, password: string, name: string) {
  const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { display_name: name } } });
  if (error) throw error;
}
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  if (error) throw error;
}
export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Invalid login')) return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (message.includes('email address is not allowed')) return 'Use um e-mail válido que possa receber a confirmação de cadastro.';
  if (message.includes('rate limit') || message.includes('Too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  return 'Não foi possível concluir. Tente novamente em instantes.';
}