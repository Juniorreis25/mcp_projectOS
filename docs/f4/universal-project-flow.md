# F4 — Fluxo Universal de Projetos

Status: em andamento — implementação inicial na branch `feat/f4-universal-project-flow`.

## Objetivo

`projectos.start` identifica o modo de trabalho a partir de evidências fornecidas pelo cliente autorizado e retorna uma proposta read-only. Os modos são:

- `new`: estruturar um projeto novo;
- `existing`: analisar um projeto existente a partir de um snapshot enviado pelo cliente;
- `recovery`: organizar a retomada de um projeto interrompido.

O servidor remoto não acessa o workspace do cliente, não lê arquivos remotos, não executa comandos, não escreve arquivos, não faz migrações e não realiza deploys.

## Separação entre skill e transporte

- Skill/catalog entry: `projectos.start`.
- MCP tool: `projectos_start_workflow`.
- Transporte: MCP Streamable HTTP existente, com autenticação Bearer existente.
- Aplicação: envelope Core `1.0` em `structuredContent` e o mesmo JSON em `content`.
- DTO: a proposta fica dentro de `data`; `request_id`, evidências, aprovações e próximos passos permanecem nos campos do envelope.

## Entrada controlada

A tool aceita apenas dados estruturados fornecidos pelo cliente:

- `project_id`;
- `requested_mode` opcional;
- `goal`, `scope`, `constraints` e `priority_requirements`;
- `project_snapshot` para análise existente;
- `recovery` para retomada;
- referências e resumos em `evidence`;
- `requested_operations` apenas para detectar e bloquear intenção sensível.

O servidor não trata nomes de arquivos, caminhos, comandos ou operações como autorização de execução.

## Seleção de modo

1. Um `requested_mode` compatível com as evidências é aceito.
2. Um `recovery` sem modo explícito seleciona `recovery`.
3. Um `project_snapshot` sem modo explícito seleciona `existing`.
4. Um objetivo sem snapshot/recovery seleciona `new`.
5. Contexto conflitante ou ausência de evidências retorna `needs_input`.

O resultado nunca inventa fatos sobre o projeto. Lacunas são registradas em `decisions_pending`, `next_actions` e riscos.

## Estados e riscos

Uma proposta suficiente parte de `draft` e fica `planned`. Intenção sensível, como escrita, shell, migração, publicação ou deploy, fica `blocked`, recebe risco `critical` e requer uma aprovação humana explícita no cliente autorizado. A tool não libera nem executa a operação mesmo que um texto de aprovação seja enviado.

Cada modo produz plano incremental, critérios de aceite, referências de evidência e próximos passos. O plano identifica `execution_location: client` para manter a fronteira de execução local.

## Testes

Os testes Core cobrem:

- projeto novo;
- projeto existente;
- recuperação;
- ambiguidade;
- evidência insuficiente;
- transições válidas e inválidas;
- bloqueio de operação destrutiva;
- aprovações obrigatórias;
- isolamento lógico por `project_id`;
- proposta read-only e ausência de primitivas de execução.

O smoke MCP cobre catálogo com três skills, descoberta das três tools, `projectos.start`, envelope, request IDs, proposta válida e resposta `blocked` para deploy.

## Limitações desta etapa

F4 está em implementação e não deve ser marcada como concluída antes da revisão, CI, integração segura e homologação. O fluxo ainda não persiste estado, não executa tarefas e não substitui a coleta de evidências no cliente.
