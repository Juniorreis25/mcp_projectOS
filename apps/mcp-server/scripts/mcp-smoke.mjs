import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const port = 3210 + Math.floor(Math.random() * 300);
const token = 'projectos-local-smoke-token-01234567890123456789';
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const server = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
  env: {...process.env, PROJECTOS_MCP_TOKEN: token},
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
server.stdout.on('data', chunk => { logs += chunk.toString(); });
server.stderr.on('data', chunk => { logs += chunk.toString(); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`server did not start\n${logs}`);
}

async function jsonResponse(response) {
  const body = await response.text();
  const dataLine = body.split('\n').find(line => line.startsWith('data:'));
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : body);
}

function assertEnvelope(value, expectedStatus = 'ok', expectedEvidence = [], expectedApprovals = [], requireNextActions = false) {
  assert.deepEqual(Object.keys(value).sort(), [
    'data', 'evidence_refs', 'next_actions', 'request_id', 'required_approvals', 'schema_version', 'status', 'warnings',
  ].sort());
  assert.equal(value.schema_version, '1.0');
  assert.equal(value.status, expectedStatus);
  assert.match(value.request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(value.warnings, []);
  assert.deepEqual(value.evidence_refs, expectedEvidence);
  assert.deepEqual(value.required_approvals, expectedApprovals);
  if (requireNextActions) assert.ok(value.next_actions.length > 0);
  else assert.deepEqual(value.next_actions, []);
}

async function mcp(method, params, authorization = token, scheme = 'Bearer') {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-06-18',
  };
  if (authorization !== null) headers.Authorization = `${scheme} ${authorization}`;
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers,
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  return {response, body: await jsonResponse(response)};
}

async function httpMethod(method, authorization = token) {
  const headers = {};
  if (authorization !== null) headers.Authorization = `Bearer ${authorization}`;
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {method, headers});
  return {response, body: await response.text()};
}

