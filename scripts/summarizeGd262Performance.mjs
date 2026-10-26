import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

import { conditionDiff, p95, summarizeRuns } from './measureFrontendEvidence.mjs';

const stats = (values, unit = 'ms') =>
    summarizeRuns(
        values.map((value) => ({
            scenario: 'metric',
            status: 'ok',
            metrics: { value: { value, unit, method: 'nearest-rank' } },
        })),
    ).metric?.metrics.value ?? { n: 0, median: null, p95: null, min: null, max: null };
const na = (sample) =>
    !sample.ok && /대상 링크 없음|다음 페이지 데이터 없음|참여 가능한 미션 없음/.test(sample.error);
const condition = (data) =>
    Object.fromEntries(
        [
            'platform',
            'release',
            'cpu',
            'cores',
            'totalMemory',
            'node',
            'browser',
            'api',
            'responseMode',
            'replayDelayMs',
            'fixtureHash',
            'profile',
            'viewport',
            'cpuSlowdown',
            'downloadBps',
            'uploadBps',
            'latencyMs',
            'headless',
            'concurrency',
            'user',
        ].map((key) => [key, data.environment[key]]),
    );

if (process.argv.includes('--self-test')) {
    assert.equal(stats([1, 2, 3]).p95, 3);
    assert.equal(p95(Array.from({ length: 30 }, (_, i) => i + 1)), 29);
    assert.equal(stats([]).p95, null);
    assert.equal(stats([1, 2, 3], 'byte').unit, 'byte');
    assert.ok(na({ ok: false, error: '대상 링크 없음' }));
    assert.ok(!na({ ok: false, error: 'API 오류' }));
    assert.deepEqual(conditionDiff({ fixtureHash: 'a' }, { fixtureHash: 'b' }), ['fixtureHash']);
    process.stdout.write('표본·NA·조건 불일치 집계 검증 통과\n');
    process.exit(0);
}

const prefix = process.argv[2] ?? 'controlled3';
const root = 'reports/GD-262';
const read = (label) => {
    const data = JSON.parse(readFileSync(`${root}/${label}.json`, 'utf8'));
    assert.ok(!data.fatal, `${label}: fatal이 있는 자료는 비교하지 않습니다.`);
    assert.equal(data.requested.warmups, label.includes('-home-') ? 1 : 0);
    for (const sample of data.samples) {
        assert.ok(!sample.ok || Number.isFinite(sample.displayMs), `${label}: 유효 화면 시간 누락`);
    }
    return { ...data, samples: data.samples.map((sample) => ({ ...sample, source: label })) };
};
const datasets = {};
for (const version of ['before', 'after']) {
    datasets[`main-${version}`] = [read(`${prefix}-${version}`)];
    datasets[`home-${version}`] = [1, 2, 3].map((batch) =>
        read(`${prefix}-home-${version}-${batch}`),
    );
    for (const experiment of ['dwell65', 'missionModal', 'nextPage', 'desktop', 'events101']) {
        datasets[`${experiment}-${version}`] = [read(`${prefix}-${experiment}-${version}`)];
    }
}

const output = { prefix, generatedAt: new Date().toISOString(), conditions: {}, groups: {} };
for (const [name, runs] of Object.entries(datasets)) {
    const reference = condition(runs[0]);
    for (const run of runs) assert.deepEqual(conditionDiff(reference, condition(run)), []);
    output.conditions[name] = reference;
    const samples = runs.flatMap((run) => run.samples);
    const expected = name.startsWith('main-')
        ? 132
        : name.startsWith('home-')
          ? 30
          : name.startsWith('desktop-')
            ? 9
            : name.startsWith('nextPage-')
              ? 6
              : 3;
    assert.equal(samples.length, expected, `${name}: 예정 표본 수와 다릅니다.`);
    const grouped = Map.groupBy(samples, (sample) => `${sample.screen}:${sample.mode}`);
    for (const [key, values] of grouped) {
        const valid = values.filter((sample) => sample.ok);
        const requests = values.flatMap((sample) => sample.requests);
        output.groups[`${name}/${key}`] = {
            attempts: values.length,
            successes: valid.length,
            na: values.filter(na).length,
            failures: values.filter((sample) => !sample.ok && !na(sample)).length,
            failureReasons: values.filter((sample) => !sample.ok).map((sample) => sample.error),
            display: stats(valid.map((sample) => sample.displayMs)),
            fcp: stats(valid.map((sample) => sample.fcpMs).filter(Number.isFinite)),
            observedLcp: stats(valid.map((sample) => sample.lcpMs).filter(Number.isFinite)),
            browserApi: stats(
                valid.flatMap((sample) => sample.browserApi ?? []).map((r) => r.duration),
            ),
            replayApi: stats(requests.filter((r) => r.status === 200).map((r) => r.durationMs)),
            requestCount: requests.length,
            failedRequests: requests.filter((r) => r.status >= 400).length,
            concurrentDuplicates: runs.reduce(
                (sum, run) => sum + (run.groups[key]?.concurrentDuplicates ?? 0),
                0,
            ),
            assetBytes: stats(
                valid.map((sample) => sample.assetBytes),
                'byte',
            ),
            pollingCounts: valid.map((sample) => sample.pollingRequestCount ?? null),
            batches: Object.fromEntries(
                [...Map.groupBy(valid, (sample) => `${sample.source}/batch-${sample.batch}`)].map(
                    ([batch, items]) => [batch, stats(items.map((sample) => sample.displayMs))],
                ),
            ),
            sources: runs.map((run) => run.label),
        };
    }
}
for (const name of [
    'main',
    'home',
    'dwell65',
    'missionModal',
    'nextPage',
    'desktop',
    'events101',
]) {
    assert.deepEqual(
        conditionDiff(output.conditions[`${name}-before`], output.conditions[`${name}-after`]),
        [],
        `${name}: 전후 조건이 다릅니다.`,
    );
}

