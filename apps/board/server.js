import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

async function serveBoard(boardPath, res) {
  let body;
  try {
    body = await readFile(boardPath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    body = JSON.stringify({ version: 1, repos: {} });
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(body);
}

async function serveConfig(configPath, res) {
  const repos = {};
  if (configPath) {
    try {
      const parsed = JSON.parse(await readFile(configPath, 'utf8'));
      for (const r of parsed.repos ?? []) {
        if (r?.name) repos[r.name] = { url: r.url, technologies: r.technologies ?? [], targets: r.targets ?? [] };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ repos }));
}

async function serveStatic(distDir, pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.join(distDir, rel);
  if (!file.startsWith(path.resolve(distDir))) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // SPA fallback: serve index.html for unknown routes
    const index = await readFile(path.join(distDir, 'index.html')).catch(() => null);
    if (index) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(index); }
    else { res.writeHead(404); res.end('not found'); }
  }
}

export function createBoardServer({ boardPath, distDir, configPath = null }) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/board') return await serveBoard(boardPath, res);
      if (url.pathname === '/api/config') return await serveConfig(configPath, res);
      return await serveStatic(distDir, url.pathname, res);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(err.message));
    }
  });
}

export function startFromArgv(argv, { log = console.log } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      board: { type: 'string' }, port: { type: 'string', default: '4180' },
      dist: { type: 'string' }, config: { type: 'string' },
    },
  });
  const boardPath = path.resolve(values.board ?? process.env.AI_SYNC_BOARD ?? 'board.json');
  const configSrc = values.config ?? process.env.AI_SYNC_CONFIG ?? null;
  const configPath = configSrc ? path.resolve(configSrc) : null;
  const distDir = values.dist ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
  const server = createBoardServer({ boardPath, distDir, configPath });

  // Like the Angular CLI: if the port is taken, fall back to the next one.
  const maxAttempts = 10;
  let port = Number(values.port);
  let attempts = 1;
  server.on('listening', () => log(`board on http://localhost:${port} (data: ${boardPath})`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts++ < maxAttempts) {
      log(`Port ${port} is already in use, trying ${port + 1}...`);
      port += 1;
      setTimeout(() => server.listen(port), 50);
    } else {
      throw err;
    }
  });
  server.listen(port);
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startFromArgv(process.argv.slice(2));
}
