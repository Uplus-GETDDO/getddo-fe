// 로컬 검증용 정적+API 프록시 — Vercel rewrites(/api/*→CloudFront)와 같은 역할을 한다.
// dist/를 정적 서빙하고 /api/* 를 실서버로 전달하며 Origin·Host·Referer를 제거한다
// (배포 프록시와 같은 조건으로 CORS preflight가 발생하지 않는다).
// 실행: node scripts/serveLocalRealApi.mjs [port]  — 기본 포트 5196.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const API_TARGET = 'https://dzc8oneey9mmx.cloudfront.net';
const PORT = Number(process.argv[2] ?? 5196);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
};

// hop-by-hop 헤더와 Connection이 지명한 헤더를 제거한다 — undici fetch는
// transfer-encoding 같은 hop-by-hop 전달을 거부해 요청이 실패한다.
const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);
const stripHopByHop = (headers, connectionValue) => {
    const named = (connectionValue ?? '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    const drop = new Set([...HOP_BY_HOP, ...named]);
    return Object.fromEntries(Object.entries(headers).filter(([k]) => !drop.has(k)));
};

async function handle(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        // Origin·Referer·Host를 빼고 전달 — 브라우저 직접 호출과 달리 same-origin 프록시다.
        const headers = stripHopByHop({ ...req.headers }, req.headers.connection);
        delete headers.origin;
        delete headers.referer;
        delete headers.host;
        const body = ['GET', 'HEAD'].includes(req.method ?? 'GET')
            ? undefined
            : await new Promise((resolve) => {
                  const chunks = [];
                  req.on('data', (c) => chunks.push(c));
                  req.on('end', () => resolve(Buffer.concat(chunks)));
              });
        const upstream = await fetch(API_TARGET + url.pathname + url.search, {
            method: req.method,
            headers,
            body,
            redirect: 'manual',
        });
        // undici가 본문을 해제·디코딩했으므로 content-length·content-encoding은 재계산에 맡긴다.
        const resHeaders = stripHopByHop(
            Object.fromEntries(upstream.headers.entries()),
            upstream.headers.get('connection'),
        );
        delete resHeaders['content-length'];
        delete resHeaders['content-encoding'];
        res.writeHead(upstream.status, resHeaders);
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
    }

    // SPA — 파일이 있으면 서빙하고 없으면 index.html로 돌아간다.
    const file = path.join(DIST, decodeURIComponent(url.pathname));
    const target =
        file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()
            ? file
            : path.join(DIST, 'index.html');
    res.writeHead(200, {
        'content-type': MIME[path.extname(target)] ?? 'application/octet-stream',
    });
    res.end(fs.readFileSync(target));
}

const server = http.createServer((req, res) => {
    // 어느 단계의 실패든 서버를 죽이지 않고 응답으로 돌려준다.
    handle(req, res).catch((error) => {
        console.error('preview request failed:', error);
        if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        }
        res.end('preview proxy error');
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`local real-api preview: http://localhost:${PORT} (api → ${API_TARGET})`);
});
