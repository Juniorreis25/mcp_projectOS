import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const token = 'catalog-cwd-smoke-token-01234567890123456789';

async function waitForHealth(port, server, logs) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    if (server.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`server did not start: ${logs.value.slice(-1200)}`);
}

async function listSkills(port) {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-06-18',
    Authorization: `Bearer ${token}`,
  };
  const initialize = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'catalog-cwd-smoke', version: '0.1.0'}}}),
  });
  const initializeText = await initialize.text();
  if (initialize.status !== 200) return {response: initialize, initializeText};
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'projectos_list_skills', arguments: {}}}),
  });
  const text = await response.text();
  const dataLine = text.split('\n').find(line => line.startsWith('data:'));
  return {response, body: JSON.parse(dataLine ? dataLine.slice(5).trim() : text)};
}

async function stop(server) {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await new Promise(resolve => {
    server.once('exit', resolve);
    setTimeout(resolve, 1000);
  });
}

async function startServer(cwd, directory) {
  const port = 3900 + Math.floor(Math.random() * 200);
  const logs = {value: ''};
  const server = spawn(process.execPath, [nextBin, 'start', directory, '--port', String(port)], {
    cwd,
    env: {...process.env, PROJECTOS_MCP_TOKEN: token, NEXT_TELEMETRY_DISABLED: '1'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { logs.value += chunk.toString(); });
  server.stderr.on('data', chunk => { logs.value += chunk.toString(); });
  await waitForHealth(port, server, logs);
  return {port, server, logs};
}

const rootRun = await startServer(repoRoot, 'apps/mcp-server');
try {
  try {
    const listed = await listSkills(rootRun.port);
    assert.equal(listed.response.status, 200);
    assert.deepEqual(listed.body.result.structuredContent.data.skills.map(skill => skill.id).sort(), ['projectos.discover', 'projectos.plan', 'projectos.start']);
  } catch (error) {
    throw new Error(`${error.message}\n${rootRun.logs.value.slice(-2000)}`);
  }
} finally {
  await stop(rootRun.server);
}

const emptyCwd = await mkdtemp(join(tmpdir(), 'projectos-catalog-cwd-'));
try {
  const missingRun = await startServer(emptyCwd, appDir);
  try {
    const listed = await listSkills(missingRun.port);
    assert.notEqual(listed.response.status, 200);
    assert.match(`${missingRun.logs.value}\n${listed.initializeText}`, /catalog resources unavailable/i);
  } finally {
    await stop(missingRun.server);
  }
} finally {
  await rm(emptyCwd, {recursive: true, force: true});
}

console.log('Catalog cwd and missing-resource smoke tests passed');
