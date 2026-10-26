import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { cpus, freemem, homedir, platform, release, totalmem } from 'node:os';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

// 앱에 포함된 실행 도구를 재사용한다. 프로젝트 dependency는 설치하지 않는다.
const require = createRequire(import.meta.url);
const { chromium } = require(
    resolve(
        homedir(),
        '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
    ),
);
const quantile = (values, q) =>
    values.length ? [...values].sort((a, b) => a - b)[Math.ceil(q * values.length) - 1] : null;
const summary = (values) => ({
    n: values.length,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
});
const duplicates = (requests) =>
    requests.filter((r, i) =>
        requests
            .slice(0, i)
            .some((p) => p.path === r.path && p.started < r.started && p.ended > r.started),
    ).length;
const apiSucceeded = (requests) => !requests.some((request) => request.status >= 400);
if (process.argv.includes('--self-test')) {
    assert.equal(
        quantile(
            Array.from({ length: 100 }, (_, i) => i + 1),
            0.95,
        ),
        95,
    );
    assert.equal(quantile([], 0.95), null);
    assert.equal(
        duplicates([
            { path: '/a', started: 0, ended: 100 },
            { path: '/a', started: 10, ended: 110 },
            { path: '/a', started: 30000, ended: 30100 },
        ]),
        1,
    );
    const delayedRequests = [{ status: 200 }];
    assert.equal(apiSucceeded(delayedRequests), true);
    delayedRequests.push({ status: 502 });
    assert.equal(apiSucceeded(delayedRequests), false);
    process.stdout.write('분위수·빈 표본·동시 중복/정상 폴링·체류 중 지연 오류 판정 통과\n');
    process.exit(0);
}
const args = Object.fromEntries(
    process.argv.slice(2).map((value) => value.replace(/^--/, '').split('=')),
);
// 응답 본문은 Git 밖 임시 파일에만 보관하고, 재생 시 누락 요청을 실서버로 보내지 않는다.
const fixturePath = args.fixture;
const capture = args.capture === 'true';
const fixture =
    fixturePath && existsSync(fixturePath)
        ? JSON.parse(readFileSync(fixturePath, 'utf8'))
        : { responses: {} };
const fixtureKey = (path, owner = 'USER_A') => {
    const url = new URL(path, 'http://localhost');
    // 최근 30일 조회의 실행 시각만 달라지는 입력을 같은 고정 기간으로 재생한다.
    if (url.pathname.includes('/tickets/histories/') && url.searchParams.get('size') === '20') {
        url.searchParams.set('from', '고정-30일-시작');
        url.searchParams.set('to', '고정-30일-끝');
    }
    return `${owner}:${url.pathname}${url.search}`;
};
const label = args.label ?? 'before';
const count = Number(args.samples ?? 30);
const batches = Number(args.batches ?? 3);
const warmups = Number(args.warmups ?? 3);
const modes = (args.modes ?? 'cold,transition,revisit5,revisit35').split(',');
const desktop = args.profile === 'desktop';
const api = 'https://dzc8oneey9mmx.cloudfront.net/api';
const normalizePath = (path) =>
    path
        .replace(
            /[0-9a-f]{8}-[0-9a-f-]{27,}/gi,
            (id) => `id-${createHash('sha256').update(id).digest('hex').slice(0, 12)}`,
        )
        .replace(
            /([?&]cursor=)[^&]+/g,
            (_match, prefix) =>
                `${prefix}cursor-${createHash('sha256').update(_match).digest('hex').slice(0, 12)}`,
        );
