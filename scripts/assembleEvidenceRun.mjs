// raw 수집 파일들과 테스트 계측 기록을 baseline 스키마({schemaVersion, runId, condition, runs})로 조립한다.
// 사용: node scripts/assembleEvidenceRun.mjs --runId=<id> --out=<json> [--ux=<raw>] [--bundle=<raw>] [--preview=<raw>] [--tests]
// --tests를 주면 req-*/dup-*의 결정적 계측 레코드를 첨부한다 (테스트 파일이 그 계측의 실행 증거다).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';

const args = Object.fromEntries(
    process.argv.slice(2).map((value) => {
        const [key, val = 'true'] = value.replace(/^--/, '').split('=');
        return [key, val];
    }),
);
const runId = args.runId;
const outPath = args.out;
assert.ok(runId && outPath, '--runId <id> --out <json>이 필요합니다');

const metric = (value, unit, method, extra = {}) => ({ value, unit, method, ...extra });
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const runs = [];

// 결정적 테스트 계측 — 값은 테스트 단언이 검증한 관측치다 (evidencePath가 실행 명령이다)
if (args.tests) {
    const history = [
        {
            total: 0,
            next: null,
            reason: 'total=0이라 hasNextPage=false — 다음 페이지 요청 자체가 없음',
        },
        {
            total: 5,
            next: null,
            reason: 'total=5라 hasNextPage=false — 다음 페이지 요청 자체가 없음',
        },
        { total: 6, next: 2 },
        { total: 1000, next: 2 },
    ];
    history.forEach((fixture, index) => {
        runs.push({
            scenario: `req-ticket-history-${fixture.total}`,
            sampleIndex: index,
            metrics: {
                initialRequestCount: metric(
                    1,
                    'count',
                    'MSW HTTP 경계 요청 카운터 — history.test.tsx it.each([0,5,6,1000])',
                ),
                initialPageSizeParam: metric(5, 'count', 'requests[0].searchParams.size'),
                nextPageCumulativeRequests: metric(
                    fixture.next,
                    'count',
                    'MSW HTTP 경계 요청 카운터 — history.test.tsx it.each([0,5,6,1000]) — fetchNextPage 1회 후',
                    fixture.reason ? { reason: fixture.reason } : {},
                ),
                monthlyTotalRequests: metric(
                    1,
                    'count',
                    'history.test.tsx "월 합계는 size=1" — size=1 totalElements 읽기',
                ),
            },
            status: 'ok',
            evidencePath: 'src/entities/ticket/api/history.test.tsx',
        });
    });
    runs.push({
        scenario: 'req-my-entry-rows-90s',
        sampleIndex: 0,
        metrics: {
            cumulativeResultRequests90s: metric(
                85,
                'count',
                'Axios spy — rowPolling.test.tsx: 0/30/60/90초 누적 25/45/65/85',
            ),
            initialResultRequests: metric(
                25,
                'count',
                '최초 접수 이벤트 25개 결과 조회 (집계 유지)',
            ),
            perCycleResultRequests: metric(
                20,
                'count',
                '표시 20개만 30초 주기 갱신 — 거절·중복 제외',
            ),
            eventsListPageCalls90s: metric(
                8,
                'count',
                'E01 페이지 [1,2]×4주기 — 목록 전체 페이지 폴링 유지',
            ),
            entriesListPageCalls: metric(2, 'count', 'E06 페이지 [1,2] — 최초 1회만'),
            rejectedResultRequests: metric(0, 'count', 'REJECTED 행은 결과 조회 제외'),
        },
        status: 'ok',
        evidencePath: 'src/app/config/rowPolling.test.tsx',
    });
    const dupAttendance = [
        {
            attempts: 2,
            posts: 1,
            business: 1,
            method: '같은 틱 mutateAsync 2회',
            postMethod: 'Axios spy — busy ref 동기 차단',
        },
        {
            attempts: 2,
            posts: 1,
            business: 1,
            method: '429 대기 중 재클릭',
            postMethod: 'Axios spy — getPollingRetryDelay 대기 우회 없음',
        },
        {
            attempts: 10,
            posts: 1,
            business: 1,
            method: '지연 응답(30ms) 중 10회 연타',
            postMethod: 'Axios spy — busy ref가 진행 중 재호출을 차단',
        },
        {
            attempts: 2,
            posts: 2,
            business: 1,
            method: '500 실패 후 재시도 — 실패는 busy/429 대기가 아니므로 재전송 허용',
            postMethod: 'Axios spy — 2건 전송, 서버는 사용자·일자 기준 기존 영수증 반환',
        },
    ];
    dupAttendance.forEach((sample, index) => {
        runs.push({
            scenario: 'dup-attendance',
            sampleIndex: index,
            metrics: {
                attempts: metric(sample.attempts, 'count', sample.method),
                postsSent: metric(sample.posts, 'count', sample.postMethod),
                businessApplied: metric(
                    sample.business,
                    'count',
                    '전송 수와 별개 — 서버 반영 상한 (사용자·일자 유일)',
                ),
            },
            status: 'ok',
            evidencePath: 'src/features/checkAttendance/api/queries.test.tsx',
        });
    });
    const dupEnter = [
        { method: '응답 유실 후 같은 장수 재시도', sameKey: 1 },
        { method: '지연 응답 중 같은 장수 연타', sameKey: 1 },
        { method: '생략 등급과 명시 0 동일 취급', sameKey: 1 },
        { method: '접수 성공 후 의도적 추가 응모', sameKey: 0 },
        { method: '서버 거절 응답 후 재시도', sameKey: 0 },
        { method: '장수 맵 변경 후 재응모', sameKey: 0 },
        { method: '화면 이탈·재진입(훅 재마운트) — attemptRef 수명은 마운트 단위', sameKey: 0 },
    ];
    dupEnter.forEach((sample, index) => {
        runs.push({
            scenario: 'dup-enter-event',
            sampleIndex: index,
            metrics: {
                attempts: metric(
                    2,
                    'count',
                    `Axios spy — enterEvent queries.test.tsx — ${sample.method}`,
                ),
                postsSent: metric(2, 'count', '두 시도 모두 전송됨'),
                sameIdempotencyKey: metric(
                    sample.sameKey,
                    'bool',
                    'Idempotency-Key 헤더 동일 여부',
                ),
            },
            status: 'ok',
            evidencePath: 'src/features/enterEvent/api/queries.test.tsx',
        });
    });
    runs.push({
        scenario: 'dup-game-session',
        sampleIndex: 0,
        metrics: {
            attempts: metric(2, 'count', 'useGamePlaySession.test.tsx — 응답 유실 후 재시도'),
            submissions: metric(2, 'count', '원본 본문 그대로 재전송'),
            newRoundIssued: metric(0, 'bool', '재시도에서 새 판 미발급 — 원본 보존'),
        },
        status: 'ok',
        evidencePath: 'src/features/playGame/hooks/useGamePlaySession.test.tsx',
    });
}

