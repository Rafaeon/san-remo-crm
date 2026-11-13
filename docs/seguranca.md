# Etapa 2 — banco de dados e segurança

Etapa 1 aprovada pelo usuário. A Etapa 2 implementa a estrutura e proteção dos dados, sem interface de CRM, QR Code ou distribuição.

## Modelagem aplicada

Oito tabelas foram criadas com UUIDs, relacionamentos, constraints, timestamps e índices: profiles, user_roles, leads, lead_observations, attendance_tokens, broker_attendance, broker_queue e lead_distribution_history.

- `profiles`: um perfil por conta, criado automaticamente pelo trigger de cadastro. Contas existentes foram preenchidas na mesma migration. Nome e avatar são campos de apresentação; não contêm permissões.
- `user_roles`: papel único por usuário, gestor ou corretor, separado do perfil. Cadastros e contas existentes continuam sem papel até liberação autorizada. Não existe escrita de papéis pelo navegador.
- `leads`: seis etapas obrigatórias, dados de contato/interesse, responsável opcional e autor. Gestores leem, cadastram e editam. Corretores leem apenas os próprios leads e alteram somente a etapa. RLS é complementada por trigger para proteger os demais campos e impedir reatribuição.
- `lead_observations`: autor é a conta autenticada, leitura e inserção apenas quando há acesso ao lead. Sem alteração ou exclusão por clientes.
- `attendance_tokens`: somente acesso privilegiado, sem leitura por gestor, corretor ou anônimo.
- `broker_attendance` e `broker_queue`: gestor consulta todos, corretor somente seu registro; clientes não escrevem presença ou posição.
- `lead_distribution_history`: gestor consulta; clientes não inserem, alteram ou excluem. IDs de operação e lead são únicos.

Constraints de duração de token e presença fixam as janelas de 5 minutos e 5 horas sem depender de `now()` em CHECK. A geração/validação de token e as regras de renovação/fila não foram implementadas; continuam na Etapa 4. A RPC transacional de distribuição continua na Etapa 5.

## Controle de acesso

Todas as oito tabelas têm RLS. Privilégios foram explicitamente concedidos e privilégios de anônimos removidos. Um helper `has_role` somente leitura, SECURITY DEFINER com search_path fixo, permite políticas não recursivas. Não altera papéis nem retorna dados de perfil.

O verificador de banco informa duas condições intencionais: tokens com RLS e nenhuma política de cliente (bloqueados), e execução autenticada do helper SECURITY DEFINER (necessária às políticas de leitura). Não são apresentadas como prova de segurança total; os testes abaixo validam comportamentos concretos.

Nenhum usuário real recebeu privilégios automaticamente. Para liberar gestor/corretor, um operador autorizado deve provisionar o registro em user_roles pelo canal administrativo; não há botão de autopromoção ou criação de gestor no cadastro. Um papel gestor também não ganha permissão para conceder papéis pelo navegador. Atualização posterior (gestão de usuários): o gestor atribui e remove os papéis gestor e corretor de terceiros pela tela Equipe, via RPC restrita; a alteração do próprio papel continua bloqueada — o último gestor não consegue se rebaixar. A definição de quem será o primeiro gestor deve ser explicitamente fornecida pelo responsável do projeto.

## Interface entregue

`/dashboard` carrega perfil e papel do banco por função autenticada, usando RLS como o próprio usuário. Nome pode ser editado com validação no formulário e no servidor (1–100 caracteres); ID de usuário não vem do formulário. A conta mostra Gestor, Corretor ou Sem perfil de acesso conforme o registro protegido. Contas sem papel continuam bloqueadas para dados de CRM.

Nome salvo persiste após atualização. Logout cancela consultas, limpa cache e retorna ao login. Consultas de conta possuem a identidade na chave para evitar cache entre contas.

## Versionamento

As migrations foram criadas/aplicadas pela ferramenta da plataforma em:

- `drizzle/migrations/0000_san_remo_profiles_roles_and_crm_security.sql`
- `drizzle/migrations/0001_explicitly_restrict_anon_and_internal_writes.sql`

Neste template as migrations SQL são versionadas com Drizzle Kit, não em `supabase/migrations`. O SQL é PostgreSQL; não foram criados modelos ORM. Os tipos de cliente foram regenerados automaticamente. Os arquivos de migrations, journal e snapshots gerados devem permanecer juntos; não duplicar aplicação em outro sistema de migrations.

Não há seed de leads, presença ou histórico. Dados fictícios usados nos testes são temporários e removidos ao final. O ambiente conectado continua único; DEV/HLG/PRD e Vercel ainda não foram configurados.

## Arquivos desta etapa

Novos: migrations acima e metadados gerados, `src/lib/profile-schema.ts`, `src/services/account.functions.ts`, `src/services/account.queries.ts`, `src/test/profile-schema.test.ts`, `src/test/security.integration.test.ts`, `docs/seguranca.md`.

Atualizados: dashboard, tipos auth, testes/setup, estilos globais, tipos gerados Cloud, README, AGENTS e roadmap. A documentação de fundação descreve historicamente a Etapa 1; este documento registra o estado atual.

## Validação realizada

- Oito tabelas verificadas no banco, todas com RLS.
- 21 testes passaram, incluindo 12 testes contra o banco real com contas fictícias descartáveis.
- Testado: trigger automático de perfil, metadado gestor ignorado, autopromoção recusada, gestor vê todos os leads, corretor somente os próprios, alteração de etapa permitida, reatribuição/detalhes alheios recusados, observações limitadas ao lead/autor, anônimos bloqueados, token bloqueado e escrita de presença recusada.
- Navegador autenticado: nome salvo e relido após atualização; nome original restaurado; papel não alterado; logout e proteção após logout verificados.
- Desktop/celular sem transbordamento horizontal e sem erros de execução observados.

Executar os testes locais com `bun run test`. A suíte de banco é opt-in: `RUN_SECURITY_INTEGRATION=1 bunx vitest run src/test/security.integration.test.ts`. Requer variáveis de servidor de teste e autorização administrativa, não colocar segredos no código. Ela cria e remove suas próprias contas fictícias, nunca atribui papel a contas existentes.

## Como validar e pendências

1. Entrar em `/dashboard` e salvar nome de exibição; atualizar a página e confirmar persistência.
2. Confirmar que Sem perfil de acesso permanece até liberação administrativa; editar nome não concede permissões.
3. Sair e visitar `/dashboard` diretamente: deve retornar ao login.
4. Validar esta etapa antes de solicitar a Etapa 3 (dashboard/CRM, Kanban, leads e observações na interface).

Aguardam etapas futuras: interface de CRM, regras de presença, RPC de distribuição/concor­rência, histórico visual, contas permanentes de demonstração, implantação GitHub/Vercel e ambientes isolados. Para testar os papéis na sua conta, informar explicitamente a conta e o papel desejado; nenhuma atribuição foi feita nesta entrega.