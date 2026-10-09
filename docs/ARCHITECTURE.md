# Architecture

F0 blueprint governs: core independent of transport; skill manifests declare permissions and execution locality; MCP client retains control of file edits and command execution. F1 provides core/manifest validators only.

## Contract
Response envelope includes `schema_version`, `request_id`, `status`, `data`, `warnings`, `evidence_refs`, `required_approvals`, `next_actions`. The completion state requires evidence.

## F2 implementation boundary
`apps/mcp-server` is the read-only MCP adapter. It exposes the catalog over Streamable HTTP and keeps file edits, command execution, and workspace inspection in the authorized client. The route requires `PROJECTOS_MCP_TOKEN`; missing, malformed, or incorrect credentials receive `401` without revealing internal details.

The catalog is an allowlist of the two versioned skills. Their fixed manifest and instruction resources are parsed and validated at server startup. No request field is used as a filesystem path, and no remote command execution is exposed.

The repository currently does not contain the `docs/PROJECTOS_BLUEPRINT_F0.md` referenced by the F0 records. F2 therefore follows the contracts and architecture that are present in `docs/ARCHITECTURE.md`, `packages/core`, and `packages/skills`, without reconstructing the missing approval artifact.
