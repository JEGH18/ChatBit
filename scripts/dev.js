// Servidor local sin dependencias: sirve /public y enruta /api/chat a la función de Vercel.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import handler from '../api/chat.js';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = join(process.cwd(), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/chat') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = null; }
    return handler(req, res);
  }
  const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}).listen(PORT, () => {
  console.log(`Asistente Neocrédito en http://localhost:${PORT} (${process.env.ANTHROPIC_API_KEY ? 'con IA' : 'modo guiado'})`);
});
