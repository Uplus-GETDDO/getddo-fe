// 프론트엔드 정량 검증 — 저장된 측정값 집계·번들 바이트 수집·비교 가능성 검사.
// 실행: node scripts/measureFrontendEvidence.mjs <모드>
//   bytes <distDir>            — 빌드 산출물의 raw·gzip 바이트를 run 레코드로 출력.
//                                index.html이 참조하는 청크는 'entry', 나머지는 'lazy-or-asset'으로 분류한다.
//   summarize <file.json>      — baseline.json 형식의 runs를 시나리오별로 집계한다
//                                (중간값·p95·최소·최대·IQR·실패 수·표본 수).
//   compare <baseline> <after> — 두 파일의 condition이 통제 항목에서 일치하는지 검사하고,
//                                일치하는 시나리오만 개선율을 산출한다. 다르면 not-comparable.
// Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

// ── 집계 순수 함수 (docs/superpowers/plans/2026-10-21-frontend-evidence-and-optimization.md §5의 계약과 동등) ──
export function p95(samples) {
    if (!samples.length || samples.some((x) => !Number.isFinite(x))) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.95) - 1];
}
export function reductionPercent(before, after) {
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return null;
    return ((before - after) / before) * 100;
}

const quantile = (sorted, q) => {
    if (!sorted.length) return null;
    return sorted[Math.ceil(sorted.length * q) - 1];
};

/** 중간값·p95·최소·최대·IQR·실패 수·표본 수 — 실패·결측 표본도 samples에 포함하고 유효 수치만 집계한다. */
export function summarizeRuns(runs) {
    const byScenario = new Map();
    for (const run of runs) {
        const bucket = byScenario.get(run.scenario) ?? { runs: [], failed: 0 };
        bucket.runs.push(run);
        if (run.status !== 'ok') bucket.failed += 1;
        byScenario.set(run.scenario, bucket);
    }
    const scenarios = {};
    for (const [scenario, bucket] of byScenario) {
        const metrics = {};
        const names = new Set(bucket.runs.flatMap((run) => Object.keys(run.metrics ?? {})));
        for (const name of names) {
            const entries = bucket.runs
                .map((run) => run.metrics?.[name])
                .filter((m) => m && m.value !== null && m.value !== undefined);
            const values = entries.map((m) => m.value).filter((v) => Number.isFinite(v));
            const sorted = [...values].sort((a, b) => a - b);
            metrics[name] = {
                unit: entries[0]?.unit ?? null,
                n: sorted.length,
                missing: bucket.runs.length - entries.length,
                min: sorted[0] ?? null,
                max: sorted[sorted.length - 1] ?? null,
                median: quantile(sorted, 0.5),
                p95: p95(values),
                iqr: sorted.length >= 2 ? quantile(sorted, 0.75) - quantile(sorted, 0.25) : null,
                // n<=10의 p95는 사실상 극단값 — 탐색적 수치로만 취급한다
                exploratory: sorted.length <= 10,
            };
        }
        scenarios[scenario] = { samples: bucket.runs.length, failed: bucket.failed, metrics };
    }
    return scenarios;
}

// runId·시각처럼 실행마다 바뀌는 항목은 비교 대상이 아니다 — 환경·fixture·cache만 대조한다.
const VOLATILE_CONDITION_KEYS = new Set([
    'runId',
    'capturedAt',
    'startedAt',
    'finishedAt',
    'buildStartedAt',
    'buildFinishedAt',
]);

const stripVolatile = (condition) =>
    Object.fromEntries(
        Object.entries(condition ?? {}).filter(([key]) => !VOLATILE_CONDITION_KEYS.has(key)),
    );

const deepEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 두 파일의 통제 조건이 다른 키 목록 — 비어 있으면 비교 가능하다. */
export function conditionDiff(beforeCondition, afterCondition) {
    const a = stripVolatile(beforeCondition);
    const b = stripVolatile(afterCondition);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
        (key) => !deepEqual(a[key], b[key]),
    );
}

