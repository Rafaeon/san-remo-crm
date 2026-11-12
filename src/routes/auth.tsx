import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [{ title: 'Acesso da equipe | San Remo CRM' }, { name: 'description', content: 'Entre com segurança na sua conta San Remo Imóveis.' }, { property: 'og:title', content: 'Acesso da equipe | San Remo CRM' }, { property: 'og:description', content: 'Autenticação da equipe San Remo Imóveis.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: AuthScreen,
});