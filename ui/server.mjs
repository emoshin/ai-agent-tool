import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, 'dist');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const API_BASE_URL = new URL(process.env.API_BASE_URL || 'http://localhost:8080');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.svg',
  '.txt',
]);

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function proxyApiRequest(req, res) {
  const upstreamPath =
    API_BASE_URL.pathname.replace(/\/$/, '') + (req.url || '/');
  const isHttps = API_BASE_URL.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers = { ...req.headers };
  headers.host = API_BASE_URL.host;
  headers['x-forwarded-host'] = req.headers.host || '';
  headers['x-forwarded-proto'] = 'http';

  const proxyReq = transport.request(
    {
      protocol: API_BASE_URL.protocol,
      hostname: API_BASE_URL.hostname,
      port: API_BASE_URL.port || (isHttps ? 443 : 80),
      method: req.method,
      path: upstreamPath,
      headers,
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 502;
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      }
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          status: 502,
          error: 'Bad Gateway',
          message: `Failed to reach backend API at ${API_BASE_URL.origin}: ${err.message}`,
        })
      );
    } else {
      res.destroy(err);
    }
  });

  req.on('aborted', () => {
    proxyReq.destroy();
  });

  req.pipe(proxyReq);
}

async function serveStatic(req, res) {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  if (pathname === '/healthz') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const candidatePath = path.resolve(DIST_DIR, `.${pathname}`);
  const isInsideDist =
    candidatePath === DIST_DIR || candidatePath.startsWith(`${DIST_DIR}${path.sep}`);

  let filePath = isInsideDist ? candidatePath : path.join(DIST_DIR, 'index.html');

  let stat = await fsp.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    // SPA fallback for client routes
    filePath = path.join(DIST_DIR, 'index.html');
    stat = await fsp.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Production bundle not found. Run "npm run build" first.');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isHashedAsset = filePath.startsWith(path.join(DIST_DIR, 'assets') + path.sep);

  setSecurityHeaders(res);
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Cache-Control',
    isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
  );

  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const shouldGzip =
    COMPRESSIBLE_EXTENSIONS.has(ext) && /\bgzip\b/i.test(acceptEncoding);

  res.statusCode = 200;
  const readStream = fs.createReadStream(filePath);
  if (shouldGzip) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    readStream.pipe(zlib.createGzip()).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    readStream.pipe(res);
  }
}

export function createUiServer() {
  return http.createServer((req, res) => {
    const urlPath = req.url || '/';
    if (urlPath === '/api' || urlPath.startsWith('/api/')) {
      proxyApiRequest(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Method Not Allowed');
      return;
    }

    serveStatic(req, res).catch((err) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`Internal Server Error: ${err.message}`);
      }
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(
      `[ai-agent-tool-ui] Missing production build at ${DIST_DIR}. Run "npm run build" first.`
    );
    process.exit(1);
  }

  const server = createUiServer();
  server.listen(PORT, HOST, () => {
    console.log(
      `[ai-agent-tool-ui] Production server listening on http://${HOST}:${PORT} (API proxy -> ${API_BASE_URL.origin})`
    );
  });
}
