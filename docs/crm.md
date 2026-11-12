# Etapa 3 — CRM

Etapa 2 aprovada. A conta atual foi liberada como gestor após autorização explícita; nenhum outro usuário recebeu privilégios.

## Entrega

- `/dashboard`: painel com totais reais, Kanban nas seis etapas, pesquisa de contato/interesse e filtro por responsável.
- Gestores cadastram e editam nome, telefone, e-mail opcional, origem, interesse, etapa e responsável opcional.
- Reservatório exclusivo para gestores, com leads sem responsável ordenados do mais antigo ao mais recente.
- Detalhes incluem cadastro, origem, responsável, etapa e observações com data/hora.
- Etapas podem mudar pelo seletor nos detalhes (inclusive no celular) ou arrastando cartões entre colunas no desktop.
- Corretores veem somente os próprios leads, alteram etapas e registram observações; não recebem cadastro, edição de dados ou reservatório.
- `/account` preserva a edição do perfil existente, acessível por Minha conta.
- Estados vazios, validação, envio em andamento e erros. Kanban rola horizontalmente sem ampliar a página no celular.

## Segurança e arquitetura

Operações internas usam funções TanStack autenticadas, como o usuário, sem cliente administrativo. Cadastro/edição verificam gestor no servidor; mudanças de etapa e observações verificam papel e continuam limitadas por RLS/triggers. Autor e criador são derivados da sessão. Schemas compartilhados validam campos no formulário e no servidor. Leituras paginam em blocos de 500 para não truncar registros. Alterações invalidam simultaneamente os dados da lista e dos detalhes.

Nenhuma migration nova nesta etapa; estrutura aplicada na Etapa 2 foi reutilizada. A atribuição manual pelo gestor não executa nem simula Round-Robin. Não há QR Code, presença ou distribuição automática; aguardam Etapas 4 e 5.

## Arquivos

Novos: `src/lib/lead-schema.ts`, `src/types/crm.ts`, `src/services/crm.functions.ts`, `src/services/crm.queries.ts`, `src/components/crm/crm-board.tsx`, `src/components/crm/lead-form.tsx`, `src/components/crm/lead-detail.tsx`, `src/routes/_authenticated/account.tsx`, `src/test/lead-schema.test.ts`, `docs/crm.md`.

Atualizados: dashboard, estilos, diálogo (fechamento em português e fundo semântico), README, AGENTS e roadmap.

## Verificação

25 testes aprovados, incluindo 12 testes de acesso no banco real. Navegador na conta de gestor: criação de lead sem e-mail/responsável, edição, etapa persistida após atualização, edição preservando etapa, observação persistida, reservatório e filtro vazio. Desktop/celular sem transbordamento horizontal, sem erros de execução.

Navegador com corretor fictício temporário: próprio lead visível, lead alheio oculto, cadastro/reservatório/edição indisponíveis, etapa e observação salvas e relidas. Conta e registros temporários removidos. Um lead fictício de validação na conta do gestor foi mantido no reservatório para inspeção, com uma observação fictícia; não representa contato real.

## Como validar

1. Atualizar `/dashboard`; a conta autorizada deve mostrar Gestor.
2. Cadastrar um lead fictício, sem responsável, e verificar no reservatório.
3. Abrir detalhes, alterar etapa e registrar observação; atualizar a página e conferir os dados.
4. Editar nome/contato sem perder etapa; testar busca e filtro.
5. Abrir Minha conta para editar nome do usuário.
6. Validar esta etapa antes de solicitar presença por QR Code (Etapa 4).

Não existe corretor permanente ainda; a seleção oferece os corretores com papel provisionado. Ambiente Cloud único; GitHub/Vercel e isolamento de ambientes continuam pendentes na preparação de entrega.