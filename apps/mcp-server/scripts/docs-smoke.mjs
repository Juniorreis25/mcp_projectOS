import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const port = 3600 + Math.floor(Math.random() * 200);
const token = 'docs-smoke-token-01234567890123456789';
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const server = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
  env: {...process.env, PROJECTOS_MCP_TOKEN: token},
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not start: ${output.slice(-1000)}`);
}

async function jsonResponse(response) {
  const body = await response.text();
  const dataLine = body.split('\n').find(line => line.startsWith('data:'));
  return JSON.parse(dataLine ? dataLine.slice(5).trim() : body);
}

async function mcp(method, params) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  return {response, body: await jsonResponse(response)};
}

function decodeHtml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

try {
  await waitForServer();
  const response = await fetch(`http://127.0.0.1:${port}/docs`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.match(html, /Documentação e onboarding/);
  assert.match(html, /Core Envelope 1\.0/);
  assert.match(html, /PROJECTOS_MCP_TOKEN/);
  assert.match(html, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  const codeBlocks = [...html.matchAll(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)].map(match => decodeHtml(match[1]));
  const vsCodeConfig = codeBlocks.find(block => block.includes('projectos-token'));
  assert.ok(vsCodeConfig, 'VS Code configuration example is missing');
  const parsedVsCodeConfig = JSON.parse(vsCodeConfig);
  assert.deepEqual(Object.keys(parsedVsCodeConfig).sort(), ['inputs', 'servers']);
  assert.equal(parsedVsCodeConfig.servers.projectos.type, 'http');
  assert.equal(parsedVsCodeConfig.servers.projectos.url, 'https://<preview>/mcp');
  assert.equal(parsedVsCodeConfig.servers.projectos.headers.Authorization, 'Bearer ${input:projectos-token}');
  assert.equal(parsedVsCodeConfig.servers.projectos.headers['x-vercel-protection-bypass'], '${input:vercel-bypass}');
  assert.equal(parsedVsCodeConfig.inputs.length, 2);
  assert.ok(parsedVsCodeConfig.inputs.every(input => input.password === true));
  const listExample = codeBlocks.find(block => block.trim() === '{ }');
  const getExample = codeBlocks.find(block => block.includes('"id": "projectos.discover"'));
  const startExample = codeBlocks.find(block => block.includes('"requested_mode": "new"'));
  assert.deepEqual(JSON.parse(listExample), {});
  assert.equal(JSON.parse(getExample).id, 'projectos.discover');
  assert.equal(JSON.parse(startExample).requested_mode, 'new');
  for (const id of ['projectos\.discover', 'projectos\.plan', 'projectos\.start']) assert.match(html, new RegExp(id));
  for (const tool of ['projectos_list_skills', 'projectos_get_skill', 'projectos_start_workflow']) assert.match(html, new RegExp(tool));
  assert.ok((html.match(/PUBLICADA · v/g) ?? []).length >= 3);
  for (const capability of ['spec', 'build', 'review', 'test', 'debug', 'protect', 'idea', 'release', 'memory', 'status', 'audit']) assert.match(html, new RegExp(`>${capability}<`));
  for (const anchor of ['intro', 'install', 'auth', 'catalog', 'workflows', 'first-use', 'security', 'faq']) assert.match(html, new RegExp(`id="${anchor}"`));
  assert.match(html, /INTERNO/);
  assert.match(html, /BACKLOG FUTURO/);
  assert.match(html, /aria-label="Copiar exemplo"/);
  assert.doesNotMatch(html, /ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+/i);

  const listed = await mcp('tools/list', {});
  assert.equal(listed.response.status, 200);
  assert.deepEqual(listed.body.result.tools.map(tool => tool.name).sort(), ['projectos_get_skill', 'projectos_list_skills', 'projectos_start_workflow']);
  const skills = await mcp('tools/call', {name: 'projectos_list_skills', arguments: {}});
  assert.equal(skills.response.status, 200);
  assert.deepEqual(skills.body.result.structuredContent.data.skills.map(skill => skill.id).sort(), ['projectos.discover', 'projectos.plan', 'projectos.start']);
  for (const id of ['projectos.discover', 'projectos.plan', 'projectos.start']) {
    const skill = await mcp('tools/call', {name: 'projectos_get_skill', arguments: {id}});
    assert.equal(skill.body.result.structuredContent.data.skill.version, '0.1.0');
  }
  const workflowArguments = JSON.parse(startExample);
  workflowArguments.project_id = 'docs-smoke-project';
  workflowArguments.evidence[0].ref = 'docs-smoke:brief-001';
  const workflow = await mcp('tools/call', {name: 'projectos_start_workflow', arguments: workflowArguments});
  assert.equal(workflow.response.status, 200);
  assert.equal(workflow.body.result.structuredContent.status, 'ok');
  assert.equal(workflow.body.result.structuredContent.data.mode, 'new');
  assert.equal(workflow.body.result.structuredContent.data.state, 'planned');
  console.log('Documentation smoke tests passed');
} finally {
  server.kill();
}
