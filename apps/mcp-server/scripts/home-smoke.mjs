import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const port = 3800 + Math.floor(Math.random() * 150);
const token = 'home-smoke-token-01234567890123456789';
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const server = spawn(process.execPath, [nextBin, 'start', '--port', String(port)], {
  env: {...process.env, PROJECTOS_MCP_TOKEN: token},
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });

try {
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(healthy, true, `Next server did not start: ${output.slice(-1000)}`);

  const home = await fetch(`http://127.0.0.1:${port}/`);
  const html = await home.text();
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type') ?? '', /text\/html/);
  assert.match(html, /Contexto claro/);
  assert.match(html, /projectos_list_skills/);
  assert.match(html, /projectos\.discover/);
  assert.match(html, /new/);
  assert.match(html, /href="\/docs"/);
  assert.match(html, /Sem execução remota/);
  assert.doesNotMatch(html, /ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+/i);

  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {service: 'projectos-mcp', status: 'ok', version: '0.2.0'});
  console.log('Home smoke tests passed');
} finally {
  server.kill();
}