const preview = args.preview ?? 'http://127.0.0.1:5188';
const port = Number(args.port ?? 5189);
const base = `http://127.0.0.1:${port}`;
const users = JSON.parse(
    readFileSync('reports/20261021-L6-deploy-evidence.json', 'utf8'),
).bakedUsers;
const user = users.find((u) => u.role === 'USER');
const otherUser = users.find((u) => u.role === 'USER' && u.id !== user?.id);
const safeError = (error) => {
    let message = normalizePath(error?.message ?? String(error));
    for (const [index, item] of users.entries()) {
        if (item.name) message = message.replaceAll(item.name, `사용자-${index + 1}`);
    }
    return message.slice(0, 200);
};
assert.ok(user, '기존 검증 기록의 실제 등록 USER가 필요합니다.');
const headers = {
    'X-User-ID': user.id,
    'X-User-Role': user.role,
    'X-User-Membership': user.membership,
};
const result = {
    label,
    checkedAt: new Date().toISOString(),
    environment: {
        platform: platform(),
        release: release(),
        cpu: cpus()[0].model,
        cores: cpus().length,
        totalMemory: totalmem(),
        freeMemory: freemem(),
        node: process.version,
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        diffHash: createHash('sha256')
            .update(execFileSync('git', ['diff', '--', 'src']))
            .digest('hex'),
        api,
        responseMode: fixturePath ? (capture ? '고정 응답 수집' : '고정 응답 재생') : '실서버',
        replayDelayMs: fixturePath ? 50 : null,
        fixtureHash:
            fixturePath && !capture
                ? createHash('sha256').update(readFileSync(fixturePath)).digest('hex')
                : null,
        profile: desktop ? 'desktop' : 'mobile',
        viewport: desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
        cpuSlowdown: desktop ? 1 : 4,
        downloadBps: desktop ? null : 1600000 / 8,
        uploadBps: desktop ? null : 750000 / 8,
        latencyMs: desktop ? 0 : 150,
        headless: true,
        concurrency: 1,
        user: 'USER_A',
        serverInternalTime: '미측정',
    },
    requested: { count, batches, warmups, modes },
    discovery: {},
    samples: [],
    errors: [],
};
const output = `reports/GD-262/${label}.json`;
const save = () => {
    result.groups = {};
    for (const sample of result.samples) {
        const key = `${sample.screen}:${sample.mode}`;
        const group = (result.groups[key] ??= {
            successes: [],
            failures: 0,
            requests: [],
            batches: {},
        });
        if (sample.ok) {
            group.successes.push(sample.displayMs);
            (group.batches[sample.batch] ??= []).push(sample.displayMs);
        } else group.failures++;
        group.requests.push(...sample.requests);
    }
    for (const [key, group] of Object.entries(result.groups)) {
        group.display = summary(group.successes);
        delete group.successes;
        group.proxyApi = summary(
            group.requests.filter((r) => r.status === 200).map((r) => r.durationMs),
        );
        const samples = result.samples.filter((s) => `${s.screen}:${s.mode}` === key);
        group.browserApi = summary(
            samples.flatMap((s) => s.browserApi ?? []).map((r) => r.duration),
        );
        group.requestCount = group.requests.length;
        group.concurrentDuplicates = duplicates(group.requests);
        group.batches = Object.fromEntries(
            Object.entries(group.batches).map(([key, values]) => [key, summary(values)]),
        );
        delete group.requests;
    }
    writeFileSync(output, JSON.stringify(result, null, 2));
};
let segment = null;
const server = createServer((request, response) => {
    const isApi = request.url.startsWith('/api/');
    const started = performance.now();
    const owner = segment;
    if (request.method !== 'GET') {
        response.writeHead(405).end();
        return;
    }
    const forwarded = { ...request.headers };
    for (const key of ['host', 'connection', 'origin', 'referer']) delete forwarded[key];
    const target = isApi ? api + request.url.slice(4) : preview + request.url;
    const alias = forwarded['x-user-id'] === otherUser?.id ? 'USER_B' : 'USER_A';
    const key = fixtureKey(request.url, alias);
    if (isApi && fixturePath && (!capture || fixture.responses[key])) {
        const stored = fixture.responses[key];
        setTimeout(() => {
            const ended = performance.now();
            const body = stored ? Buffer.from(stored.body, 'base64') : Buffer.from('미수집 요청');
            const status = stored?.status ?? 502;
            if (owner)
                owner.requests.push({
                    method: 'GET',
                    path: normalizePath(request.url),
                    started,
                    ended,
                    durationMs: ended - started,
                    ttfbMs: ended - started,
                    status,
                    bytes: body.length,
                    user: alias,
                });
            response.writeHead(status, stored?.headers ?? {});
            response.end(body);
        }, 50);
        return;
    }
    const transport = isApi ? httpsRequest : httpRequest;
    // 압축을 해제하는 fetch 대신 gzip·ETag를 그대로 중계해 전송량과 재방문 캐시를 보존한다.
    const upstream = transport(target, { headers: forwarded }, (incoming) => {
        const firstByte = performance.now();
        let bytes = 0;
        const chunks = [];
        if (incoming.statusCode === 429) result.rateLimited = true;
        incoming.on('data', (chunk) => {
            bytes += chunk.length;
            if (isApi && fixturePath && capture) chunks.push(chunk);
        });
        incoming.on('end', () => {
            if (isApi && fixturePath && capture && incoming.statusCode === 200) {
                fixture.responses[key] = {
                    status: incoming.statusCode,
                    headers: incoming.headers,
                    body: Buffer.concat(chunks).toString('base64'),
                };
                writeFileSync(fixturePath, JSON.stringify(fixture));
            }
            if (!isApi || !owner) return;
            const ended = performance.now();
            owner.requests.push({
                method: request.method,
                path: normalizePath(request.url),
                started,
                ended,
                durationMs: ended - started,
                ttfbMs: firstByte - started,
                status: incoming.statusCode,
                bytes,
                user:
                    forwarded['x-user-id'] === user.id
                        ? 'USER_A'
                        : forwarded['x-user-id'] === otherUser?.id
                          ? 'USER_B'
                          : 'OTHER',
            });
        });
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response);
    });
    upstream.setTimeout(25000, () => upstream.destroy(new Error('프록시 응답 시간 초과')));
    upstream.on('error', (error) => {
        if (owner && isApi)
            owner.requests.push({
                path: normalizePath(request.url),
                started,
                ended: performance.now(),
                status: 502,
                error: error.name,
            });
        if (!response.headersSent) response.writeHead(502);
        response.end();
    });
    response.on('close', () => {
        if (!response.writableEnded) upstream.destroy();
    });
    upstream.end();
});
await new Promise((done) => server.listen(port, '127.0.0.1', done));
let browser;
try {
    const get = async (path, owner = 'USER_A') => {
        const key = fixtureKey('/api' + path, owner);
        if (fixturePath && fixture.responses[key]) {
            const { gunzipSync } = await import('node:zlib');
            const stored = fixture.responses[key];
            const bytes = Buffer.from(stored.body, 'base64');
            return JSON.parse(
                stored.headers['content-encoding'] === 'gzip' ? gunzipSync(bytes) : bytes,
            ).data;
        }
        assert.ok(!fixturePath || capture, `고정 사전 조회 누락: ${path.split('?')[0]}`);
        assert.equal(owner, 'USER_A', '다른 사용자 사전 조회는 고정 응답에서만 허용합니다.');
        const response = await fetch(api + path, { headers, signal: AbortSignal.timeout(20000) });
        assert.equal(response.status, 200, `사전 조회 실패: ${path.split('?')[0]}`);
        const body = await response.text();
        if (fixturePath && capture) {
            fixture.responses[key] = {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: Buffer.from(body).toString('base64'),
            };
            writeFileSync(fixturePath, JSON.stringify(fixture));
        }
        return JSON.parse(body).data;
    };
    const events = await get('/v1/events?page=1&size=20');
    const games = await get('/v1/games');
    const missions = await get('/v1/missions?page=1&size=50');
    const gameItems = games.items ?? games;
    const missionItems = missions.items ?? missions;
    const ordinary =
        events.items.find((e) => e.eventType === 'NO_TICKET' && e.status === 'OPEN') ??
        events.items.find((e) => e.eventType === 'NO_TICKET');
    const raffle =
        events.items.find((e) => e.eventType === 'TICKET' && e.status === 'OPEN') ??
        events.items.find((e) => e.eventType === 'TICKET');
    result.discovery = {
        eventCount: events.totalElements,
        gameCount: gameItems.length,
        missionCount: missions.totalElements ?? missionItems.length,
        eventState: ordinary?.status,
        raffleState: raffle?.status,
        idsHash: createHash('sha256')
            .update(
                JSON.stringify([ordinary?.id, raffle?.id, gameItems[0]?.id, missionItems[0]?.id]),
            )
            .digest('hex'),
    };
    const screens = [
        { name: 'home', path: '/', text: '이벤트' },
        { name: 'events', path: '/events', text: ordinary?.title ?? '이벤트' },
        { name: 'raffles', path: '/time-raffle', text: '겟또타임' },
        ...(ordinary
            ? [{ name: 'eventDetail', path: `/events/${ordinary.id}`, text: ordinary.title }]
            : []),
        ...(raffle
            ? [{ name: 'raffleDetail', path: `/time-raffle/${raffle.id}`, text: raffle.title }]
            : []),
        { name: 'missions', path: '/missions', text: '출석' },
        ...(missionItems[0]
            ? [
                  {
                      name: 'missionDetail',
                      path: `/missions/${missionItems[0].id}`,
                      text: missionItems[0].title,
                  },
              ]
            : []),
        ...(gameItems[0]
            ? [
                  {
                      name: 'gameDetail',
                      path: `/missions/games/${gameItems[0].id}`,
                      text: gameItems[0].name,
                  },
              ]
            : []),
        { name: 'tickets', path: '/my-tickets', text: '내 응모권' },
        { name: 'entries', path: '/my-entries', text: '응모' },
        { name: 'notifications', path: '/my-notifications', text: '알림' },
    ].filter((screen) => !args.screen || args.screen.split(',').includes(screen.name));
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    result.environment.browser = browser.version();
    async function contextFor() {
        const context = await browser.newContext({ viewport: result.environment.viewport });
        await context.addInitScript((u) => {
            if (!localStorage.getItem('getddo-session'))
                localStorage.setItem(
                    'getddo-session',
                    JSON.stringify({ state: { user: u }, version: 0 }),
                );
            window.__perf = { started: 0, lcp: null, pending: 0 };
            const send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (...values) {
                window.__perf.pending++;
                this.addEventListener('loadend', () => window.__perf.pending--, { once: true });
                return send.apply(this, values);
            };
            new PerformanceObserver((list) => {
                window.__perf.lcp = list.getEntries().at(-1).startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            document.addEventListener(
                'click',
                () => {
                    window.__perf.started = performance.now();
                },
                true,
            );
        }, user);
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: result.environment.cpuSlowdown });
        await cdp.send('Network.enable');
        if (!desktop)
            await cdp.send('Network.emulateNetworkConditions', {
                offline: false,
                latency: 150,
                downloadThroughput: 200000,
                uploadThroughput: 93750,
            });
        page.on('pageerror', (error) => result.errors.push(safeError(error)));
        return { context, page };
    }
    async function ready(page, screen) {
        await page.waitForFunction(
            (text) => {
                const main = document.querySelector('main');
                return (
                    main &&
                    main !== window.__perf.previousMain &&
                    main.innerText.includes(text) &&
                    !main.querySelector('[data-slot="skeleton"]') &&
                    window.__perf.pending === 0
                );
            },
            screen.text ?? '',
            { timeout: 45000 },
        );
        // API 완료와 업무 DOM 준비를 모두 기다린 뒤 paint를 근사한다. networkidle 자체를 끝점으로 삼지 않는다.
        return page.evaluate(
            () =>
                new Promise((done) =>
                    requestAnimationFrame(() =>
                        requestAnimationFrame(() =>
                            done({
                                end: performance.now(),
                                start: window.__perf.started,
                                fcp:
                                    performance.getEntriesByName('first-contentful-paint')[0]
                                        ?.startTime ?? null,
                                lcp: window.__perf.lcp,
                                resources: performance
                                    .getEntriesByType('resource')
                                    .filter((r) => /\/api\//.test(r.name))
                                    .map((r) => ({
                                        path: new URL(r.name).pathname.replace(
                                            /[0-9a-f]{8}-[0-9a-f-]{27,}/gi,
                                            ':id',
                                        ),
                                        start: r.startTime,
                                        duration: r.duration,
                                        ttfb: r.responseStart - r.startTime,
                                    })),
                                assetBytes: performance
                                    .getEntriesByType('resource')
                                    .filter((r) => !/\/api\//.test(r.name))
                                    .reduce((total, r) => total + r.encodedBodySize, 0),
                            }),
                        ),
                    ),
                ),
        );
    }
    async function clickPath(page, path) {
        // 실제 Link의 React 핸들러를 사용한다. 모바일 숨김 메뉴는 DOM 클릭으로 경로 전환만 측정한다.
        const link = page.locator(`a[href="${path}"]`).first();
        if (await link.count())
            await link.evaluate((el) => {
                window.__perf.previousMain = document.querySelector('main');
                el.click();
            });
        else throw new Error('대상 링크 없음');
    }
    if (args.verify === 'true') {
        result.checks = [];
        const check = async (name, action) => {
            const { context, page } = await contextFor();
            const evidence = { name, requests: [] };
            segment = evidence;
            try {
                await action(context, page, evidence);
                evidence.ok = true;
            } catch (error) {
                evidence.ok = false;
                evidence.error = safeError(error);
                process.exitCode = 1;
            } finally {
                segment = null;
                result.checks.push(evidence);
                save();
                await context.close();
                process.stdout.write(`${name}: ${evidence.ok ? '통과' : evidence.error}\n`);
            }
        };
        await check('키보드 이동·뒤로 가기·직접 상세 진입', async (_context, page) => {
            await page.goto(base + '/');
            await ready(
                page,
                screens.find((s) => s.name === 'home'),
            );
            const link = page.locator('header a[href="/events"]').first();
            await page.evaluate(() => {
                window.__perf.previousMain = document.querySelector('main');
            });
            await link.focus();
            await link.press('Enter');
            await ready(
                page,
                screens.find((s) => s.name === 'events'),
            );
            await page.goBack();
            await ready(
                page,
                screens.find((s) => s.name === 'home'),
            );
            for (const screen of screens.filter((s) => s.name.endsWith('Detail'))) {
                await page.goto(base + screen.path);
                await ready(page, screen);
            }
        });
        await check('청크 실패 시 오류 경계·홈 복구', async (context, page) => {
            await context.route('**/assets/EventListPage-*.js', (route) => route.abort());
            await page.goto(base + '/events');
            await page.getByText('화면을 표시하지 못했습니다', { exact: true }).waitFor();
            assert.ok(await page.locator('header').isVisible());
            await page.getByRole('link', { name: '홈으로 이동', exact: true }).click();
            await ready(
                page,
                screens.find((s) => s.name === 'home'),
            );
        });
        await check('403 오류 표시', async (context, page) => {
            await context.route('**/api/v1/events?*', (route) =>
                route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: false,
                        code: 'COMMON-003',
                        message: '접근 권한이 없습니다.',
                    }),
                }),
            );
            await page.goto(base + '/events');
            await page.getByText('이벤트 목록을 불러오지 못했습니다.', { exact: true }).waitFor();
        });
        await check('429 대기 시간 준수', async (context, page, evidence) => {
            let calls = 0;
            await context.route('**/api/v1/events?*', (route) => {
                calls++;
                return route.fulfill({
                    status: 429,
                    headers: { 'Retry-After': '2' },
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: false,
                        code: 'COMMON-006',
                        message: '잠시 후 다시 시도해 주세요.',
                    }),
                });
            });
            const firstRequest = page.waitForRequest(
                (request) => new URL(request.url()).pathname === '/api/v1/events',
                { timeout: 10000 },
            );
            const navigation = page.goto(base + '/events', { waitUntil: 'domcontentloaded' });
            await firstRequest;
            await page.waitForTimeout(700);
            assert.equal(calls, 1);
            evidence.beforeRetryAfter = calls;
            await page.waitForTimeout(1600);
            assert.ok(calls >= 2);
            evidence.afterRetryAfter = calls;
            await navigation;
        });
        await check('오프라인·재연결 후 이전 목록 보존', async (context, page, evidence) => {
            await page.goto(base + '/events');
            const target = screens.find((s) => s.name === 'events');
            await ready(page, target);
            await context.setOffline(true);
            await page.waitForTimeout(500);
            assert.ok((await page.locator('main').innerText()).includes(target.text));
            const reconnected = page.waitForResponse(
                (response) =>
                    new URL(response.url()).pathname === '/api/v1/events' &&
                    response.status() === 200,
                { timeout: 10000 },
            );
            await context.setOffline(false);
            await reconnected;
            await ready(page, target);
            evidence.reconnectedStatus = 200;
            assert.ok((await page.locator('main').innerText()).includes(target.text));
        });
        await check('사용자 전환 헤더 격리·새로고침 유지', async (_context, page, evidence) => {
            assert.ok(otherUser);
            await page.goto(base + '/');
            await ready(
                page,
                screens.find((s) => s.name === 'home'),
            );
            await page.getByRole('button', { name: /^(계정 전환|가상 사용자 전환)/ }).click();
            const before = performance.now();
            await page
                .getByRole('button', { name: new RegExp(otherUser.name) })
                .first()
                .click();
            await page.waitForFunction(
                (id) =>
                    JSON.parse(localStorage.getItem('getddo-session')).state.user.id === id &&
                    window.__perf.pending === 0,
                otherUser.id,
            );
            await page.waitForTimeout(1000);
            const changed = evidence.requests.filter((r) => r.started >= before);
            assert.ok(changed.some((r) => r.user === 'USER_B'));
            assert.ok(!changed.some((r) => r.user === 'USER_A'));
            assert.ok(!changed.some((r) => r.status >= 400));
            evidence.afterSwitchRequests = changed.length;
            await page.reload();
            await ready(
                page,
                screens.find((s) => s.name === 'home'),
            );
            assert.equal(
                await page.evaluate(
                    () => JSON.parse(localStorage.getItem('getddo-session')).state.user.id,
                ),
                otherUser.id,
            );
            assert.ok(fixture.responses[fixtureKey('/api/v1/tickets/me', 'USER_B')]);
            const initial = await get('/v1/tickets/me');
            const switched = await get('/v1/tickets/me', 'USER_B');
            assert.notEqual(initial.availableCount, switched.availableCount);
            await page.goto(base + '/my-tickets');
            await ready(
                page,
                screens.find((s) => s.name === 'tickets'),
            );
            await page
                .getByRole('region', { name: '내 응모권 요약' })
                .getByText(`${switched.availableCount.toLocaleString('ko-KR')}장`, { exact: true })
                .first()
                .waitFor();
            evidence.distinctBalanceRendered = true;
        });
        await check('320·390px 목록 넘침', async (_context, page, evidence) => {
            evidence.widths = [];
            for (const width of [320, 390]) {
                await page.setViewportSize({ width, height: 844 });
                await page.goto(base + '/events');
                await ready(
                    page,
                    screens.find((s) => s.name === 'events'),
                );
                const overflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > innerWidth,
                );
                evidence.widths.push({ width, overflow });
                assert.equal(overflow, false);
            }
        });
    } else
        for (let batch = 1; batch <= batches; batch++) {
            for (let trial = -warmups; trial < count; trial++) {
                for (const screen of screens) {
                    const { context, page } = await contextFor();
                    try {
                        for (const mode of modes) {
                            if (result.rateLimited) throw new Error('429 대기: 배치 중단');
                            const sample = {
                                screen: screen.name,
                                mode,
                                batch,
                                trial,
                                requests: [],
                                ok: false,
                            };
                            segment = sample;
                            try {
                                if (mode === 'missionModal') {
                                    await page.goto(base + '/missions', {
                                        waitUntil: 'domcontentloaded',
                                    });
                                    await ready(page, screen);
                                    const button = page
                                        .locator('main article button:not([disabled])')
                                        .filter({ hasText: /퀴즈 풀기|설문 참여/ })
                                        .first();
                                    if (!(await button.count()))
                                        throw new Error('참여 가능한 미션 없음');
                                    const title = await button
                                        .locator('xpath=ancestor::article')
                                        .getByRole('heading')
                                        .innerText();
                                    sample.modalTitleHash = createHash('sha256')
                                        .update(title)
                                        .digest('hex');
                                    sample.requests = [];
                                    await button.click();
                                    await page.getByRole('dialog').waitFor({ state: 'visible' });
                                    await page.waitForFunction(() => {
                                        const dialog = document.querySelector('[role="dialog"]');
                                        return (
                                            dialog &&
                                            !dialog.querySelector('[data-slot="skeleton"]') &&
                                            window.__perf.pending === 0
                                        );
                                    });
                                } else if (
                                    mode === 'cold' ||
                                    mode === 'dwell65' ||
                                    mode === 'nextPage'
                                ) {
                                    await page.goto(base + screen.path, {
                                        waitUntil: 'domcontentloaded',
                                    });
                                    if (mode === 'nextPage') {
                                        await ready(page, screen);
                                        sample.requests = [];
                                        const next = page.getByRole('button', {
                                            name: '다음 페이지',
                                            exact: true,
                                        });
                                        if (
                                            !(await next.count()) ||
                                            !(await next.first().isEnabled())
                                        )
                                            throw new Error('다음 페이지 데이터 없음');
                                        await next.first().click();
                                    }
                                } else {
                                    // 마이페이지는 모든 내역 화면으로, 홈/목록은 상세 화면으로 연결한다.
                                    const parent =
                                        screen.name === 'eventDetail'
                                            ? '/events'
                                            : screen.name === 'raffleDetail'
                                              ? '/time-raffle'
                                              : ['gameDetail', 'missionDetail'].includes(
                                                      screen.name,
                                                  )
                                                ? '/missions'
                                                : '/mypage';
                                    await page.goto(base + parent, {
                                        waitUntil: 'domcontentloaded',
                                    });
                                    await ready(page, { text: '' });
                                    if (mode.startsWith('revisit')) {
                                        await clickPath(page, screen.path);
                                        await ready(page, screen);
                                        await clickPath(page, parent);
                                        await ready(page, { text: '' });
                                        await page.waitForTimeout(
                                            mode === 'revisit5' ? 5000 : 35000,
                                        );
                                    }
                                    sample.requests = [];
                                    await clickPath(page, screen.path);
                                }
                                const timing = await ready(page, screen);
                                sample.displayMs =
                                    timing.end - (mode === 'cold' ? 0 : timing.start);
                                sample.fcpMs = mode === 'cold' ? timing.fcp : null;
                                sample.lcpMs = mode === 'cold' ? timing.lcp : null;
                                sample.assetBytes = timing.assetBytes;
                                sample.browserApi = timing.resources.filter(
                                    (r) => r.start >= (mode === 'cold' ? 0 : timing.start),
                                );
                                sample.ok = apiSucceeded(sample.requests);
                                if (!sample.ok) sample.error = 'API 오류';
                                if (mode === 'dwell65') {
                                    sample.initialRequestCount = sample.requests.length;
                                    await page.waitForTimeout(65000);
                                    sample.pollingRequestCount =
                                        sample.requests.length - sample.initialRequestCount;
                                    // 체류 중 발생한 실패도 표본 실패다. 최초 표시 성공으로 덮지 않는다.
                                    sample.ok = apiSucceeded(sample.requests);
                                    if (!sample.ok) sample.error = '체류 중 API 오류';
                                }
                            } catch (error) {
                                sample.error = safeError(error);
                            }
                            if (trial >= 0) result.samples.push(sample);
                            segment = null;
                            save();
                            process.stdout.write(
                                `${label} ${batch}/${batches} ${trial + 1}/${count} ${screen.name} ${mode}: ${sample.ok ? Math.round(sample.displayMs) : sample.error}\n`,
                            );
                        }
                    } finally {
                        await context.close();
                    }
                }
            }
        }
} catch (error) {
    result.fatal = safeError(error);
    process.exitCode = 1;
} finally {
    save();
    if (browser) await browser.close();
    await new Promise((done) => server.close(done));
}