try {
  await waitForHealth();
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {service: 'projectos-mcp', status: 'ok', version: '0.2.0'});

  const denied = await mcp('initialize', {}, null);
  assert.equal(denied.response.status, 401);
  assert.deepEqual(denied.body.error, {code: 'UNAUTHORIZED', message: 'Authentication required'});

  const deniedDelete = await httpMethod('DELETE', null);
  assert.equal(deniedDelete.response.status, 401);

  const allowedDelete = await httpMethod('DELETE');
  assert.equal(allowedDelete.response.status, 405);
  assert.equal(allowedDelete.response.headers.get('allow'), 'GET, POST');

  const initialized = await mcp('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: {name: 'projectos-smoke', version: '0.1.0'},
  });
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.body.result.serverInfo.name, 'ProjectOS MCP');

  const normalizedBearer = await mcp('tools/list', {}, token, 'bEaReR');
  assert.equal(normalizedBearer.response.status, 200);

  const tools = await mcp('tools/list', {});
  assert.equal(tools.response.status, 200);
  assert.deepEqual(tools.body.result.tools.map(tool => tool.name).sort(), ['projectos_get_skill', 'projectos_list_skills', 'projectos_start_workflow']);
  for (const tool of tools.body.result.tools) assert.match(tool.name, /^[a-z0-9_-]+$/);
  for (const tool of tools.body.result.tools) {
    assert.ok(tool.annotations, `missing annotations for ${tool.name}: ${JSON.stringify(tool)}`);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
  }

  const listed = await mcp('tools/call', {name: 'projectos_list_skills', arguments: {}});
  assert.equal(listed.response.status, 200);
  const listedEnvelope = listed.body.result.structuredContent;
  assertEnvelope(listedEnvelope);
  assert.equal(listedEnvelope.data.skills.length, 3);
  assert.deepEqual(listedEnvelope.data.skills.map(skill => skill.id).sort(), ['projectos.discover', 'projectos.plan', 'projectos.start']);
  assert.equal(listed.body.result.content[0].text, JSON.stringify(listedEnvelope));

  const skill = await mcp('tools/call', {name: 'projectos_get_skill', arguments: {id: 'projectos.discover'}});
  assert.equal(skill.response.status, 200);
  const discoverEnvelope = skill.body.result.structuredContent;
  assertEnvelope(discoverEnvelope);
  assert.equal(discoverEnvelope.data.skill.id, 'projectos.discover');
  assert.equal(discoverEnvelope.data.skill.version, '0.1.0');
  assert.equal(discoverEnvelope.data.skill.title, 'Descoberta de projeto');
  assert.match(discoverEnvelope.data.skill.instructions, /authorized client/i);
  assert.deepEqual(discoverEnvelope.data.skill.resources, ['manifest.yaml', 'SKILL.md']);
  assert.equal(skill.body.result.content[0].text, JSON.stringify(discoverEnvelope));
  assert.notEqual(listedEnvelope.request_id, discoverEnvelope.request_id);

  const plan = await mcp('tools/call', {name: 'projectos_get_skill', arguments: {id: 'projectos.plan'}});
  assert.equal(plan.response.status, 200);
  const planEnvelope = plan.body.result.structuredContent;
  assertEnvelope(planEnvelope);
  assert.equal(planEnvelope.data.skill.id, 'projectos.plan');
  assert.equal(planEnvelope.data.skill.version, '0.1.0');
  assert.equal(planEnvelope.data.skill.title, 'Planejamento incremental');
  assert.match(planEnvelope.data.skill.instructions, /incremental tasks|dependencies|evidence/i);
  assert.deepEqual(planEnvelope.data.skill.resources, ['manifest.yaml', 'SKILL.md']);

  const startSkill = await mcp('tools/call', {name: 'projectos_get_skill', arguments: {id: 'projectos.start'}});
  assert.equal(startSkill.response.status, 200);
  const startSkillEnvelope = startSkill.body.result.structuredContent;
  assertEnvelope(startSkillEnvelope);
  assert.equal(startSkillEnvelope.data.skill.id, 'projectos.start');
  assert.equal(startSkillEnvelope.data.skill.version, '0.1.0');
  assert.deepEqual(startSkillEnvelope.data.skill.modes, ['new', 'existing', 'recovery']);
  assert.match(startSkillEnvelope.data.skill.instructions, /needs_input|read-only|evidence/i);

  const start = await mcp('tools/call', {
    name: 'projectos_start_workflow',
    arguments: {
      project_id: 'smoke-project',
      goal: 'Validate the universal flow',
      evidence: [{ref: 'smoke:brief', summary: 'Authorized smoke-test evidence'}],
    },
  });
  assert.equal(start.response.status, 200);
  const startEnvelope = start.body.result.structuredContent;
  assertEnvelope(startEnvelope, 'ok', ['smoke:brief'], [], true);
  assert.equal(startEnvelope.data.mode, 'new');
  assert.equal(startEnvelope.data.state, 'planned');
  assert.equal(startEnvelope.data.project_id, 'smoke-project');
  assert.notEqual(planEnvelope.request_id, startEnvelope.request_id);

  const blocked = await mcp('tools/call', {
    name: 'projectos_start_workflow',
    arguments: {
      project_id: 'smoke-project',
      goal: 'Attempt a protected action',
      requested_operations: ['deploy production'],
      evidence: [{ref: 'smoke:approval', summary: 'Authorized client evidence'}],
    },
  });
  assert.equal(blocked.response.status, 200);
  assertEnvelope(blocked.body.result.structuredContent, 'blocked', ['smoke:approval'], ['human:approve:deploy production'], true);
  assert.equal(blocked.body.result.structuredContent.data.state, 'blocked');

  const invalid = await mcp('tools/call', {name: 'projectos_get_skill', arguments: {id: '../../package.json'}});
  assert.equal(invalid.response.status, 200);
  assert.equal(invalid.body.result.isError, true);
  assert.match(invalid.body.result.content[0].text, /Invalid arguments/);
} finally {
  await new Promise(resolve => {
    if (server.exitCode !== null) {
      resolve();
      return;
    }
    server.once('exit', resolve);
    server.kill('SIGTERM');
    setTimeout(resolve, 1000);
  });
}

console.log('MCP smoke tests passed');
