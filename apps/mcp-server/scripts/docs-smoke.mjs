import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const port = 3600 + Math.floor(Math.random() * 200);
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const server = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
  env: {...process.env, PROJECTOS_MCP_TOKEN: 'docs-smoke-token-01234567890123456789'},
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
  for (const id of ['projectos\.discover', 'projectos\.plan', 'projectos\.start']) assert.match(html, new RegExp(id));
  for (const tool of ['projectos_list_skills', 'projectos_get_skill', 'projectos_start_workflow']) assert.match(html, new RegExp(tool));
  for (const anchor of ['intro', 'install', 'auth', 'catalog', 'workflows', 'first-use', 'security', 'faq']) assert.match(html, new RegExp(`id="${anchor}"`));
  assert.match(html, /INTERNO/);
  assert.match(html, /BACKLOG FUTURO/);
  assert.match(html, /aria-label="Copiar exemplo"/);
  assert.doesNotMatch(html, /ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+/i);
  console.log('Documentation smoke tests passed');
} finally {
  server.kill();
}
