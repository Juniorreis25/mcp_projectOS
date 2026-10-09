# ADR 0001 — Envelope Core nas respostas das tools MCP

- **Status:** Aceito para a F2
- **Data:** 2026-10-09
- **Decisores:** Orquestrador do ProjectOS

## Contexto

O contrato do ProjectOS Core em `packages/core/contracts.ts` define `Envelope<T>` com `schema_version`, `request_id`, `status`, `data`, `warnings`, `evidence_refs`, `required_approvals` e `next_actions`. A revisão final do PR #2 identificou que as tools MCP retornavam apenas `{skills}` e `{skill}` em `structuredContent`.

O MCP também possui seu próprio envelope de transporte e protocolo JSON-RPC. Esses envelopes não devem ser substituídos nem duplicados.

## Decisão

`projectos.list_skills` e `projectos.get_skill` retornam o `Envelope<T>` oficial do Core dentro de `structuredContent`. Os DTOs atuais permanecem em `data.skills` e `data.skill`, respectivamente. O texto em `content` serializa o mesmo envelope para clientes que não consomem `structuredContent`.

`request_id` é gerado por requisição HTTP no servidor e compartilhado pelas respostas de tools executadas dentro daquela requisição. O envelope MCP/JSON-RPC continua sendo responsabilidade do SDK; o envelope ProjectOS é o contrato de aplicação.

Erros de transporte, autenticação HTTP e validação MCP continuam usando os códigos e formatos nativos dessas camadas. Não foi criado um segundo contrato de aplicação.

## Consequências

- Clientes MCP que usam `structuredContent` recebem o contrato Core sem perder o protocolo MCP.
- Clientes que usam apenas `content` recebem a mesma representação JSON do envelope.
- A validação do contrato deve cobrir todos os campos obrigatórios e os DTOs de `discover` e `plan`.
- O Blueprint F0 original continua ausente; esta decisão referencia somente os contratos versionados disponíveis e não o recria.
