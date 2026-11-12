# San Remo CRM — análise e entrega da Etapa 1

## Requisitos e decisões

O documento completo foi analisado. Este trabalho se limita à fundação: identidade, autenticação, configuração inicial e uma área autenticada sem dados de CRM. Kanban, leads, presença, distribuição e histórico NÃO foram implementados.

A arquitetura aprovada nesta conversa é React 19 + TypeScript + TanStack Start + Vite, com Lovable Cloud. É monolítica, com serviços separados da interface. Não é o React/Vite SPA puro do desafio original. TanStack Router exige páginas em `src/routes`, não `src/pages`. Operações internas seguras futuras usarão funções de servidor TanStack; operações de distribuição continuarão transacionais em PostgreSQL RPC. Não serão criadas novas Edge Functions.

GitHub e Vercel não foram conectados. A Vercel exige adaptar/validar o empacotamento e o runtime de hospedagem; o deploy atual da plataforma não comprova compatibilidade com Vercel. A promoção dev → hlg → prd e três bancos isolados ainda dependem da configuração dos ambientes. **O único Cloud atualmente conectado é compartilhado pelo preview e pela publicação; não representa três ambientes.** O marcador visual DEV é configuração da aplicação, não prova de isolamento dos dados.

A imagem de referência do login mencionada no documento não foi enviada. A fotografia exibida é gerada por IA, não retrata um imóvel real da empresa.

## Estrutura inicial

```text
src/
  assets/                 fotografia de identidade
  components/             identidade, tela de autenticação, elementos UI
  integrations/           clientes e suporte Cloud gerados pela plataforma
  lib/                    configuração de ambiente e utilitários
  routes/
    __root.tsx            estrutura e atualização de sessão
    index.tsx             login em /
    auth.tsx              login em /auth
    reset-password.tsx    redefinição pública
    _authenticated/
      route.tsx           barreira de sessão
      dashboard.tsx       conta sem acesso a dados do CRM
  services/auth.ts        autenticação
  types/auth.ts           contratos de perfil e papel
  test/                   testes de regras e rotas
docs/                     análise e validação
```

Não criar pastas vazias para serviços ainda não desenvolvidos. Hooks e contextos específicos serão acrescentados quando necessários.

## Proposta de modelagem — somente planejamento, Etapa 2

Todas as tabelas usarão UUID, timestamps UTC (`timestamptz`), chaves estrangeiras, índices e constraints adequados. Migrations idênticas devem ser aplicadas em cada ambiente; privilégios GRANT e RLS devem acompanhar cada tabela.

| Entidade | Campos e relacionamentos propostos |
|---|---|
| profiles | id → auth.users, display_name, avatar_url, created_at, updated_at. Exclusão em cascata; criação automática por trigger de cadastro. |
| user_roles | id, user_id → auth.users, role (gestor/corretor), unique(user_id, role). Sem escrita por usuários comuns. Permissões nunca em profiles ou metadados editáveis. |
| leads | id, name, phone, email opcional, source, property_interest, stage enum com as seis etapas obrigatórias, responsible_id opcional → profiles, created_at, updated_at. Índices de responsável/etapa e reservatório por created_at/id. |
| lead_observations | id, lead_id → leads, author_id → profiles, content, created_at. Leitura condicionada ao acesso ao lead. |
| attendance_tokens | id, token_hash, valid_from, expires_at. Tokens brutos não expostos por leitura pública. |
| broker_attendance | id, broker_id único → profiles, confirmed_at, expires_at. Uma presença por corretor. |
| broker_queue | id, broker_id único → profiles, position bigint, joined_at. Ordem contínua; posição atribuída no servidor. |
| lead_distribution_history | id/operação, lead_id → leads, broker_id → profiles, distributed_by → profiles, distributed_at. Histórico imutável; impedir distribuição duplicada por lead. |

`has_role` com search_path fixo será utilizado nas políticas sem recursão. Gestores leem e gerenciam leads; corretores leem apenas seus leads e alteram somente etapa/observações. RLS de linha não protege colunas isoladamente: constraints, privilégios de coluna ou RPC restrita serão necessários para impedir mudança de responsável. Somente administradores autorizados atribuem papéis, nunca cadastro público.

Presença: token vigente a cada 5 minutos validado no servidor; elegibilidade de 5 horas avaliada pelo relógio PostgreSQL. Renovação válida conserva posição; retorno após expiração entra no fim. Não é necessário cron para persistir a expiração: ela pode ser calculada na consulta. Tokens anteriores devem falhar mesmo se a interface estiver desatualizada.

Distribuição: uma RPC exclusiva para gestores, com transação e bloqueio da fila/ponto de serialização, seleciona lead mais antigo (desempate por UUID), ignora expirados, atribui, avança fila e grava histórico atomicamente. Concorrência entre dois gestores, reservatório vazio e fila vazia exigem testes específicos na Etapa 5. Sem roleta nesta fase.