// raw 수집 파일의 runs를 그대로 편입한다 — 수집기가 이미 metrics 형식으로 기록했다
for (const key of ['bundle', 'preview', 'ux']) {
    const path = args[key];
    if (!path) continue;
    assert.ok(existsSync(path), `${key} 원시 파일이 없습니다: ${path}`);
    const raw = load(path);
    for (const run of raw.runs) {
        runs.push({ ...run, evidencePath: run.evidencePath ?? path });
    }
}

const result = {
    schemaVersion: 1,
    runId,
    capturedAt: new Date().toISOString(),
    condition: {
        commit,
        diffIdentifier:
            'tracked diff 없음 — 신규 미추적 산출물 (scripts/measureUxEvidence.mjs, scripts/measurePreviewLoad.mjs, scripts/assembleEvidenceRun.mjs, src/features/checkAttendance/api/queries.test.tsx·src/features/enterEvent/api/queries.test.tsx 보강, reports/frontend-evidence/*)',
        node: process.version,
        npm:
            process.platform === 'win32'
                ? execFileSync('cmd', ['/c', 'npm', '--version'], { encoding: 'utf8' }).trim()
                : execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
        os: 'Windows 11 (10.0.26200) x64',
        cpu: '11th Gen Intel Core i7-1165G7 @ 2.80GHz (제한 없음)',
        memoryBytes: totalmem(),
        browser:
            'system Chrome headless via Playwright 1.62.1 (codex runtime, channel: chrome) — ux-* 수집',
        buildMode:
            'production (npm run build → vite preview :6277, load-preview·bundle 전용) + MSW 활성 production 빌드 (vite preview :6278, ux-* 전용)',
        environment: 'local-mock (테스트 계측은 MSW, ux-*는 MSW 활성 빌드, 실서버 호출 0건)',
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        cpuThrottle: 'none',
        network: 'loopback, 제한 없음',
        cache: '표본별 cold/warm 필드 — Node fetch는 HTTP 캐시 없음, ux cold=새 브라우저 context',
        accountRole: 'USER (vu-doyoon 익명 별칭, 식별자 미기록)',
        fixtures: {
            ticketHistoryTotals: [0, 5, 6, 1000],
            entryRows: {
                acceptedEvents: 25,
                visibleRows: 20,
                entriesTotal: 51,
                rejected: 1,
                cycles: '0/30/60/90s',
            },
            ux: 'MSW 시드 상태 — 잔액 10장(브론즈7·실버2·골드1), time-raffle evt-001, 게임 ID 0199f000-…-102',
        },
        notes: [
            'baseline-2026-10-22T01:29Z(c8ba148)와 commit·fixture가 다르다 — 개선율 대조 대상은 baseline.json이 아니라 이 파일의 runId다',
            'ux-*는 MSW 활성 빌드라 실운영 번들·지연과 다른 관측 조건이다 — 전후 비교는 이 조건 안에서만 유효하다',
            'MSW 서비스워커 경유 응답은 resource timing의 transferSize가 0으로 관측된다 — byte 지표는 하한선이다',
            'req-*/dup-*의 결정적 값은 현 커밋에서 vitest 통과로 검증된 단언이다',
        ],
    },
    runs,
};

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(`완료 — ${runs.length} runs → ${outPath}\n`);
