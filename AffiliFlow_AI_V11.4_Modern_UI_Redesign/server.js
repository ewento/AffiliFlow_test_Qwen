// Local dev server for AffiliFlow AI (Zero external dependencies)
// Serves static files AND executes the /.netlify/functions/ai endpoint locally.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Dynamically import the Netlify Function ES Module
let aiHandler;
(async () => {
  try {
    const mod = await import('./netlify/functions/ai.js');
    aiHandler = mod.default;
  } catch (e) {
    console.warn('Failed to import netlify/functions/ai.js:', e.message);
  }
})();

const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost:' + PORT;
  const url = new URL(req.url, 'http://' + host);

  // Route: Netlify serverless function endpoint
  if (url.pathname === '/.netlify/functions/ai' || url.pathname === '/api/ai') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf-8');

      if (!aiHandler) {
        // Wait a brief moment if module is still importing
        const mod = await import('./netlify/functions/ai.js');
        aiHandler = mod.default;
      }

      const fullUrl = 'http://localhost:' + PORT + url.pathname;
      const webReq = new Request(fullUrl, {
        method: 'POST',
        headers: req.headers,
        body: rawBody
      });

      const webRes = await aiHandler(webReq);
      const resBody = await webRes.text();

      res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
      res.end(resBody);
    } catch (err) {
      console.error('AI Function Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
    return;
  }

  // Route: Static files
  let safePath = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';
  const filePath = path.join(__dirname, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('🚀 AffiliFlow AI Dev Server sedang berjalan:');
  console.log('   👉 Local:    http://localhost:' + PORT);
  console.log('   👉 Endpoint: http://localhost:' + PORT + '/.netlify/functions/ai');
  console.log('');
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️  PERINGATAN: GEMINI_API_KEY belum ditetapkan!');
    console.log('   Sila tetapkan: export GEMINI_API_KEY="kunci_api_anda" sebelum menjalankan pelayan.');
    console.log('');
  } else {
    console.log('✅ GEMINI_API_KEY dikesan. Sedia untuk menjana kit!');
    console.log('');
  }
});
