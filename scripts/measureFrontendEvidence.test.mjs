// scripts/measureFrontendEvidence.mjs 집계 산식 검증 — node --test scripts/measureFrontendEvidence.test.mjs
// vitest도 *.test.mjs를 집어가므로 러너를 감지해 양쪽에서 동작하게 한다 (node:test는 러너 없이 assert만 쓴다)
const isVitest = Boolean(process.env.VITEST);
const { describe, it } = isVitest ? await import('vitest') : await import('node:test');
import assert from 'node:assert/strict';

import {
    collectBundleBytes,
    compareFiles,
    conditionDiff,
    p95,
    reductionPercent,
    summarizeRuns,
} from './measureFrontendEvidence.mjs';

const metric = (value) => ({ value, unit: 'count', method: 'test' });
const run = (scenario, metrics, status = 'ok') => ({
    scenario,
    sampleIndex: 0,
    metrics,
    status,
});

describe('p95 — 계획서 §5 산식', () => {
    it('1..100은 95', () => {
        assert.equal(p95(Array.from({ length: 100 }, (_, i) => i + 1)), 95);
    });
    it('1..30은 29', () => {
        assert.equal(p95(Array.from({ length: 30 }, (_, i) => i + 1)), 29);
    });
    it('빈 배열·NaN 포함은 null', () => {
        assert.equal(p95([]), null);
        assert.equal(p95([1, Number.NaN]), null);
        assert.equal(p95([1, Number.POSITIVE_INFINITY]), null);
    });
});

describe('reductionPercent — 계획서 §5 산식', () => {
    it('10→1은 90', () => assert.equal(reductionPercent(10, 1), 90));
    it('100→85는 15', () => assert.equal(reductionPercent(100, 85), 15));
    it('25→20은 20', () => assert.equal(reductionPercent(25, 20), 20));
    it('0→0·비수치는 null', () => {
        assert.equal(reductionPercent(0, 0), null);
        assert.equal(reductionPercent(-5, 1), null);
        assert.equal(reductionPercent(10, Number.NaN), null);
    });
});

describe('summarizeRuns — 집계·결측·실패', () => {
    it('시나리오별 중간값·p95·범위·IQR·실패 수를 낸다', () => {
        const runs = [
            run('s', { latency: metric(10) }),
            run('s', { latency: metric(20) }),
            run('s', { latency: metric(30) }),
            run('s', { latency: metric(40) }),
            run('s', {}, 'failed'),
        ];
        const out = summarizeRuns(runs);
        assert.equal(out.s.samples, 5);
        assert.equal(out.s.failed, 1);
        assert.deepEqual(
            {
                n: out.s.metrics.latency.n,
                missing: out.s.metrics.latency.missing,
                min: out.s.metrics.latency.min,
                max: out.s.metrics.latency.max,
                median: out.s.metrics.latency.median,
                p95: out.s.metrics.latency.p95,
                iqr: out.s.metrics.latency.iqr,
            },
            { n: 4, missing: 1, min: 10, max: 40, median: 20, p95: 40, iqr: 20 },
        );
        assert.equal(out.s.metrics.latency.exploratory, true);
    });
    it('값이 null인 metric은 missing으로 센다', () => {
        const out = summarizeRuns([
            run('s', { bytes: { value: null, unit: 'byte', method: 'x' } }),
        ]);
        assert.equal(out.s.metrics.bytes.n, 0);
        assert.equal(out.s.metrics.bytes.missing, 1);
        assert.equal(out.s.metrics.bytes.median, null);
    });
    it('소수점·증가 감소 부호 없이 그대로 둔다', () => {
        const out = summarizeRuns([run('s', { x: metric(0.5) }), run('s', { x: metric(1.5) })]);
        assert.equal(out.s.metrics.x.median, 0.5);
        assert.equal(out.s.metrics.x.iqr, 1);
        assert.equal(out.s.metrics.x.exploratory, true);
    });
});

describe('conditionDiff·compareFiles — 비교 가능성', () => {
    const condition = {
        commit: 'abc',
        environment: 'local-mock',
        cache: 'cold',
        fixtures: { events: 25 },
        runId: 'r1',
        capturedAt: 't1',
    };
    it('runId·시각이 달라도 통제 항목이 같으면 비교 가능하다', () => {
        assert.deepEqual(
            conditionDiff(condition, { ...condition, runId: 'r2', capturedAt: 't2' }),
            [],
        );
    });
    it('환경·fixture·cache가 다르면 그 키를 돌려준다', () => {
        const diff = conditionDiff(condition, {
            ...condition,
            cache: 'warm',
            environment: 'staging',
        });
        assert.deepEqual(diff.sort(), ['cache', 'environment']);
    });
    it('조건이 다르면 개선율 없이 not-comparable', () => {
        const before = {
            condition,
            runs: [run('s', { v: metric(10) }), run('s', { v: metric(20) })],
        };
        const after = {
            condition: { ...condition, cache: 'warm' },
            runs: [run('s', { v: metric(5) })],
        };
        const out = compareFiles(before, after);
        assert.equal(out.status, 'not-comparable');
        assert.equal(out.comparable, false);
        assert.deepEqual(out.conditionDiff, ['cache']);
        assert.equal(out.scenarios, undefined);
    });
    it('조건이 같으면 시나리오·메트릭별 개선율을 산출한다', () => {
        const before = {
            condition,
            runs: [run('s', { v: metric(10) }), run('s', { v: metric(20) })],
        };
        const after = {
            condition: { ...condition, runId: 'r2' },
            runs: [run('s', { v: metric(5) })],
        };
        const out = compareFiles(before, after);
        assert.equal(out.status, 'ok');
        assert.equal(out.comparable, true);
        // before 중간값 10(10,20 중 하위)·after 5 → 50%
        assert.equal(out.scenarios.s.v.before, 10);
        assert.equal(out.scenarios.s.v.after, 5);
        assert.equal(out.scenarios.s.v.reductionPercent, 50);
    });
});

describe('collectBundleBytes — dist 분류', () => {
    it('index.html 참조는 entry, 나머지는 lazy-or-asset으로 나눈다', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
        fs.writeFileSync(
            path.join(dir, 'index.html'),
            '<script src="/assets/index-1.js"></script><link href="/assets/index-1.css" rel="stylesheet">',
        );
        fs.mkdirSync(path.join(dir, 'assets'));
        fs.writeFileSync(path.join(dir, 'assets/index-1.js'), 'x'.repeat(100));
        fs.writeFileSync(path.join(dir, 'assets/index-1.css'), 'y'.repeat(50));
        fs.writeFileSync(path.join(dir, 'assets/chunk-lazy.js'), 'z'.repeat(70));
        const out = collectBundleBytes(dir);
        const entry = out.runs.find((r) => r.scenario === 'bundle-entry');
        const all = out.runs.find((r) => r.scenario === 'bundle-all');
        assert.equal(entry.metrics.fileCount.value, 3);
        assert.equal(
            entry.metrics.rawBytes.value,
            100 + 50 + fs.statSync(path.join(dir, 'index.html')).size,
        );
        assert.equal(all.metrics.fileCount.value, 4);
        assert.equal(all.metrics.rawBytes.value - entry.metrics.rawBytes.value, 70);
        assert.ok(entry.metrics.gzipBytes.value > 0);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
