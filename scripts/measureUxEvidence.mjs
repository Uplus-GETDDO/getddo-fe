// ux-* 브라우저 표본 수집 — MSW 활성 production 빌드(vite preview) 대상.
// 측정 규약: reports/frontend-evidence/measurement-protocol.md
//   로딩: 경로별 콜드(새 context) N회·웜(같은 context 재탐색) N회
//   동작: 시나리오별 M회 — 클릭→pending/성공 안내/업무 반영을 Node 단조 시계로 계측
// 실행: node scripts/measureUxEvidence.mjs --preview=http://127.0.0.1:6277 --out=<raw.json> [--loadCold=10 --loadWarm=10 --actSamples=30 --only=load,act-attendance]
// 새 의존성은 설치하지 않는다 — 설치된 Playwright(Codex 런타임 번들)만 사용한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus, freemem, homedir, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const playwrightCandidates = [
    process.env.UX_PLAYWRIGHT_PATH,
    resolve(
        homedir(),
        '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
    ),
];
let chromium = null;
let playwrightSource = null;
for (const candidate of playwrightCandidates.filter(Boolean)) {
    try {
        ({ chromium } = require(candidate));
        playwrightSource = candidate;
        break;
    } catch {
        // 다음 후보 경로를 시도한다
    }
}
if (process.argv.includes('--self-test')) {
    assert.ok(chromium, '설치된 Playwright(chromium)를 찾지 못했습니다');
    process.stdout.write(`playwright 경로: ${playwrightSource}\nself-test 통과\n`);
    process.exit(0);
}
assert.ok(chromium, '설치된 Playwright(chromium)를 찾지 못했습니다 — not-measured로 기록하세요');

const args = Object.fromEntries(
    process.argv.slice(2).map((value) => value.replace(/^--/, '').split('=')),
);
const preview = (args.preview ?? 'http://127.0.0.1:6277').replace(/\/$/, '');
const outPath = args.out;
assert.ok(outPath, '--out <raw.json> 경로가 필요합니다');
const loadCold = Number(args.loadCold ?? 10);
const loadWarm = Number(args.loadWarm ?? 10);
const actSamples = Number(args.actSamples ?? 30);
const only = (args.only ?? 'load,act-attendance,act-enter,act-transition').split(',');

// 시연용 가상 사용자 — 로그인 화면 클릭 대신 세션 스토어를 직접 채운다 (sessionSync가 헤더로 주입)
const SESSION = JSON.stringify({
    state: {
        user: {
            id: 'vu-doyoon',
            name: '김도윤',
            role: 'USER',
            membership: 'excellent',
            personaLabel: '데일리 루틴러',
        },
    },
    version: 0,
});
const SEED_SESSION = `localStorage.setItem('getddo-session', ${JSON.stringify(SESSION)});`;

// 화면 타이밍 관측자 — navigation 이전에 설치해야 LCP·CLS·FCP를 잡는다
const OBSERVER_INIT = `
window.__uxVitals = { lcp: null, cls: 0, fcp: null };
try {
    new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) window.__uxVitals.lcp = entries[entries.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__uxVitals.cls += entry.value;
        }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') window.__uxVitals.fcp = entry.startTime;
        }
    }).observe({ type: 'paint', buffered: true });
} catch (error) { /* 이 브라우저가 지원하지 않는 지표는 null로 남긴다 */ }
`;

const LOAD_EVAL = `(() => {
    const nav = performance.getEntriesByType('navigation')[0] ?? {};
    const resources = performance.getEntriesByType('resource');
    const transfer = { js: 0, css: 0, img: 0, font: 0, api: 0, other: 0 };
    const count = { js: 0, css: 0, img: 0, font: 0, api: 0, other: 0 };
    for (const entry of resources) {
        const isApi = entry.name.includes('/api/');
        const key = isApi
            ? 'api'
            : { script: 'js', link: 'css', css: 'css', img: 'img', font: 'font' }[
                  entry.initiatorType
              ] ?? 'other';
        transfer[key] += entry.transferSize || 0;
        count[key] += 1;
    }
    return {
        ttfb: nav.responseStart ?? null,
        domContentLoaded: nav.domContentLoadedEventEnd ?? null,
        loadEvent: nav.loadEventEnd ?? null,
        transfer,
        count,
        requestCount: resources.length,
        vitals: window.__uxVitals ?? { lcp: null, cls: null, fcp: null },
    };
})()`;

