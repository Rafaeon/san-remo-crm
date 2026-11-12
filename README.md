# San Remo CRM

CRM imobiliário para San Remo Imóveis. **Etapas 1–4 implementadas; Etapa 5 aguarda validação.**

React 19, TypeScript, TanStack Start, Vite, Tailwind v4 e Lovable Cloud.

## Executar localmente

Instalar Bun e Node compatível com Vite. Executar `bun install`, copiar `.env.example` para `.env` e configurar os valores públicos do ambiente de desenvolvimento. Executar `bun run dev`; testes: `bun run test`. Não substituir o `.env` gerado dentro do Lovable.

## Documentação

Ver [análise, modelagem proposta, arquivos, configurações, pendências e validação](docs/fundacao.md).
Ver [estrutura aplicada, segurança e testes da Etapa 2](docs/seguranca.md).
Ver [CRM, arquivos e validação da Etapa 3](docs/crm.md).
Ver [presença por QR Code da Etapa 4](docs/presenca.md).
Ver [distribuição de leads da Etapa 5](docs/distribuicao.md).

CRM com painel, Kanban, cadastro/edição, detalhes, observações, reservatório, presença por QR Code e distribuição de leads por fila (RPC transacional). Estrutura protegida por RLS e migrations versionadas. Novas contas ficam sem papel; a conta atual recebeu gestor somente após autorização explícita.

## Ambientes e publicação

GitHub: conectar em Settings → Git; branches e promoção dev → hlg → prd dependem da configuração do repositório. Lovable não conecta um repositório existente por Git sync. Cada implantação deve usar seu próprio banco e variáveis. O Cloud conectado hoje é único e compartilhado por preview/publicação; o rótulo DEV não garante isolamento.

Vercel não foi configurada. A aplicação TanStack Start requer validação do adaptador/runtime e saída de build antes de configurar os projetos HLG e PRD. Não usar instruções de deploy de uma SPA estática como se fossem equivalentes. Não há publicação ou ambientes externos verificados.

## IA

Lovable auxiliou análise, implementação e testes. A imagem residencial foi gerada por IA e não representa imóvel real. Revisão e limitações constam em `docs/fundacao.md`.
