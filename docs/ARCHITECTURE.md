# Architecture

F0 blueprint governs: core independent of transport; skill manifests declare permissions and execution locality; MCP client retains control of file edits and command execution. F1 provides core/manifest validators only.

## Contract
Response envelope includes `schema_version`, `request_id`, `status`, `data`, `warnings`, `evidence_refs`, `required_approvals`, `next_actions`. The completion state requires evidence.

## Scope boundary
`apps/mcp-server` is intentionally a **placeholder**. Do not expose unauthenticated tools by deploying this scaffold.
