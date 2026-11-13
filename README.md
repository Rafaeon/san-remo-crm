# San Remo CRM — CRM e Roleta de Leads

MVP de CRM imobiliário para o desafio técnico da **San Remo Imóveis**: gestão de leads em Kanban, presença da equipe por QR Code e distribuição round-robin de leads entre corretores.

- **Produção (prd):** https://crm-san-remo.vercel.app
- **Homologação (hlg):** https://crm-san-remo-git-hlg-rafaels-projects-d01eb788.vercel.app (branch `hlg`, deploy de preview)
- **Repositório:** https://github.com/Rafaeon/san-remo-crm (deploy automático a cada push em `main`)

A homologação fica aberta sem login para que recrutadores e avaliadores possam navegar os dois ambientes e ver o versionamento (branch `hlg` → homologação, branch `main` → produção). **Em um ambiente de trabalho real, o Deployment Protection da Vercel ficaria habilitado** (Project Settings → Deployment Protection), exigindo autenticação para abrir deploys de preview; aqui ele foi desativado por ser um sistema de teste/demonstração.

## Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Gestor | `gestor.demo@sanremoimobiliaria.com.br` | `SanRemo@2026` |
| Corretor | `corretor.demo@sanremoimobiliaria.com.br` | `SanRemo@2026` |

Credenciais exclusivas para o teste, sobre dados fictícios.

## O que o sistema faz

- **Gestor**: enxerga todos os leads, cadastra e edita contatos, consulta o reservatório (leads sem responsável), aciona a distribuição, acompanha quem está habilitado (presença) e configura os papéis da equipe (define gestores e corretores, com perfil e e-mail de cada conta).
- **Corretor**: confirma presença e acessa somente os próprios leads, podendo mudar a etapa e registrar observações com data.
- **Kanban** com as seis etapas: Novo, Em contato, Visita agendada, Proposta, Ganho e Perdido. Cada lead tem nome, telefone, origem, interesse, etapa, responsável (quando atribuído) e e-mail opcional.
- **Presença por QR Code**: código renovado a cada 5 minutos; a confirmação habilita o corretor por 5 horas; nova leitura renova sem duplicar; fila contínua (renovação preserva posição; retorno após expirar entra no fim). O gestor exibe o QR e o corretor o escaneia com a câmera do próprio celular — o código abre a página de presença do CRM, onde ele faz login pelo aparelho e confirma ali. Em `dev`/`hlg` existe ainda o botão **"Confirmar minha presença"** direto na conta do usuário (ver "Limitações da entrega").
- **Distribuição round-robin**: cada acionamento do gestor envia o lead mais antigo do reservatório ao próximo corretor habilitado, em ordem circular. Presença expirada é ignorada; um lead já atribuído não é distribuído de novo (liberado manualmente, volta ao reservatório); o resultado aparece na tela e vai para o histórico (lead, corretor e data).

## Stack

React 19 · TypeScript · TanStack Start (rotas e funções de servidor) · Vite · Tailwind CSS v4 · Radix UI · TanStack Query · Supabase (PostgreSQL + Auth) · Vitest · Vercel.

## Executar localmente

Pré-requisitos: **Node.js 22.12+** (ou Bun) e um projeto Supabase (ver seção seguinte).

```bash
git clone https://github.com/Rafaeon/san-remo-crm
cd san-remo-crm
npm install           # ou: bun install
cp .env.example .env  # preencher com as chaves do seu projeto Supabase
npm run dev           # http://localhost:8080
```

Variáveis do `.env` (o repositório nunca versiona segredos; veja `.env.example`):

| Variável | Onde encontrar | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` e `SUPABASE_URL` | Project Settings → API → Project URL | API do Supabase (navegador e servidor) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → publishable/anon key | Chave pública, nos dois lados |
| `VITE_APP_ENV` | livre | Ambiente: `dev`, `hlg` ou `prd`. Além do rótulo na tela, controla o botão "Confirmar minha presença": visível em `dev`/`hlg`, oculto em `prd` (só QR Code) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → secret key | **Somente** os testes de integração; nunca no navegador nem em `VITE_*` |

## Configurar o Supabase (recriar o banco)

1. Criar um projeto em [supabase.com](https://supabase.com) (região mais próxima).
2. Aplicar as migrations **nesta ordem** (SQL Editor do painel, ou `psql`/cliente SQL pelo *Session pooler*):

   | Arquivo | Conteúdo |
   |---|---|
   | `drizzle/migrations/0000_san_remo_profiles_roles_and_crm_security.sql` | Tabelas, papéis, RLS, triggers de perfil e proteção de campos |
   | `drizzle/migrations/0001_explicitly_restrict_anon_and_internal_writes.sql` | Privilégios: escrita direta bloqueada para clientes |
   | `drizzle/migrations/0002_secure_qr_attendance_and_continuous_queue.sql` | RPCs de presença (QR rotativo e fila contínua) |
   | `drizzle/migrations/0003_transactional_lead_distribution.sql` | RPC de distribuição round-robin + histórico |
   | `drizzle/migrations/0004_share_attendance_qr_with_brokers.sql` | QR de presença exibido para gestores e corretores |

3. Em **Authentication → URL Configuration**, liberar `http://localhost:8080/**` e a URL pública (Vercel).
4. Criar as contas de uso e provisionar os papéis — **novas contas nascem sem papel**, por segurança. O papel é atribuído em `user_roles` por um administrador:

   ```sql
   INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid-do-usuario>', 'corretor'); -- ou 'gestor'
   ```

