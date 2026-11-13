# Etapa 5 — Distribuição de leads

Etapa 4 validada. A distribuição segue o desenho aprovado em `docs/fundacao.md`: RPC exclusiva de gestores, ponto de serialização compartilhado com a presença, lead mais antigo do reservatório (desempate por UUID), ignora corretores com presença expirada, atribui, avança a fila contínua e grava o histórico atomicamente. Sem roleta nesta fase.

## Regras implementadas

- `distribute_next_lead()` seleciona, em uma única transação: o lead sem responsável mais antigo (desempate por UUID) e o primeiro corretor da fila com presença válida e papel ativo. Liberação manual devolve o lead ao pool.
- O corretor atendido vai para o fim da fila contínua; a próxima chamada atende o seguinte. Renovações de presença continuam sem alterar posição.
- Erros distintos: reservatório vazio (`P0002`), fila sem corretor habilitado (`22023`) e quem não é gestor (`42501`).
- Histórico imutável com um registro por entrega (`operation_id` único), autor da distribuição e relógio do banco. Clientes não inserem, alteram nem excluem; um lead já atribuído não é distribuído de novo — liberação manual devolve-o ao pool, e cada entrega gera seu próprio registro.
- A atribuição manual pelo formulário continua disponível e não dispara distribuição automática.

## Interface

`/dashboard` ganhou o botão **Distribuir lead** (somente gestor) ao lado de Novo lead. O resultado mostra qual lead foi entregue a qual corretor e atualiza Kanban e reservatório. Corretores não enxergam a ação.

## Versionamento

Migration a ser aplicada pela ferramenta da plataforma em `drizzle/migrations/0003_transactional_lead_distribution.sql`, com journal e snapshot gerados junto. RPC no estilo das anteriores: SECURITY DEFINER, `search_path` fixo, execução somente para `authenticated` e `pg_advisory_xact_lock(714004)` compartilhado com as RPCs de presença.

## Arquivos desta etapa

Novos: `src/test/distribution.integration.test.ts`, `docs/distribuicao.md`.
Atualizados: `src/services/crm.functions.ts`, `src/components/crm/crm-board.tsx`, tipos gerados, roadmap, README.

## Validação

A suíte de integração opt-in (`RUN_SECURITY_INTEGRATION=1`) cobre: recusa a não gestores, reservatório vazio, fila vazia, atribuição do mais antigo com desempate por UUID, rotação da fila, salto de presença expirada, bloqueio de redistribuição, concorrência entre dois gestores e imutabilidade do histórico. Os casos destrutivos só executam com fila e reservatório livres de dados reais, para não alterar registros de demonstração; caso contrário pulam com aviso.

Validação no navegador pendente: distribuir leads do reservatório com dois corretores presentes e conferir a ordem de atendimento; liberar manualmente um lead distribuído e confirmar que ele volta ao pool para o próximo corretor.

## Pendências

Aplicar a migration no banco via Lovable antes de usar o botão. A suíte de integração exige a chave de serviço, disponível somente no sandbox da plataforma. Histórico visual (tela de auditoria) e distribuição por roleta permanecem fora do escopo.