// sessionSync가 axios에 싣는 것과 같은 시연 헤더 — 없으면 MSW가 다른 사용자 상태를 읽는다
const TICKETS_EVAL = `fetch('/api/v1/tickets/me', {
    headers: { 'X-User-ID': 'vu-doyoon', 'X-User-Role': 'USER', 'X-User-Membership': 'excellent' },
})
    .then((response) => response.json())
    .then((body) => body?.data?.availableCount ?? null)
    .catch(() => null)`;

// 경로별 준비 완료 마커 — 로딩 완료의 업무적 끝점이다
const LOAD_ROUTES = [
    { path: '/login', ready: 'text=시연용 가상 사용자', authed: false },
    { path: '/', ready: 'main >> nth=0', authed: true, quiet: true },
    { path: '/time-raffle/evt-001', ready: 'button:has-text("응모하기")', authed: true },
    { path: '/missions', ready: 'button:has-text("출석하고")', authed: true },
    {
        path: '/missions/games/0199f000-0000-7000-8000-000000000102',
        ready: 'main >> nth=0',
        authed: true,
        quiet: true,
    },
];

const metric = (value, unit, method, reason) => ({
    value,
    unit,
    method,
    ...(reason ? { reason } : {}),
});
const NODE_CLOCK = 'Node performance.now() — 클릭→selector visible 직렬 계측';

const newContext = async (browser, authed) => {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
    });
    await context.addInitScript(OBSERVER_INIT);
    if (authed) await context.addInitScript(SEED_SESSION);
    return context;
};

const quiet = (page) =>
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

const fetchBalance = (page) => page.evaluate(TICKETS_EVAL);

const loadMetrics = (m, started, markerAt) => ({
    ttfbMs: metric(m.ttfb, 'ms', 'navigation entry responseStart'),
    fcpMs: metric(m.vitals.fcp, 'ms', 'PerformanceObserver paint'),
    lcpMs: metric(m.vitals.lcp, 'ms', 'PerformanceObserver lcp'),
    clsValue: metric(m.vitals.cls, 'score', 'PerformanceObserver layout-shift 누계'),
    loadEventMs: metric(m.loadEvent, 'ms', 'navigation entry loadEventEnd'),
    readyMs: metric(markerAt - started, 'ms', NODE_CLOCK),
    jsTransferBytes: metric(m.transfer.js, 'byte', 'resource timing transferSize'),
    cssTransferBytes: metric(m.transfer.css, 'byte', 'resource timing transferSize'),
    imgTransferBytes: metric(m.transfer.img, 'byte', 'resource timing transferSize'),
    fontTransferBytes: metric(m.transfer.font, 'byte', 'resource timing transferSize'),
    apiTransferBytes: metric(m.transfer.api, 'byte', 'resource timing transferSize'),
    apiRequestCount: metric(m.count.api, 'count', 'resource timing /api/ 경로'),
    requestCount: metric(m.requestCount, 'count', 'resource entries'),
});

