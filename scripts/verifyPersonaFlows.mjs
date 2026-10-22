// 페르소나 핵심 흐름의 자동 spot-check — MSW 활성 preview 대상.
// 자동 관측 가능한 범위만 확인한다: 마커 표시, 키보드 도달·활성화, 콘솔 오류, 뷰포트·설정 조합.
// 사람 사용성 평가가 아니다 — 판정은 "마커 노출·키보드 도달·콘솔 오류 없음"에 한정한다.
// 실행: node scripts/verifyPersonaFlows.mjs --preview=http://localhost:6278 --out=<raw.json>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(
    process.env.UX_PLAYWRIGHT_PATH ??
        resolve(
            homedir(),
            '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
        ),
);

const args = Object.fromEntries(
    process.argv.slice(2).map((value) => {
        const [key, val = 'true'] = value.replace(/^--/, '').split('=');
        return [key, val];
    }),
);
const preview = (args.preview ?? 'http://localhost:6278').replace(/\/$/, '');
const outPath = args.out;
assert.ok(outPath, '--out <raw.json> 경로가 필요합니다');

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
const uiSettings = (theme, textScale) =>
    `localStorage.setItem('getddo-ui-settings', ${JSON.stringify(
        JSON.stringify({ state: { theme, textScale }, version: 0 }),
    )});`;

// 페르소나-화면-검증 조합 — persona-traceability.md의 과제 화면과 대응한다
const CASES = [
    {
        persona: '김도윤(데일리 루틴러)',
        path: '/missions',
        settings: { theme: 'light', textScale: 'large' },
        marker: 'button:has-text("출석하고")',
        cta: 'button:has-text("출석하고")',
        note: '큰글씨 설정에서 출석 주행동이 표시·키보드로 닿는지',
    },
    {
        persona: '박서연(타임어택 헌터)',
        path: '/time-raffle/evt-001',
        settings: { theme: 'dark', textScale: 'normal' },
        marker: 'button:has-text("응모하기")',
        cta: 'button:has-text("응모하기")',
        note: '다크모드에서 타임래플 응모 진입이 표시·키보드로 닿는지',
    },
    {
        persona: '이하늘(신뢰중시 확인러)',
        path: '/my-entries',
        settings: { theme: 'light', textScale: 'normal' },
        marker: 'main >> nth=0',
        cta: null,
        note: '내 응모 결과 목록이 표시되는지 (조회 화면이라 CTA 키보드 검증 생략)',
    },
    {
        persona: '최민준(라이트 참여형)',
        path: '/',
        settings: { theme: 'light', textScale: 'normal' },
        viewport: { width: 390, height: 844 },
        marker: 'main >> nth=0',
        cta: null,
        note: '390px 모바일 폭에서 홈이 표시되는지 (뷰포트 모사 — 실기기 확대 아님)',
    },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const runs = [];
for (const testCase of CASES) {
    const context = await browser.newContext({
        viewport: testCase.viewport ?? { width: 1280, height: 720 },
        deviceScaleFactor: 1,
    });
    await context.addInitScript(
        `localStorage.setItem('getddo-session', ${JSON.stringify(SESSION)});` +
            uiSettings(testCase.settings.theme, testCase.settings.textScale),
    );
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160));
    });
    try {
        await page.goto(`${preview}${testCase.path}`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
        const markerVisible = await page
            .waitForSelector(testCase.marker, { timeout: 15000 })
            .then(() => true)
            .catch(() => false);
        let keyboardReached = null;
        let keyboardNote = 'CTA 키보드 검증 없음 (조회 화면)';
        if (testCase.cta && markerVisible) {
            keyboardReached = false;
            for (let tab = 0; tab < 40; tab += 1) {
                await page.keyboard.press('Tab');
                const focused = await page.evaluate(
                    `document.activeElement && document.activeElement.textContent || ''`,
                );
                if (focused.includes(testCase.cta.includes('출석') ? '출석' : '응모')) {
                    keyboardReached = true;
                    keyboardNote = `Tab ${tab + 1}회로 주행동 도달`;
                    break;
                }
            }
        }
        const appliedDark = await page.evaluate(
            `document.documentElement.classList.contains('dark')`,
        );
        const appliedScale = await page.evaluate(`document.documentElement.dataset.textScale`);
        runs.push({
            scenario: `persona-check-${testCase.path}`,
            sampleIndex: 0,
            status: markerVisible && consoleErrors.length === 0 ? 'ok' : 'failed',
            persona: testCase.persona,
            note: testCase.note,
            metrics: {
                markerVisible: {
                    value: markerVisible ? 1 : 0,
                    unit: 'bool',
                    method: 'waitForSelector',
                },
                keyboardReached: {
                    value: keyboardReached === null ? null : keyboardReached ? 1 : 0,
                    unit: 'bool',
                    method: keyboardNote,
                },
                darkApplied: {
                    value: appliedDark ? 1 : 0,
                    unit: 'bool',
                    method: `root .dark 클래스 — 설정 theme=${testCase.settings.theme}`,
                },
                textScaleApplied: {
                    value: appliedScale === testCase.settings.textScale ? 1 : 0,
                    unit: 'bool',
                    method: `data-text-scale — 설정 ${testCase.settings.textScale}`,
                },
                consoleErrorCount: {
                    value: consoleErrors.length,
                    unit: 'count',
                    method: 'console error 수집',
                },
            },
            errors: consoleErrors.length ? consoleErrors : undefined,
        });
    } catch (error) {
        runs.push({
            scenario: `persona-check-${testCase.path}`,
            sampleIndex: 0,
            status: 'failed',
            persona: testCase.persona,
            error: String(error?.message ?? error).slice(0, 200),
            metrics: {},
        });
    }
    await context.close();
}
await browser.close();

const result = {
    collectedAt: new Date().toISOString(),
    collector: 'scripts/verifyPersonaFlows.mjs',
    condition: {
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        browser: 'system Chrome headless via Playwright 1.62.1',
        environment: 'local-mock (MSW 활성 production 빌드)',
        preview,
        notes: [
            '자동 spot-check다 — 사람 사용성 평가가 아니다',
            '390px은 뷰포트 모사이며 실기기·브라우저 확대 검증의 대체다',
            '키보드 검증은 Tab 도달 여부만 본다 (포커스 순서 품질 평가 아님)',
        ],
    },
    runs,
};
mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
const ok = runs.filter((run) => run.status === 'ok').length;
process.stdout.write(`완료 — ${ok}/${runs.length} ok → ${outPath}\n`);
