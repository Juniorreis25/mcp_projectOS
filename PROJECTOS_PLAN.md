# ProjectOS — Plano-Mestre de Implementação
Versão: 1.4 | Atualizado em: 2026-10-09 | Status: F0 concluída; F1 em andamento; F2–F8 não iniciadas

## Objetivo
Criar servidor MCP remoto na Vercel com skills versionadas e portáveis para projetos novos, existentes e retomadas.

## Fases e critérios de aceite

### F0 — Arquitetura e contratos
- **Status:** Concluída, aprovada pelo proprietário em 2026-10-09.
- **Entregas:** Blueprint, contratos, matriz de compatibilidade, permissões, manifestos, arquitetura de estado.
- **Evidência:** Documento `docs/PROJECTOS_BLUEPRINT_F0.md` (a incorporar integralmente), aprovação explícita registrada na conversa.

### F1 — Fundação do repositório
- **Status:** Em andamento; ainda não concluída.
- **Critério:** Build limpo, instalação reproduzível, lint, testes aprovados, CI funcional e documentação de instalação.
- **Evidências:** Código-fonte do monorepo publicado na branch `main` em `4a1befb47fb33f775c0e0df69a78e6999a3c8c38`; testes locais anteriores: 4 aprovados, build/typecheck aprovados.
- **CI:** [Workflow F1 checks](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37939849554) acionado; inicialmente em fila, sem conclusão confirmada.
- **Pendências:** Validar resultado do workflow; efetuar instalação limpa com lockfile; implementar lint completo; verificar adaptador MCP/Next.js ou documentar sua transferência deliberada para F2.
- **Nota:** A rota MCP não está implementada nem publicada. Não confundir fundação com servidor operacional.

### F2 — MCP mínimo na Vercel
- **Status:** Não iniciada.
- **Atividades:** Streamable HTTP, autenticação, health check, list_skills/get_skill, catálogo inicial e preview.
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
- 2026-10-09 — v1.4: repositório GitHub conectado e fundação F1 publicada na `main`; workflow acionado; F1 permanece aberta.
- 2026-10-09 — v1.3: fundação F1 validada localmente; dependências e CI pendentes.
- 2026-10-09 — v1.2: aprovação expressa da F0.
- 2026-10-09 — v1.1: Blueprint enviado para aprovação.
- 2026-10-09 — v1.0: planejamento inicial.
