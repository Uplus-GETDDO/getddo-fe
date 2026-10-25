// GD-340 — vite build 산출물의 초기 로드 버짓 검사. 위반 시 exit 1.
// 사용: node scripts/checkBundleBudget.mjs [distDir=dist] [budgetPath=perf-budget.json]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectInitial, measureAssets } from './lib/bundleGraph.mjs';

export function evaluateBudget(metrics, budget) {
    const checks = [
        ['initialJsGzip', metrics.initialJsGzip, budget.initialJsGzipBytes],
        ['initialCssGzip', metrics.initialCssGzip, budget.initialCssGzipBytes],
    ];
    const violations = checks
        .filter(([, actual, limit]) => actual > limit)
        .map(([key, actual, limit]) => ({ key, actual, limit }));
    return { violations, ok: violations.length === 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const root = resolve(process.argv[2] ?? 'dist');
    const budget = JSON.parse(readFileSync(resolve(process.argv[3] ?? 'perf-budget.json'), 'utf8'));
    const initial = collectInitial(root);
    const files = measureAssets(root, initial);
    const sum = (pred) => files.filter(pred).reduce((t, f) => t + f.gzip, 0);
    const metrics = {
        initialJsGzip: sum((f) => f.initial && f.file.endsWith('.js')),
        initialCssGzip: sum((f) => f.initial && f.file.endsWith('.css')),
    };
    const { violations, ok } = evaluateBudget(metrics, budget);
    const fmt = (n) => `${n} B (${(n / 1024).toFixed(1)} KiB)`;
    if (!ok) {
        for (const v of violations) {
            process.stderr.write(
                `[perf-budget] ${v.key} 초과: ${fmt(v.actual)} > ${fmt(v.limit)}\n`,
            );
        }
        process.exit(1);
    }
    process.stdout.write(
        `[perf-budget] 통과 — initialJsGzip ${fmt(metrics.initialJsGzip)}, initialCssGzip ${fmt(metrics.initialCssGzip)}\n`,
    );
}
