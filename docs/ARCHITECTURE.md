# Architecture

F0 blueprint governs: core independent of transport; skill manifests declare permissions and execution locality; MCP client retains control of file edits and command execution. F1 provides core/manifest validators only.

## Contract
Response envelope includes `schema_version`, `request_id`, `status`, `data`, `warnings`, `evidence_refs`, `required_approvals`, `next_actions`. The completion state requires evidence.

## F2 implementation boundary
`apps/mcp-server` is the read-only MCP adapter. It exposes the catalog over Streamable HTTP and keeps file edits, command execution, and workspace inspection in the authorized client. The route requires `PROJECTOS_MCP_TOKEN`; missing, malformed, or incorrect credentials receive `401` without revealing internal details.

The catalog is an allowlist of the two versioned skills. Their fixed manifest and instruction resources are parsed and validated at server startup. No request field is used as a filesystem path, and no remote command execution is exposed.

The MCP SDK/JSON-RPC response is the transport envelope. Inside each successful catalog tool result, `structuredContent` and its compatibility `content` carry the ProjectOS Core `Envelope<T>` from `packages/core/contracts.ts`; the catalog DTO remains under `data`. The HTTP request receives a generated `request_id`. HTTP authentication failures and MCP validation failures remain native transport/protocol errors.

The repository currently does not contain the `docs/PROJECTOS_BLUEPRINT_F0.md` referenced by the F0 records. F2 therefore follows the contracts and architecture that are present in `docs/ARCHITECTURE.md`, `packages/core`, and `packages/skills`, without reconstructing the missing approval artifact.

## F4 universal project flow

The `projectos.start` skill and `projectos_start_workflow` MCP tool add a read-only proposal boundary. The server selects `new`, `existing`, or `recovery` only from explicit client context and evidence. It returns `needs_input` for ambiguity or missing evidence and `blocked` for sensitive operation requests.

The server consumes client-provided snapshots and recovery context; it does not inspect a client workspace. File edits, command execution, migrations, approvals and deployments remain at the authorized client boundary. The proposal uses the existing Core `Envelope<T>` and identifies every plan step as `execution_location: client`. No new transport envelope or remote execution mechanism is introduced.