> A conexão direta do banco (`db.<projeto>.supabase.co`) é IPv6-only; em máquinas sem IPv6, use o **Session pooler** (Settings → Database → Connection string).

## Reproduzir os principais fluxos

1. **CRM (gestor)**: login → `/dashboard` → "Novo lead" → mover cartões no Kanban → abrir detalhes → registrar observação → "Minha conta" para editar o nome.
2. **CRM (corretor)**: login → somente os próprios leads → alterar etapa → registrar observação.
3. **Presença**: corretor em `/attendance` → "Confirmar minha presença" (atalho disponível em `dev`/`hlg`) ou escaneia o QR com a câmera do celular (o QR abre `/presence#token=...`) → passa a constar como habilitado para o gestor por 5 horas.
4. **Distribuição**: gestor clica **"Distribuir lead"** → o lead mais antigo sem responsável vai ao primeiro corretor habilitado da fila → feedback na tela e histórico gravado.
5. **Segurança**: sem login, `/dashboard` redireciona para `/auth`; corretor não enxerga leads alheios e ninguém escreve por cliente em histórico, fila ou papéis (RLS e triggers no banco).

## Como o código está organizado

- `src/routes` — páginas com TanStack file routing; área logada sob `_authenticated`, com validação de sessão no servidor.
- `src/components` — interface (identidade San Remo, Kanban, presença, formulários).
- `src/services` — funções de servidor autenticadas: **único** caminho de leitura e escrita de dados, sempre com a sessão do usuário (sem cliente administrativo no fluxo normal).
- `drizzle/migrations` — schema completo do banco; todas as tabelas com RLS, e as operações de presença/distribuição como RPCs transacionais (compartilham o mesmo advisory lock de concorrência).
- `src/test` — testes unitários e de integração.

Decisões de segurança: papéis apenas em `user_roles` (tabela protegida), nunca em metadados editáveis; triggers impedem a alteração de campos sensíveis dos leads por corretores; o histórico de distribuição é imutável e único por lead.

## Testes

```bash
npm run test                                    # 16 testes unitários
RUN_SECURITY_INTEGRATION=1 npm run test         # suíte completa: 51 testes, incluindo 34 de integração
```

(No PowerShell: `$env:RUN_SECURITY_INTEGRATION='1'; npm run test`.)

Os testes de integração exigem `SUPABASE_SERVICE_ROLE_KEY` e criam/removem suas próprias contas fictícias — nunca tocam em dados de demonstração.

## Ferramentas de IA no desenvolvimento

| Ferramenta | Onde ajudou |
|---|---|
| **Lovable** (lovable.dev) | Análise inicial do desafio, arquitetura e implementação das Etapas 1–4 (autenticação, perfis/RLS, CRM e presença), migrations e primeiros testes |
| **MiMoCode** (Claude, Anthropic) | Continuação do projeto: migração para um Supabase próprio, Etapa 5 (distribuição), ajuste do fluxo de QR, deploy na Vercel, testes de integração e documentação |

**Como o resultado foi conferido:** suíte de 51 testes automatizados (34 deles executados contra o banco real), validação manual ponta a ponta em desktop e celular — login, CRUD de leads, presença por QR e distribuição — no ambiente de produção, além de revisão de cada mudança gerada. A fotografia da tela de login é gerada por IA e não representa um imóvel real.

## Limitações da entrega

- O botão **"Confirmar minha presença"** aparece em `dev` e `hlg`, direto na conta do usuário, e é um implemento para testes: quando se testa localmente, o celular frequentemente não está na mesma rede do computador, então não consegue abrir o QR Code (que aponta para o `localhost` da máquina) e a presença ficaria impossível de confirmar na prática. Em produção, apenas o QR Code: o corretor escaneia com a câmera do celular, o código abre a página de presença do CRM e ele faz login pelo próprio aparelho, confirmando a presença por lá — como o domínio é público, o celular alcança a página sem depender da rede local.
- Não há animação de roleta (opcional no desafio) nem leitor de câmera interno: o QR abre um link, como previsto no enunciado.
- O histórico de distribuição é persistido (lead, corretor e data), mas ainda não possui tela dedicada.
- E-mails de confirmação/recuperação dependem da configuração de SMTP do Supabase; para a avaliação, use as contas de demonstração.
- Login social não foi implementado (não exigido pelo desafio).
- Banco único para todos os ambientes (sem isolamento dev/hlg/prd). Branches: `main` = produção (prd), `hlg` = homologação (deploy de preview na Vercel) e `dev` = desenvolvimento local; o comportamento por ambiente é definido por `VITE_APP_ENV`.

## Documentação por etapa

- [Fundação e análise inicial](docs/fundacao.md)
- [Segurança e banco (Etapa 2)](docs/seguranca.md)
- [CRM (Etapa 3)](docs/crm.md)
- [Presença (Etapa 4)](docs/presenca.md)
- [Distribuição (Etapa 5)](docs/distribuicao.md)
