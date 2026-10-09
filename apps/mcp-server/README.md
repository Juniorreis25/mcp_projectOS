# ProjectOS MCP — F2

Next.js App Router with stateless `mcp-handler` 2.x over Streamable HTTP at `/mcp`.

## Install and validate
Run `npm ci` within `apps/mcp-server`, then `npm run typecheck`, `npm run build` and `npm test`.

Configure `PROJECTOS_MCP_TOKEN` with at least 32 random characters in the runtime environment. Clients must send the `Authorization: Bearer <token>` header. Never commit tokens or put them into query strings.

## Read-only operations
- `projectos.list_skills`
- `projectos.get_skill` for `projectos.discover` and `projectos.plan`
- `GET /api/health` exposes basic non-sensitive health status.

The catalog loads the two fixed, versioned manifests and `SKILL.md` files from the repository and validates them before registering the tools. Tool inputs select from a closed identifier enum; they never become filesystem paths.

## Security scope
A single pre-shared token is a pilot authorization mechanism, not OAuth nor per-user authorization. Production exposure requires a hardened authorization solution, approval, and verification. Workspace files and shell commands are not accessible to this remote server.

## Milestones
F2: server implementation, local/CI validation, and a verified Vercel preview. The preview is not production and uses a personal pilot token, not OAuth. F3: real-client compatibility with Codex and VS Code.

## Vercel preview
Create or link a Vercel project to this repository with `apps/mcp-server` as the Root Directory, Framework Preset `Next.js`, and Node.js 22. Add `PROJECTOS_MCP_TOKEN` as a Preview environment variable with at least 32 random characters. Deploy the branch, then validate `GET /api/health`, a `401` response without `Authorization`, and an authenticated MCP `initialize`, `tools/list`, and `tools/call` request. Do not use a query parameter as authentication and do not promote to production without explicit approval.
