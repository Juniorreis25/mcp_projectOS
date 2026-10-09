# ProjectOS MCP — F2

Next.js App Router with stateless `mcp-handler` 2.x over Streamable HTTP at `/mcp`.

## Install
Run `npm install` within `apps/mcp-server`; then `npm run build` and `npm run dev`.

Configure `PROJECTOS_MCP_TOKEN` with at least 32 random characters in the runtime environment. Clients must send the `Authorization: Bearer <token>` header. Never commit tokens or put them into query strings.

## Read-only operations
- `projectos_list_skills`
- `projectos_get_skill` for `projectos.discover` and `projectos.plan`
- `GET /api/health` exposes basic non-sensitive health status.

## Security scope
A single pre-shared token is a pilot authorization mechanism, not OAuth nor per-user authorization. Production exposure requires a hardened authorization solution, approval, and verification. Workspace files and shell commands are not accessible to this remote server.

## Milestones
F2: server implementation, CI, authenticated preview validation. F3: real-client compatibility with Codex and VS Code.