const number = (value) => (Number.isFinite(value) ? value.toFixed(1) : 'NA');
const lines = [
    '# GD-262 통제 전후 집계',
    '',
    '원본 dev aa34107, 후보 47d2b54. 성공 표본의 nearest-rank p95이며 n=3에서는 최댓값이다. API 요청 수는 독립 사용자 표본 수가 아니다.',
    '고정 GET 재생(요청별 50ms)이며 API 수치를 실서버 성능으로 해석하지 않는다. 관측 LCP는 화면 준비까지이며 SPA 전환에는 적용하지 않는다.',
    'FCP·LCP가 같은 context의 이전 navigation 값인 전환/재방문은 null이다. bytes는 API 외 누적 encodedBodySize로 전환 청크만의 bytes가 아니다.',
    '',
];
for (const name of [
    'main',
    'home',
    'dwell65',
    'missionModal',
    'nextPage',
    'desktop',
    'events101',
]) {
    const upperLabel = name === 'home' ? 'p95' : '최댓값(n=3)';
    lines.push(
        `## ${name}`,
        '',
        `| 화면/조건 | 버전 | 성공/시도 | NA/실패 | 화면 p50/${upperLabel} ms | min/max ms | FCP/LCP ${upperLabel} ms | 브라우저/재생 API p95 ms | 요청/실패/동시중복 | 자산 bytes p50 |`,
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const [key, group] of Object.entries(output.groups)) {
        if (!key.startsWith(`${name}-`)) continue;
        const [version, screen] = key.slice(name.length + 1).split('/');
        lines.push(
            `| ${screen} | ${version} | ${group.successes}/${group.attempts} | ${group.na}/${group.failures} | ${number(group.display.median)}/${number(group.display.p95)} | ${number(group.display.min)}/${number(group.display.max)} | ${number(group.fcp.p95)}/${number(group.observedLcp.p95)} | ${number(group.browserApi.p95)}/${number(group.replayApi.p95)} | ${group.requestCount}/${group.failedRequests}/${group.concurrentDuplicates} | ${number(group.assetBytes.median)} |`,
        );
    }
    lines.push('');
}
lines.push(
    '## 전후 차이',
    '',
    '차이는 후보−원본이며 양수는 더 오래 걸렸다는 뜻이다. 소표본 차이를 유의한 개선율로 해석하지 않는다. 상위값은 n=3이면 최댓값, 홈 n=30이면 p95다.',
    '',
    '| 실험/화면 | 전후 성공 n | 화면 p50 차이 ms/% | 화면 상위값 차이 ms/% | 요청 수 차이 |',
    '| --- | --- | --- | --- | --- |',
);
const delta = (before, after) =>
    Number.isFinite(before) && Number.isFinite(after) && before > 0
        ? `${number(after - before)}/${number(((after - before) / before) * 100)}%`
        : 'NA';
for (const [key, before] of Object.entries(output.groups)) {
    if (!key.includes('-before/')) continue;
    const after = output.groups[key.replace('-before/', '-after/')];
    assert.ok(after, `${key}: 대응 후보 그룹이 없습니다.`);
    lines.push(
        `| ${key.replace('-before/', '/')} | ${before.successes}/${after.successes} | ${delta(before.display.median, after.display.median)} | ${delta(before.display.p95, after.display.p95)} | ${after.requestCount - before.requestCount} |`,
    );
}
lines.push(
    '## 홈 배치 변동',
    '',
    '| 버전/출처 | n | p50/p95 ms | min/max ms |',
    '| --- | --- | --- | --- |',
);
for (const version of ['before', 'after']) {
    const group = output.groups[`home-${version}/home:cold`];
    for (const [source, batch] of Object.entries(group.batches)) {
        lines.push(
            `| ${version}/${source} | ${batch.n} | ${number(batch.median)}/${number(batch.p95)} | ${number(batch.min)}/${number(batch.max)} |`,
        );
    }
}
lines.push('', '## 실패·NA', '');
for (const [key, group] of Object.entries(output.groups)) {
    if (group.failureReasons.length)
        lines.push(`- ${key}: ${JSON.stringify(group.failureReasons)}`);
}
writeFileSync(`${root}/${prefix}-summary.json`, JSON.stringify(output, null, 4) + '\n');
writeFileSync(`${root}/${prefix}-summary.md`, lines.join('\n') + '\n');
process.stdout.write(`${Object.keys(output.groups).length}개 집계 그룹 저장\n`);
