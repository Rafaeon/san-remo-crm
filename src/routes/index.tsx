import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from '@/components/auth-screen';
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: 'San Remo CRM | Login' }, { name: 'description', content: 'Acesso seguro ao CRM imobiliário da San Remo Imóveis.' }, { property: 'og:title', content: 'San Remo CRM | Login' }, { property: 'og:description', content: 'Conecte-se à equipe San Remo Imóveis.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: AuthScreen,
});
