import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand } from '@/components/brand';
import { authErrorMessage } from '@/services/auth';
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Redefinir senha | San Remo CRM' }, { name: 'description', content: 'Recupere o acesso à sua conta San Remo com segurança.' }, { property: 'og:title', content: 'Redefinir senha | San Remo CRM' }, { property: 'og:description', content: 'Redefinição segura de senha da San Remo Imóveis.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: ResetPassword,
});
function ResetPassword() {
  const [valid, setValid] = useState(false); const [busy, setBusy] = useState(false); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [message, setMessage] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => { const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'; if (recovery) void supabase.auth.getUser().then(({ data }) => setValid(Boolean(data.user))); }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (password !== confirmation) { setMessage('As senhas não coincidem.'); return; } setBusy(true);
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; await supabase.auth.signOut(); setDone(true); setMessage('Sua senha foi atualizada. Entre novamente com a nova senha.'); } catch (error) { setMessage(authErrorMessage(error)); } finally { setBusy(false); }
  }
  return <main className="reset-page"><div className="reset-content"><Brand/><h1>Redefinir senha</h1>{done ? <p role="status">{message}</p> : valid ? <form className="auth-form" onSubmit={submit}><div><label htmlFor="new-password" className="field-label">Nova senha</label><Input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></div><div><label htmlFor="confirm-password" className="field-label">Confirmar nova senha</label><Input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></div>{message && <p role="alert">{message}</p>}<Button disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar nova senha'}</Button></form> : <p>Abra o link de recuperação enviado ao seu e-mail. Se ele expirou, solicite um novo link na tela de login.</p>}<Button variant="link" asChild className="mt-5"><Link to="/auth">Voltar para o login</Link></Button></div></main>;
}