## Autenticação e perfis

Login por e-mail/senha e provedores Google/Lovable habilitados. Cadastro coleta nome, e-mail e senha, **sem escolher papel**. Nome é metadado de apresentação provisório; `profiles` e seu trigger serão implementados na Etapa 2, com backfill dos usuários existentes. Dados de apresentação nunca concedem autoridade.

A confirmação de e-mail permanece habilitada. Cadastro bem-sucedido exibe mensagem de confirmação, não concede sessão nem permissões. Contas autenticadas entram em `/dashboard`, que mostra somente os dados da própria sessão e acesso aguardando liberação. A separação funcional de gestor/corretor está planejada e tipada, mas **não implementada nem validada em RLS**: fazê-la agora anteciparia a Etapa 2. Nenhuma funcionalidade de CRM foi liberada a qualquer perfil.

Uma assinatura global atualiza a navegação nas mudanças de identidade. A barreira autenticada valida `getUser()`. Logout cancela consultas, limpa cache e substitui navegação. Recuperação de senha usa `/reset-password`, aceita contexto de recovery e atualiza senha sem exigir senha atual.

## Configurações

- Cloud conectado, e-mail/senha, Google e Lovable habilitados. Banco e armazenamento disponíveis, mas nenhuma tabela de negócio criada.
- Gerenciar contas em **More → Users**. Para testar sem esperar confirmação de e-mail, usar **Add user → Create new user** com dados fictícios; não habilitar auto-confirmação global.
- Redirect URLs em **More → Users → Auth settings → Advanced**: autorizar origens locais e publicadas, incluindo `/reset-password`. Para GitHub/Vercel, acrescentar URLs reais depois da configuração.
- Usar configurações independentes por ambiente; nunca colocar service role no navegador. Variáveis públicas no `.env.example` sem credenciais; arquivo `.env` gerado permanece intocado.
- Não há seleção de ambiente ou banco pelo usuário; `VITE_APP_ENV` vem da implantação, com fallback DEV. HLG/PRD só devem ser declarados após isolamento real.

## Funcionalidades entregues

- Login, cadastro com confirmação e recuperação de senha.
- Mostrar/ocultar senha, estados de envio e erros em português.
- Provedores sociais habilitados (fluxos externos precisam de validação pelo usuário).
- Tela de conta protegida, persistência de sessão e logout.
- Identidade San Remo, fotografia gerada, layout adaptado a celular e marcador de ambiente.
- Tipos de perfil/papel e documentação inicial, sem tabelas de negócio.

## Arquivos

Novos: `src/assets/san-remo-residencial.jpg`, `src/components/brand.tsx`, `src/components/auth-screen.tsx`, `src/services/auth.ts`, `src/types/auth.ts`, `src/lib/app-config.ts`, `src/routes/auth.tsx`, `src/routes/reset-password.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/test/foundation.test.ts`, `.env.example`, `docs/fundacao.md`, `roadmap.md`. Clientes Cloud e integração OAuth foram gerados pela plataforma.

Atualizados: `src/styles.css`, `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/start.ts` (integração automática), `README.md`, `AGENTS.md`, dependências e lockfile.

## Como validar

1. Abrir `/` em desktop e celular. Login aparece em português, com indicação Desenvolvimento.
2. Tentar login inválido: mensagem sem exposição de dados.
3. Criar conta fictícia: receber instrução para confirmar e-mail, sem acesso imediato ou escolha de gestor.
4. Confirmar cadastro pelo e-mail e entrar. Verificar `/dashboard` e estado sem permissões; atualizar página e confirmar persistência.
5. Sair; visitar `/dashboard` diretamente e verificar retorno a `/auth`.
6. Solicitar recuperação e abrir link do e-mail; definir nova senha, entrar novamente. Link inválido deve pedir nova recuperação.
7. Validar Google/Lovable no preview com conta autorizada; nenhum papel deve ser concedido.
8. Executar `bun run test` para rotas e regras iniciais. Testes das regras futuras só entram com suas respectivas etapas.

## Pendências

Validação desta etapa pelo usuário. Tabelas profiles e user_roles, backfill, RLS e navegação funcional por papel aguardam Etapa 2. Contas finais fictícias de gestor/corretor aguardam permissões e entrega. GitHub, dev/hlg/prd, isolamento de bancos, Vercel e URLs reais aguardam configuração futura. E-mails de confirmação/recuperação e provedores externos dependem da validação de entrega real.

## IA e revisão

Lovable foi usado para análise, código, documentação e testes; geração de imagens para a fotografia de identidade. Revisão por testes automatizados, inspeção de rotas/segurança e navegador. Nenhuma imagem representa um imóvel real. As regras de negócio posteriores não foram simuladas nem substituídas por controles no navegador.