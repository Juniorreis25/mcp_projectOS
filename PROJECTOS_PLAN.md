# ProjectOS — Plano-Mestre de Implementação
Versão: 1.7 | Atualizado em: 2026-10-09 | Status: F0 e F1 concluídas; F2 em andamento; F3–F8 não iniciadas

## Objetivo
Criar servidor MCP remoto na Vercel com skills versionadas e portáveis para projetos novos, existentes e retomadas.

## Fases e critérios de aceite

### F0 — Arquitetura e contratos
- **Status:** Concluída, aprovada pelo proprietário em 2026-10-09.
- **Entregas:** Blueprint, contratos, matriz de compatibilidade, permissões, manifestos, arquitetura de estado.
- **Evidência:** aprovação explícita registrada na conversa. Limitação auditada em F2: `docs/PROJECTOS_BLUEPRINT_F0.md` não está presente no repositório; não foi reconstruído.

### F1 — Fundação do repositório
- **Status:** Concluída em 2026-10-09.
- **Critério:** Build limpo, instalação reproduzível, lint, testes aprovados, CI funcional e documentação de instalação.
- **Evidências:** [PR #1 integrado](https://github.com/Juniorreis25/mcp_projectOS/pull/1), squash commit `89749afc28cd9b97a45eaa02f61b64984a879eb0`; [CI final aprovado](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37940609961).
- **Validações:** lockfile versionado, `npm ci`, lint próprio baseado em AST TypeScript, typecheck estrito, build e quatro testes automatizados no GitHub Actions.
- **Decisão de escopo:** A fundação contém apenas o diretório e a documentação preparatória do servidor MCP. Implementação efetiva do endpoint Next.js/Streamable HTTP, dependências MCP, autenticação e deploy são entregas F2.
- **Segurança:** workflow temporário de bootstrap com permissão de escrita foi removido antes da integração.

### F2 — MCP mínimo na Vercel
- **Status:** Em andamento; implementação corrigida em branch `codex/f2-mcp-server`, destinada ao PR #2; sem deploy confirmado.
- **Implementado:** Next.js 16.4.0, `mcp-handler` 2.3.0, SDK MCP 2.3.1, Streamable HTTP stateless em `/mcp`; `projectos.list_skills`/`projectos.get_skill`; manifests e instruções fixos validados; `/api/health`; Bearer token por comparação constante; smoke MCP end-to-end.
- **Evidência local:** `npm ci`, typecheck, build e `npm test` aprovados em 2026-10-09. O smoke cobre health, initialize, tools/list, list/get, 401 e path traversal. Evidência remota ficará registrada após o novo CI.
- **Limitações:** token compartilhado apenas para piloto pessoal, não é OAuth. O Blueprint F0 citado está ausente. Não há URL pública, projeto Vercel, segredo configurado ou teste remoto; F2 não pode ser concluída antes desses itens.
- **Atividades:** Streamable HTTP, autenticação, health check, catálogo validado, CI reproduzível e preparação de preview.
- **Aceite:** Endpoint responde; autenticação aprovada; acessos indevidos bloqueados.

### F3 — Compatibilidade
- **Status:** Não iniciada.
- **Atividades:** discover/plan acessíveis a Codex e VS Code.
- **Aceite:** Descoberta e invocação verificadas nos dois clientes.

### F4 — Fluxo universal
- **Status:** Não iniciada.
- **Atividades:** start, fluxos novo/existente/recuperação, análise de risco.
- **Aceite:** Testes dos três modos e leitura não destrutiva.

### F5 — Execução e garantia
- **Status:** Não iniciada.
- **Atividades:** spec, build, review, test, debug, protect.
- **Aceite:** Revisão, testes e bloqueio das operações sensíveis.

### F6 — Catálogo completo
- **Status:** Não iniciada.
- **Atividades:** idea, release, memory, status, audit; total de 14 skills versionadas.
- **Aceite:** Catálogo verificado e versões fixáveis por projeto.

### F7 — Persistência e continuidade
- **Status:** Não iniciada.
- **Atividades:** armazenamento de estados, retomada, isolamento.
- **Aceite:** Retomada entre clientes/servidores e isolamento testados.

### F8 — Homologação e release 1.0
- **Status:** Não iniciada.
- **Atividades:** Testes ponta a ponta, segurança, rollback e publicação.
- **Aceite:** Evidências, aprovação e release registrados.

## Política de acompanhamento
Após cada fase ou marco relevante, registrar data, evidências verificáveis (commit, PR, workflow), testes, bloqueios e próxima ação. Não marcar fase concluída sem aceite verificável.

## Histórico
- 2026-10-09 — v1.7: implementação F2 auditada e corrigida; catálogo passou a carregar/validar manifestos e instruções versionados, nomes de tools alinhados ao contrato, lockfile e smoke MCP adicionados; preview Vercel ainda pendente.
- 2026-10-09 — v1.6: F2 iniciou em branch isolada. MCP stateless, duas tools, healthcheck e token Bearer implementados; compilação inicial aprovada; preview e autenticação ponta a ponta pendentes.
- 2026-10-09 — v1.5: F1 concluída; PR #1 integrado, lockfile versionado e CI final aprovado. Próxima etapa F2, ainda não iniciada.
- 2026-10-09 — v1.4: repositório GitHub conectado e fundação F1 publicada na `main`; workflow acionado; F1 permanece aberta.
- 2026-10-09 — v1.3: fundação F1 validada localmente; dependências e CI pendentes.
- 2026-10-09 — v1.2: aprovação expressa da F0.
- 2026-10-09 — v1.1: Blueprint enviado para aprovação.
- 2026-10-09 — v1.0: planejamento inicial.
