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

async function mcp(method, params, authorization = token) {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-06-18',
  };
  if (authorization !== null) headers.Authorization = `Bearer ${authorization}`;
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers,
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  return {response, body: await jsonResponse(response)};
}

try {
  await waitForHealth();
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {service: 'projectos-mcp', status: 'ok', version: '0.2.0'});

  const denied = await mcp('initialize', {}, null);
  assert.equal(denied.response.status, 401);

  const initialized = await mcp('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: {name: 'projectos-smoke', version: '0.1.0'},
  });
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.body.result.serverInfo.name, 'ProjectOS MCP');

  const tools = await mcp('tools/list', {});
  assert.equal(tools.response.status, 200);
  assert.deepEqual(tools.body.result.tools.map(tool => tool.name).sort(), ['projectos.get_skill', 'projectos.list_skills']);

  const listed = await mcp('tools/call', {name: 'projectos.list_skills', arguments: {}});
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.result.structuredContent.skills.length, 2);

  const skill = await mcp('tools/call', {name: 'projectos.get_skill', arguments: {id: 'projectos.discover'}});
  assert.equal(skill.response.status, 200);
  assert.equal(skill.body.result.structuredContent.skill.id, 'projectos.discover');
  assert.match(skill.body.result.structuredContent.skill.instructions, /authorized client/i);

  const invalid = await mcp('tools/call', {name: 'projectos.get_skill', arguments: {id: '../../package.json'}});
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
