# San Remo CRM

- [x] Etapa 1: análise, identidade visual, login, autenticação e navegação protegida inicial implementados; verificações públicas e testes concluídos.
- [x] Login validado pelo usuário; Etapa 1 aprovada.
- [x] Etapa 2: modelagem, perfis automáticos, papéis separados, RLS e consulta segura do próprio perfil.
- [x] Etapa 2: testes de permissões e validação do perfil no navegador (21 testes aprovados).
- [x] Etapa 2 aprovada; conta atual liberada como gestor com autorização explícita.
- [x] Etapa 3: painel, Kanban, criação/edição, detalhes, observações e reservatório.
- [x] Etapa 3: 25 testes aprovados e fluxos completos de gestor/corretor no navegador.
- [x] Etapa 3 aprovada pelo usuário.
- [x] Etapa 4: QR Code vigente por cinco minutos, confirmação autenticada por cinco horas e fila contínua segura.
- [x] Etapa 4: 37 testes aprovados; renovação, retorno após expiração, concorrência e fluxos de gestor/corretor verificados, incluindo troca automática do QR no navegador.
- [x] Etapa 5: distribuição transacional por fila com histórico imutável e ação Distribuir lead no painel.
- [x] Etapa 5: 46 testes aprovados (incluindo integração no banco real) e validação de gestor/corretor no navegador.
- [x] Deploy na Vercel: URL de produção, contas de demonstração e fluxos validados de ponta a ponta.
- [x] Tela de histórico de distribuição (lead, corretor e data) e configuração de usuários: gestor define gestores e corretores pela tela Equipe, com perfil e e-mail da conta (próprio papel protegido).
- [x] Versionamento de branches dev/hlg/prd (main = prd): branches `dev` e `hlg` criadas, deploy de homologação na Vercel (preview da branch `hlg`); banco único, sem versionamento por ambiente.
- [x] Confirmação de presença por ambiente: somente QR Code em prd; botão de confirmar presença apenas em dev/hlg (gate `VITE_APP_ENV` em `src/lib/app-config.ts`).
- [x] README completo: execução, configuração do Supabase, fluxos principais, ferramentas de IA usadas e limitações.
- [ ] Animação de roleta na distribuição de leads (opcional no desafio).

E-mails e provedores externos não foram validados integralmente.