# F1 acceptance report — 2026-10-09

## Verified
- ProjectOS core, workflow contracts, and discover/plan skill manifest fixtures are versioned.
- package-lock.json generated and committed by GitHub Actions bootstrap.
- GitHub Actions [F1 check 37940515445](https://github.com/Juniorreis25/mcp_projectOS/actions/runs/37940515445) passed, using npm ci, source quality checks, TypeScript typecheck, build, and 4 automated tests.
- A one-time write-enabled bootstrap workflow was removed after the lockfile was committed.

## Agreed scope boundary
The Next.js/Streamable HTTP MCP endpoint, MCP SDK/mcp-handler dependencies, OAuth and deployment belong to F2. F1 provides a documented placeholder, not a runnable MCP server. Do not deploy or report MCP compatibility before F2/F3.

## F2 audit follow-up — 2026-10-09
- The initial F2 branch was audited against the repository tree and official `mcp-handler`, MCP SDK, and Next.js documentation.
- The MCP app now has its own lockfile, fixed manifest-backed catalog loading, closed tool identifiers, bearer-token rejection tests, and a local end-to-end smoke test.
- The F0 Blueprint file referenced by the plan is absent from the repository; no missing decisions were invented.
- The Core envelope mismatch, unauthenticated DELETE rejection path, and missing direct projectos.plan coverage were corrected in commit `febb060`. Local tests, CI, preview deployment, preview secret configuration, and remote endpoint validation for the correction are verified. F2 remains under Orchestrator review; production deployment remains out of scope.

## Follow-up
- Review PR #2 and decide whether to merge it; keep production deployment disabled.
- Decide whether to approve merge of PR #2; keep production deployment disabled.
- Keep the pilot token limitation explicit until an OAuth/per-user authorization design is approved.
- Schedule rate limiting, full YAML parsing, and Actions SHA pinning as later hardening work if production exposure is approved.
- Prepare F3 client-compatibility work without starting it automatically.
