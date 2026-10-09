# ProjectOS — Plano-Mestre de Implementação
Versão: 2.7 | Atualizado em: 2026-10-09 | Status: F0, F1 e F2 concluídas; F3 iniciada, F3.1 tecnicamente validada, F3.2 não iniciada; F4–F8 não iniciadas

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
- **Status:** Concluída em 2026-10-09 após squash merge do PR #2 e CI pós-merge aprovado na `main`. Não houve deploy de produção.
- **Implementado:** Next.js 16.4.0, `mcp-handler` 2.3.0, SDK MCP 2.3.1, Streamable HTTP stateless em `/mcp`; `projectos.list_skills`/`projectos.get_skill`; manifests e instruções fixos validados; `/api/health`; Bearer token por comparação constante e esquema normalizado; envelope `Envelope<T>` do Core em `structuredContent`/`content`; `DELETE` autenticado sem operação destrutiva; smoke MCP end-to-end.
- **Evidência local:** `npm ci`, typecheck, build e `npm test` aprovados em 2026-10-09. O smoke cobre health, initialize, tools/list, envelopes completos, discover, plan, 401, Bearer case-insensitive, DELETE e path traversal. [F1 checks](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37961036817) e [F2 MCP checks](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37961036820) concluíram com sucesso para o commit `73f985d9961205ee5eaf6ce3fc6961ebbbab3519`.
- **Evidência Vercel:** preview READY do commit `73f985d`, URL [projectos-ugxpcm817-juniors-projects-21c34634.vercel.app](https://projectos-ugxpcm817-juniors-projects-21c34634.vercel.app). Smoke remoto em 2026-10-09: health 200; sem token 401; DELETE sem token 401; DELETE autenticado 405; initialize/tools/list 200; envelopes de list/discover/plan presentes e válidos. A proteção Vercel foi acessada por link temporário de automação; o token da aplicação continuou obrigatório.
- **Evidência de integração:** [PR #2](https://github.com/Juniorreis25/mcp_projectOS/pull/2) integrado por squash no commit `6c059ec7c44f664afba19a6b2f35f0988fc53f6c`; `main` aponta para esse SHA. Checks pré-merge do HEAD `6e6c7fb`: [F1](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37961192983) e [F2](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37961192921). CI pós-merge na `main`: [F1 checks — run 37961964643](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37961964643), concluído com sucesso.
- **Evidência Vercel:** preview READY do commit `73f985d`, URL [projectos-ugxpcm817-juniors-projects-21c34634.vercel.app](https://projectos-ugxpcm817-juniors-projects-21c34634.vercel.app). O preview foi validado com health, autenticação, DELETE, initialize, tools/list, list/discover/plan. Ele é um preview protegido por acesso temporário e não representa deploy de produção; o token da aplicação continuou obrigatório.
- **Limitações e riscos:** token compartilhado apenas para piloto pessoal, não é OAuth; não há rate limiting nem rotação/revogação avançada; o parser YAML continua limitado; as Actions ainda não estão pinadas por SHA; o Blueprint F0 original está ausente e não foi recriado. Esses itens permanecem recomendações/pendências posteriores.
- **Atividades:** Streamable HTTP, autenticação, health check, catálogo, envelope Core, política DELETE, cobertura discover/plan, CI, preview, smoke remoto, ADR e documentação concluídos.
- **Aceite:** achados P1/P2 corrigidos e validados; PR #2 integrado; `main` validada pelo CI pós-merge. F2 formalmente encerrada.

### F3 — Compatibilidade
- **Status:** Iniciada exclusivamente pela F3.1; F3.1 bloqueada por proteção SSO do preview Vercel; F3.2 não iniciada.
- **Objetivo:** comprovar que o mesmo servidor MCP remoto é utilizável no Codex e no VS Code sem alterar o runtime da F2.
- **Plano de execução:** documentar a configuração do endpoint remoto em cada cliente; fornecer a credencial somente por mecanismo seguro e fora de arquivos versionados; executar descoberta de ferramentas; invocar `projectos.list_skills`; invocar `projectos.get_skill` para `discover` e `plan`; registrar request/response sanitizados, `request_id`, status, envelope e diferenças de comportamento; registrar limitações de transporte, autenticação, proteção do preview e suporte de cada cliente.
- **Critérios de aceite:** ambos os clientes conectam ao mesmo endpoint; ambos descobrem `projectos.list_skills` e `projectos.get_skill`; `discover` e `plan` retornam identificador, versão, manifesto, instruções e envelope Core válido; nenhuma credencial aparece em logs, arquivos ou evidências; diferenças e limitações ficam documentadas; não são introduzidas operações destrutivas.
- **F3.1 — Codex:** tecnicamente validada com base em evidência reportada pelo Orquestrador. O teste real com Codex CLI `0.162.0` concluiu handshake, descobriu `projectos.list_skills`/`projectos.get_skill`, retornou duas skills (`projectos.discover` e `projectos.plan`, ambas `0.1.0`), validou envelope Core `1.0`, três `request_id` distintos e ausência de alterações de arquivos. Esta execução não foi reobservada nesta sessão; os dois avisos de hook permanecem pendência ambiental de baixo impacto. Evidência detalhada: `docs/f3/f3.1-codex.md`; [PR draft #3](https://github.com/Juniorreis25/mcp_projectOS/pull/3).
- **Proteção e credenciais:** a configuração recomendada é `bearer_token_env_var = "PROJECTOS_MCP_TOKEN"` mais `env_http_headers = { "x-vercel-protection-bypass" = "VERCEL_AUTOMATION_BYPASS_SECRET" }`, sem valores em arquivos. Não foi gerado, alterado, revogado ou descriptografado segredo nesta F3.1.
- **Preparação segura:** Protection Bypass for Automation é disponível no plano Hobby, mas a existência/valor de um segredo não foi consultada em claro. Foi preparado procedimento PowerShell com `Read-Host -AsSecureString`, variáveis somente no processo, verificação booleana e limpeza explícita. O Codex Desktop pode não herdar alterações de uma sessão PowerShell existente; os testes devem usar uma sessão/processo iniciado depois da injeção comprovada.
- **Alternativa:** se o bypass não for compatível, avaliar OIDC de desenvolvimento da Vercel via `x-vercel-trusted-oidc-idp-token` ou ambiente MCP dedicado não produtivo. Não usar `vercel curl` como evidência de interoperabilidade Codex e não desativar SSO.
- **Limitação de pipeline:** o projeto Vercel está ligado ao GitHub com `productionBranch: main` e criação de deployments habilitada; pushes em `main` geraram `target=production` automaticamente. Não houve publicação manual nesta F3.1. O projeto possui domínios de produção e o token `PROJECTOS_MCP_TOKEN` aparece apenas em `preview`; a governança do pipeline e a configuração de runtime de produção devem ser decididas antes de novos merges.
- **Política recomendada:** proteger `main`, exigir checks F1/F2 e usar promoção explícita para produção; manter as próximas atividades em branches de preview até a decisão de governança. Nenhuma configuração Vercel foi alterada.
- **Critério de continuidade:** A–F da F3.1 foram considerados atendidos com base no relato verificável do Orquestrador; a pendência dos hooks é ambiental e não bloqueante. F3.2 permanece não iniciada e exige nova autorização operacional, credenciais seguras e registro do ambiente VS Code.
- **Próxima atividade:** F3.2 — VS Code, recomendada para início controlado após autorização do Orquestrador. A F3 inteira não está concluída.
- **Hooks:** duas mensagens `Hook failed — hook exited with code 1` foram atribuídas com alta probabilidade aos hooks globais da skill Impeccable no Codex, não ao ProjectOS. A investigação é pendência não bloqueante; nenhum hook foi desativado.
- **F3.2 — VS Code (procedimento preparado, não executado):** configurar somente em escopo de usuário/workspace apropriado, confirmar suporte a HTTP Streamable, fornecer `Authorization: Bearer` do ProjectOS e `x-vercel-protection-bypass` por entradas protegidas/ambiente seguro, verificar descoberta, `list_skills`, `discover`, `plan`, envelope e ausência de escrita. Não iniciar até registrar versão do VS Code/Copilot, método de armazenamento e disponibilidade das duas credenciais.
- **F3.2 — credenciais:** preferir configuração sem valores versionados; validar a diferença entre `.vscode/mcp.json` com inputs interativos e `.mcp.json`/`~/.copilot/mcp-config.json` usados diretamente pelo Agent Host. Inputs interativos podem não ser encaminhados ao Agent Host; essa compatibilidade deve ser comprovada antes dos testes.

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
- 2026-10-09 — v2.7: Orquestrador reportou teste real Codex aprovado para handshake, catálogo, discover, plan, envelope Core e limites read-only; F3.1 tecnicamente validada; duas falhas de hook global Impeccable diagnosticadas como pendência não bloqueante; procedimento F3.2 VS Code preparado sem execução.
- 2026-10-09 — v2.6: disponibilidade do Protection Bypass confirmada por plano/documentação; existência do segredo não consultada em claro; procedimento PowerShell efêmero, verificação sem valores, limpeza, alternativa OIDC e recomendação de governança de `main` documentados; F3.1 permanece bloqueada aguardando provisionamento humano autorizado.
- 2026-10-09 — v2.5: preview de evidência do PR #3 confirmado no commit `08d5eb1`; `POST /mcp` sem bypass reproduziu `401 Protected deployment`; suporte a `bearer_token_env_var` e `env_http_headers` documentado; ausência de segredos locais confirmada sem exposição; auditoria confirmou `productionBranch: main`, deploys automáticos e ausência de `PROJECTOS_MCP_TOKEN` em production; F3.1 permanece bloqueada.
- 2026-10-09 — v2.4: F3.1 iniciada com Codex CLI `0.162.0-alpha.2`; preview F2 confirmado, handshake bloqueado por SSO Vercel, sem execução de tools; branch de documentação preparada; F3.2 não iniciada.
- 2026-10-09 — v2.3: PR #2 integrado por squash no commit `6c059ec`; `main` validada pelo F1 pós-merge `37961964643`; F2 formalmente encerrada; plano da F3 registrado sem execução.
- 2026-10-09 — v2.2: ajuste final de erro de catálogo também envelopado; CI e preview do commit `73f985d` aprovados, smoke remoto repetido; F2 aguarda decisão do Orquestrador.
- 2026-10-09 — v2.1: correções do envelope Core, DELETE autenticado, cobertura de `projectos.plan`, Bearer normalizado, ADR, CI #20/#23 e novo preview remoto aprovados; F2 permanece em revisão do Orquestrador.
- 2026-10-09 — v2.0: revisão final do PR #2 contra `main`; CI/preview confirmados, Blueprint F0 não localizado, divergência de contrato identificada; recomendação BLOCK para merge até correção ou decisão arquitetural explícita.
- 2026-10-09 — v1.9: F2 concluída tecnicamente; CI #20/#14, preview READY e smoke remoto do commit `43ccd99` aprovados; PR #2 permanece draft, F3 não iniciada.
- 2026-10-09 — v1.8: CI do commit `7554f14` aprovado; preview Vercel publicado e validado remotamente com health, autenticação, initialize, tools/list e get_skill; F2 ainda sem merge/produção.
- 2026-10-09 — v1.6: F2 iniciou em branch isolada. MCP stateless, duas tools, healthcheck e token Bearer implementados; compilação inicial aprovada; preview e autenticação ponta a ponta pendentes.
- 2026-10-09 — v1.5: F1 concluída; PR #1 integrado, lockfile versionado e CI final aprovado. Próxima etapa F2, ainda não iniciada.
- 2026-10-09 — v1.4: repositório GitHub conectado e fundação F1 publicada na `main`; workflow acionado; F1 permanece aberta.
- 2026-10-09 — v1.3: fundação F1 validada localmente; dependências e CI pendentes.
- 2026-10-09 — v1.2: aprovação expressa da F0.
- 2026-10-09 — v1.1: Blueprint enviado para aprovação.
- 2026-10-09 — v1.0: planejamento inicial.
