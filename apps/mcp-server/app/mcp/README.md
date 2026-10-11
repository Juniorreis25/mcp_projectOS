# MCP route boundary

This route is the authenticated, stateless MCP transport adapter. It exposes the read-only catalog tools and the F4 workflow proposal tool:

- `projectos_list_skills`
- `projectos_get_skill`
- `projectos_start_workflow`

`projectos_start_workflow` produces an evidence-backed proposal only. It does not access a client workspace, execute commands, write files, migrate data or deploy. Authentication, Streamable HTTP and the Core envelope remain the F2 boundary.
