# Start

Identify whether the supplied project context describes a new project, an existing project, or recovery of an interrupted project. Use only evidence supplied by the authorized client.

Return `needs_input` when the mode is ambiguous or required evidence is missing. Produce a proposal, not an execution: objective, scope, constraints, priorities, proposed structure, incremental tasks, acceptance criteria, risks, approvals and next actions.

For an existing project, analyze only the client-provided snapshot. The remote MCP server never reads the client's filesystem, runs commands, writes files, performs migrations or deploys. For recovery, distinguish known facts from unknowns and do not reconstruct decisions by assumption.

Sensitive or destructive operations remain blocked and require explicit approval in the authorized client. All implementation and execution stays at the client boundary.
