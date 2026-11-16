// Local run only: node dev-server.js  ->  http://localhost:3000
// On Vercel this file is not used. It copies how Vercel serves /public and /api.
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (d) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(d)); };
  if (u.pathname.startsWith('/api/')) {
    const file = path.join(__dirname, 'api', u.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '') + '.js');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      req.query = Object.fromEntries(u.searchParams);
      try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
      try { await require(file)(req, res); } catch (e) { res.status(500).json({ error: e.message }); }
    });
    return;
  }
  let p = u.pathname === '/' ? '/index.html' : u.pathname.replace(/\/+$/, '');
  if (!path.extname(p)) p += '.html';
  const file = path.join(__dirname, 'public', path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('FrontDesk AI running on http://localhost:' + PORT));