const loadOnce = async (page, route) => {
    const started = performance.now();
    await page.goto(`${preview}${route.path}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector(route.ready, { timeout: 30000 }).catch(() => undefined);
    const markerAt = performance.now();
    if (route.quiet) await quiet(page);
    const measured = await page.evaluate(LOAD_EVAL);
    return loadMetrics(measured, started, markerAt);
};

async function collectLoad(browser) {
    const runs = [];
    for (const route of LOAD_ROUTES) {
        for (let index = 0; index < loadCold; index += 1) {
            const context = await newContext(browser, route.authed);
            const page = await context.newPage();
            try {
                runs.push({
                    scenario: `ux-load-${route.path}`,
                    sampleIndex: index,
                    cache: 'cold',
                    status: 'ok',
                    metrics: await loadOnce(page, route),
                });
                // 웜 표본은 각 콜드 context에서 1회씩만 — loadWarm은 총 웜 표본 수다
                if (index < loadWarm) {
                    runs.push({
                        scenario: `ux-load-${route.path}`,
                        sampleIndex: index,
                        cache: 'warm',
                        status: 'ok',
                        metrics: await loadOnce(page, route),
                    });
                }
            } catch (error) {
                runs.push({
                    scenario: `ux-load-${route.path}`,
                    sampleIndex: index,
                    cache: 'cold',
                    status: 'failed',
                    error: String(error?.message ?? error).slice(0, 200),
                    metrics: {},
                });
            }
            await context.close();
        }
    }
    return runs;
}

const click = async (page, locator) => {
    const t = performance.now();
    await locator.click();
    return t;
};
const elapsed = (t) => performance.now() - t;

async function collectAttendance(browser) {
    const runs = [];
    for (let index = 0; index < actSamples; index += 1) {
        const context = await newContext(browser, true);
        const page = await context.newPage();
        try {
            await page.goto(`${preview}/missions`, { waitUntil: 'load', timeout: 60000 });
            const button = page.locator('button:has-text("출석하고")').first();
            await button.waitFor({ state: 'visible', timeout: 30000 });
            await quiet(page);
            const before = await fetchBalance(page);
            const t0 = await click(page, button);
            // 굽기 장면(stageFull)이 버튼을 언마운트하므로 disabled·hidden 어느 쪽이든
            // 클릭이 차단되는 첫 순간을 인터랙션 차단(pending)으로 본다
            let pendingAt = null;
            const pendingDeadline = performance.now() + 3000;
            while (performance.now() < pendingDeadline) {
                // count()는 대기 없이 즉시 반환 — 언마운트 자체가 차단 상태다
                const count = await button.count();
                const blocked = count === 0 || (await button.isDisabled().catch(() => true));
                if (blocked) {
                    pendingAt = performance.now();
                    break;
                }
                await page.waitForTimeout(50);
            }
            await page.waitForSelector('text=출석 확인', { timeout: 15000 });
            const toastAt = performance.now();
            // 잔액 반영 시점 — 토스트는 보상 문구만 알리고, 업무 반영은 잔액 변화로 본다
            let after = before;
            const balanceDeadline = performance.now() + 15000;
            while (performance.now() < balanceDeadline && after === before) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                after = await fetchBalance(page);
            }
            const doneAt = performance.now();
            runs.push({
                scenario: 'ux-act-attendance',
                sampleIndex: index,
                status: 'ok',
                metrics: {
                    clickToPendingMs: metric(
                        pendingAt === null ? null : pendingAt - t0,
                        'ms',
                        `${NODE_CLOCK} — 버튼 disabled/언마운트 첫 순간`,
                        pendingAt === null ? '3초 안에 차단 상태를 관측하지 못함' : undefined,
                    ),
                    clickToToastMs: metric(toastAt - t0, 'ms', NODE_CLOCK),
                    clickToDoneMs: metric(
                        doneAt - t0,
                        'ms',
                        `${NODE_CLOCK} — 굽기 최소 1600ms + 잔액 반영 폴링`,
                    ),
                    balanceBefore: metric(before, 'count', 'MSW /v1/tickets/me availableCount'),
                    balanceAfter: metric(after, 'count', 'MSW /v1/tickets/me availableCount'),
                    businessApplied: metric(
                        before !== null && after !== null ? after - before : null,
                        'count',
                        '잔액 증가량 — 기대 +1',
                    ),
                },
            });
        } catch (error) {
            runs.push({
                scenario: 'ux-act-attendance',
                sampleIndex: index,
                status: 'failed',
                error: String(error?.message ?? error).slice(0, 200),
                metrics: {},
            });
        }
        await context.close();
    }
    return runs;
}

async function collectEnter(browser) {
    const runs = [];
    for (let index = 0; index < actSamples; index += 1) {
        const context = await newContext(browser, true);
        const page = await context.newPage();
        try {
            await page.goto(`${preview}/time-raffle/evt-001`, {
                waitUntil: 'load',
                timeout: 60000,
            });
            const openButton = page.locator('button:has-text("응모하기")').first();
            await openButton.waitFor({ state: 'visible', timeout: 30000 });
            await quiet(page);
            const before = await fetchBalance(page);
            const t0 = await click(page, openButton);
            const dialog = page.locator('[role="dialog"]');
            await dialog.waitFor({ state: 'visible', timeout: 15000 });
            const confirmAt = performance.now();
            const confirm = dialog.locator('button:has-text("응모하기")').first();
            const t1 = await click(page, confirm);
            await page.waitForSelector('text=응모했어요', { timeout: 15000 });
            const completeAt = performance.now();
            let after = before;
            const balanceDeadline = performance.now() + 15000;
            while (performance.now() < balanceDeadline && after === before) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                after = await fetchBalance(page);
            }
            const balanceAt = performance.now();
            runs.push({
                scenario: 'ux-act-enter',
                sampleIndex: index,
                status: 'ok',
                metrics: {
                    clickToConfirmDialogMs: metric(confirmAt - t0, 'ms', NODE_CLOCK),
                    confirmToCompleteMs: metric(completeAt - t1, 'ms', NODE_CLOCK),
                    totalMs: metric(completeAt - t0, 'ms', NODE_CLOCK),
                    clickToBalanceMs: metric(
                        balanceAt - t0,
                        'ms',
                        `${NODE_CLOCK} — 잔액 fetch 변화 폴링`,
                    ),
                    balanceBefore: metric(before, 'count', 'MSW /v1/tickets/me availableCount'),
                    balanceAfter: metric(after, 'count', 'MSW /v1/tickets/me availableCount'),
                    businessApplied: metric(
                        before !== null && after !== null ? after - before : null,
                        'count',
                        '잔액 변화량 — 기대 -1',
                    ),
                },
            });
        } catch (error) {
            runs.push({
                scenario: 'ux-act-enter',
                sampleIndex: index,
                status: 'failed',
                error: String(error?.message ?? error).slice(0, 200),
                metrics: {},
            });
        }
        await context.close();
    }
    return runs;
}

async function collectTransition(browser) {
    const runs = [];
    for (let index = 0; index < actSamples; index += 1) {
        const context = await newContext(browser, true);
        const page = await context.newPage();
        try {
            await page.goto(`${preview}/`, { waitUntil: 'load', timeout: 60000 });
            const link = page.locator('a[href^="/time-raffle/"], a[href^="/events/"]').first();
            await link.waitFor({ state: 'visible', timeout: 30000 });
            await quiet(page);
            // performance entries diff — 캐시·프리페치 적중은 새 요청으로 세지 않는다
            const baseCount = await page.evaluate(
                `performance.getEntriesByType('resource').length`,
            );
            const t0 = await click(page, link);
            await page.waitForURL((url) => url.pathname !== '/', { timeout: 15000 });
            await quiet(page);
            const doneAt = performance.now();
            const newJs = await page.evaluate(
                `performance.getEntriesByType('resource')
                    .slice(${baseCount})
                    .filter((e) => e.name.endsWith('.js'))
                    .map((e) => ({ transfer: e.transferSize, encoded: e.encodedBodySize }))`,
            );
            runs.push({
                scenario: 'ux-act-transition',
                sampleIndex: index,
                cache: 'cold-context',
                status: 'ok',
                metrics: {
                    clickToDetailMs: metric(doneAt - t0, 'ms', NODE_CLOCK),
                    newJsFetchCount: metric(
                        newJs.length,
                        'count',
                        '클릭 후 performance entries에 새로 나타난 .js (캐시·프리페치 적중 제외)',
                    ),
                    newJsEncodedBytes: metric(
                        newJs.reduce((sum, e) => sum + e.encoded, 0),
                        'byte',
                        'encodedBodySize 합계 — SW 경유 시 0 관측 가능',
                    ),
                },
            });
        } catch (error) {
            runs.push({
                scenario: 'ux-act-transition',
                sampleIndex: index,
                cache: 'cold-context',
                status: 'failed',
                error: String(error?.message ?? error).slice(0, 200),
                metrics: {},
            });
        }
        await context.close();
    }
    return runs;
}

const collectors = {
    load: collectLoad,
    'act-attendance': collectAttendance,
    'act-enter': collectEnter,
    'act-transition': collectTransition,
};

// GD-262와 동일 채널 — 설치된 시스템 Chrome을 그대로 구동한다 (chromium 다운로드 없음)
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const runs = [];
for (const name of only) {
    if (!collectors[name]) throw new Error(`알 수 없는 시나리오: ${name}`);
    process.stdout.write(`[collect] ${name} 시작\n`);
    runs.push(...(await collectors[name](browser)));
    process.stdout.write(`[collect] ${name} 완료 — 누적 ${runs.length} runs\n`);
}
await browser.close();

const result = {
    collectedAt: new Date().toISOString(),
    collector: 'scripts/measureUxEvidence.mjs',
    condition: {
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        node: process.version,
        os: `${platform()} ${release()}`,
        cpu: cpus()[0]?.model ?? null,
        memoryBytes: totalmem(),
        freeMemoryBytes: freemem(),
        playwrightSource,
        browser: 'system Chrome (playwright channel: chrome) headless',
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        cpuThrottle: 'none',
        network: 'loopback, 제한 없음',
        buildMode: 'production + MSW 활성 (VITE_API_BASE_URL=/api, VITE_ENABLE_MSW=true)',
        environment: 'local-mock (MSW, 실서버 호출 0건)',
        accountRole: 'USER (vu-doyoon 익명 별칭)',
        preview,
        notes: [
            'MSW 서비스워커 경유 응답은 resource timing의 transferSize가 0으로 관측된다 — byte 지표는 하한선이다',
            'interaction 시나리오의 잔액은 페이지 컨텍스트 fetch + 시연 헤더로 읽은 MSW 상태다 (HTTP 송신 수와 별개)',
        ],
    },
    runs,
};
mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
const ok = runs.filter((run) => run.status === 'ok').length;
process.stdout.write(`완료 — ${ok}/${runs.length} ok → ${outPath}\n`);