/** 같은 시나리오·메트릭의 대표값(중간값)으로 개선율을 계산한다. 조건이 다르면 not-comparable. */
export function compareFiles(before, after) {
    const diff = conditionDiff(before.condition, after.condition);
    const beforeScenarios = summarizeRuns(before.runs ?? []);
    const afterScenarios = summarizeRuns(after.runs ?? []);
    if (diff.length) {
        return {
            comparable: false,
            status: 'not-comparable',
            conditionDiff: diff,
            before: beforeScenarios,
            after: afterScenarios,
        };
    }
    const scenarios = {};
    for (const scenario of new Set([
        ...Object.keys(beforeScenarios),
        ...Object.keys(afterScenarios),
    ])) {
        const metrics = {};
        const names = new Set([
            ...Object.keys(beforeScenarios[scenario]?.metrics ?? {}),
            ...Object.keys(afterScenarios[scenario]?.metrics ?? {}),
        ]);
        for (const name of names) {
            const beforeMedian = beforeScenarios[scenario]?.metrics?.[name]?.median ?? null;
            const afterMedian = afterScenarios[scenario]?.metrics?.[name]?.median ?? null;
            metrics[name] = {
                before: beforeMedian,
                after: afterMedian,
                reductionPercent: reductionPercent(beforeMedian, afterMedian),
            };
        }
        scenarios[scenario] = metrics;
    }
    return { comparable: true, status: 'ok', scenarios };
}

// ── bytes 모드: dist 산출물의 raw·gzip 바이트 ──
const walk = (dir, base = dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
    });

const gzipSize = (file) => zlib.gzipSync(fs.readFileSync(file)).length;

/** index.html이 직접 참조하는 산출물 경로 집합 — 초기 로딩에 필요한 청크다. */
function entryRefs(distDir) {
    const htmlPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(htmlPath)) return new Set();
    const html = fs.readFileSync(htmlPath, 'utf8');
    const refs = new Set(['index.html']);
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const ref = match[1];
        if (ref.startsWith('/')) refs.add(ref.replace(/^\//, ''));
    }
    return refs;
}

export function collectBundleBytes(distDir) {
    const entries = entryRefs(distDir);
    const files = walk(distDir).map((rel) => {
        const posix = rel.split(path.sep).join('/');
        const full = path.join(distDir, rel);
        return {
            path: posix,
            kind: entries.has(posix) ? 'entry' : 'lazy-or-asset',
            rawBytes: fs.statSync(full).size,
            gzipBytes: gzipSize(full),
        };
    });
    const totals = (kind) => {
        const selected = kind === 'all' ? files : files.filter((f) => f.kind === kind);
        return {
            rawBytes: selected.reduce((sum, f) => sum + f.rawBytes, 0),
            gzipBytes: selected.reduce((sum, f) => sum + f.gzipBytes, 0),
            fileCount: selected.length,
        };
    };
    const metric = (value, unit, method) => ({ value, unit, method });
    const runFor = (scenario, kind) => {
        const t = totals(kind);
        return {
            scenario,
            sampleIndex: 0,
            metrics: {
                rawBytes: metric(t.rawBytes, 'byte', 'fs.statSync'),
                gzipBytes: metric(t.gzipBytes, 'byte', 'zlib.gzipSync'),
                fileCount: metric(t.fileCount, 'count', 'dist walk + index.html 참조 분류'),
            },
            status: 'ok',
        };
    };
    return {
        kind: 'bundle-bytes',
        distDir,
        files,
        runs: [runFor('bundle-entry', 'entry'), runFor('bundle-all', 'all')],
    };
}

// ── CLI ──
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function main(argv) {
    const [mode, ...args] = argv;
    if (mode === 'bytes') {
        const [distDir, ...rest] = args;
        if (!distDir) throw new Error('bytes 모드는 <distDir>가 필요합니다.');
        const result = collectBundleBytes(distDir);
        const outIndex = rest.indexOf('--out');
        const text = JSON.stringify(result, null, 2) + '\n';
        if (outIndex >= 0 && rest[outIndex + 1]) fs.writeFileSync(rest[outIndex + 1], text);
        else process.stdout.write(text);
        return;
    }
    if (mode === 'summarize') {
        const [file] = args;
        if (!file) throw new Error('summarize 모드는 <file.json>이 필요합니다.');
        const out = JSON.stringify(summarizeRuns(readJson(file).runs ?? []), null, 2) + '\n';
        process.stdout.write(out);
        return;
    }
    if (mode === 'compare') {
        const [beforeFile, afterFile] = args;
        if (!beforeFile || !afterFile)
            throw new Error('compare 모드는 <baseline.json> <after.json>이 필요합니다.');
        const out =
            JSON.stringify(compareFiles(readJson(beforeFile), readJson(afterFile)), null, 2) + '\n';
        process.stdout.write(out);
        return;
    }
    const known = 'bytes|summarize|compare';
    throw new Error(`알 수 없는 모드: ${mode ?? '(없음)'} — ${known}`);
}

const invokedAsScript =
    process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
