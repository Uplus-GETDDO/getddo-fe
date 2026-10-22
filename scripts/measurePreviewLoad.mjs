// vite preview의 SPA fallback HTML 수신 시각 표본 — Node fetch, loopback.
// 실행: node scripts/measurePreviewLoad.mjs --preview=http://127.0.0.1:6277 --out=<raw.json> [--warm=10]
// 측정 대상은 index.html(TTFB+본문)이며 화면 완성 시간이 아니다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const args = Object.fromEntries(
    process.argv.slice(2).map((value) => value.replace(/^--/, '').split('=')),
);
const preview = (args.preview ?? 'http://127.0.0.1:6277').replace(/\/$/, '');
const outPath = args.out;
assert.ok(outPath, '--out <raw.json> 경로가 필요합니다');
const warmCount = Number(args.warm ?? 10);
const routes = ['/', '/login', '/events/evt-001', '/missions', '/missions/games/takko-timing'];

const metric = (value, unit, method) => ({ value, unit, method });
const runs = [];

for (const route of routes) {
    const samples = [
        { cache: 'cold' },
        ...Array.from({ length: warmCount }, () => ({ cache: 'warm' })),
    ];
    for (const [index, sample] of samples.entries()) {
        const started = performance.now();
        try {
            const response = await fetch(`${preview}${route}`);
            const body = await response.arrayBuffer();
            const elapsed = performance.now() - started;
            runs.push({
                scenario: `load-preview-${route}`,
                sampleIndex: sample.cache === 'cold' ? 0 : index - 1,
                status: response.ok ? 'ok' : 'failed',
                cache: sample.cache,
                metrics: {
                    ttfbPlusBodyMs: metric(
                        elapsed,
                        'ms',
                        `vite preview + Node fetch 왕복 (loopback, ${sample.cache})`,
                    ),
                    htmlBytes: metric(body.byteLength, 'byte', 'res.arrayBuffer().byteLength'),
                    httpStatus: metric(response.status, 'code', 'response.status'),
                },
                error: response.ok ? undefined : `HTTP ${response.status}`,
            });
        } catch (error) {
            runs.push({
                scenario: `load-preview-${route}`,
                sampleIndex: index,
                status: 'failed',
                cache: sample.cache,
                error: String(error?.message ?? error).slice(0, 200),
                metrics: {},
            });
        }
    }
}

const result = {
    collectedAt: new Date().toISOString(),
    collector: 'scripts/measurePreviewLoad.mjs',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version,
    preview,
    runs,
};
mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(`완료 — ${runs.length} runs → ${outPath}\n`);
