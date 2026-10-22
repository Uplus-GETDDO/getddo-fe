// GD-268 재측정 — 읽기 전용. 어떤 쓰기 요청도 보내지 않는다.
// fix/GD-268 머지·배포 후 관리자 이벤트의 drawScheduledAt - endsAt = 60초를 다시 확인한다.
// verifyL6RemainingReads.mjs의 GD-268 블록과 같은 방식이며, 실제 추첨 실행 지연은
// 스케줄러 처리 특성상 생길 수 있어 판정 대상이 아니다 — drawScheduledAt 값 자체만 본다.
// 실행: L6_DEPLOY_URL=<배포 루트 또는 .../api/v1> node scripts/verifyGd268Schedule.mjs [증거 파일]
// 환경변수: L6_DEPLOY_URL 필수 — 기본 대상이 없어 운영을 향한 오실행이 불가능하다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(source) {
    const file = path.resolve(source);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(
        (name) =>
            name.startsWith('.')
                ? load(path.resolve(path.dirname(file), name + '.ts'))
                : require(name),
        module,
        module.exports,
    );
    return module.exports;
}

const eventAdmin = load('src/entities/event/model/adminTypes.ts');

const deployUrl = process.env.L6_DEPLOY_URL;
if (!deployUrl)
    throw new Error(
        'L6_DEPLOY_URL 환경변수가 필요합니다 (예: https://<배포> 또는 https://<배포>/api/v1).',
    );
const ROOT = deployUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
const BASE = `${ROOT}/api/v1`;
const ADMIN = '01a14280-f677-7a0a-a066-5553d7344fd2';

const [outputArg] = process.argv.slice(2);
const output = outputArg ?? 'reports/20261023-gd268-drawscheduledat.json';
// 매 실행 새 레코드로 시작한다 — 이전 실행의 at·target이 섞이지 않게 한다
const evidence = {
    at: new Date().toISOString(),
    kind: 'GD-268 drawScheduledAt 재측정 — fix/GD-268 머지·배포 후',
    target: ROOT,
    checks: [],
};
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
const push = (check) => {
    evidence.checks.push(check);
    save();
    console.log(JSON.stringify(check, null, 2));
};

// 읽기 전용 — method는 GET으로 고정해 쓰기 오실행을 구조적으로 막는다.
async function get(url) {
    const started = performance.now();
    const at = new Date().toISOString();
    let response;
    try {
        response = await fetch(BASE + url, {
            method: 'GET',
            headers: {
                'X-User-ID': ADMIN,
                'X-User-Role': 'ADMIN',
            },
            signal: AbortSignal.timeout(30000),
        });
    } catch (error) {
        // 네트워크 실패·타임아웃도 증거에 남긴다 — reject된 호출이 무기록으로 사라지지 않게 한다
        return {
            method: 'GET',
            path: url,
            status: 0,
            envelopeCode: null,
            at,
            ms: Math.round(performance.now() - started),
            json: null,
            body: null,
            error: String(error).slice(0, 200),
        };
    }
    const ms = Math.round(performance.now() - started);
    const text = await response.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        /* 봉투가 아닌 응답 */
    }
    return {
        method: 'GET',
        path: url,
        status: response.status,
        envelopeCode: json?.code ?? null,
        at,
        ms,
        json,
        body: json?.data ?? json,
    };
}

// Zod 검증 결과만 기록한다 — 실패하면 항목을 숨기지 않고 오류를 남긴다.
function zodCheck(schema, json) {
    try {
        schema.parse(json);
        return 'pass';
    } catch (error) {
        return `fail: ${String(error?.issues?.[0]?.message ?? error).slice(0, 200)}`;
    }
}

// 증거에는 호출 메타와 정제된 필드만 남긴다 — 원시 응답(json/body)은 저장하지 않는다.
const meta = ({ json, body, ...rest }) => rest;

async function run() {
    // ── 배포 식별 — index.html의 entry chunk 이름을 배포 버전 근거로 남긴다 ──
    const page = await fetch(ROOT || '/', { signal: AbortSignal.timeout(30000) })
        .then(async (r) => ({
            status: r.status,
            text: await r.text(),
        }))
        .catch((error) => ({ status: 0, text: '', error: String(error).slice(0, 200) }));
    const entryChunk = page.text.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[0] ?? null;
    push({
        name: '배포 식별(엔트리 청크)',
        method: 'GET',
        path: '/',
        status: page.status,
        at: new Date().toISOString(),
        entryChunk,
        ...(page.error ? { error: page.error } : {}),
    });

    // ── GD-268 drawScheduledAt — 이벤트별 endsAt 대비 델타(초) 측정 ──
    const events = await get('/admin/events?page=1&size=50&sort=endsAt,desc');
    const eventItems = events.body?.items ?? [];
    // 마감 시각 최신순으로 정렬해 상위 15건만 상세 조회한다 — 호출 수를 제한한다.
    const recent = [...eventItems]
        .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))
        .slice(0, 15);
    const deltas = [];
    for (const e of recent) {
        const detail = await get(`/admin/events/${e.id}`);
        const d = detail.body;
        const deltaSec =
            d?.drawScheduledAt && d?.endsAt
                ? Math.round((Date.parse(d.drawScheduledAt) - Date.parse(d.endsAt)) / 1000)
                : null;
        deltas.push({
            eventId: e.id,
            title: e.title,
            status: d?.status ?? e.status,
            endsAt: d?.endsAt ?? e.endsAt,
            drawScheduledAt: d?.drawScheduledAt ?? null,
            deltaSeconds: deltaSec,
            zod: zodCheck(eventAdmin.adminEventSchema, detail.json?.data ?? detail.json),
            // 호출 단위 증거 — 어느 경로를 언제 쳤는지 집계와 함께 남긴다.
            method: detail.method,
            path: detail.path,
            httpStatus: detail.status,
            at: detail.at,
        });
    }
    const passed =
        page.status === 200 &&
        entryChunk !== null &&
        events.status === 200 &&
        deltas.length > 0 &&
        deltas.every((d) => d.deltaSeconds === 60 && d.zod === 'pass' && d.httpStatus === 200);
    push({
        name: 'GD-268 drawScheduledAt 델타 (마감+1분=60초 기대)',
        ...meta(events),
        listStatus: events.status,
        measured: deltas.length,
        deltas,
        summary: {
            plus60: deltas.filter((d) => d.deltaSeconds === 60).length,
            plus300: deltas.filter((d) => d.deltaSeconds === 300).length,
            other: deltas.filter((d) => d.deltaSeconds !== 60 && d.deltaSeconds !== 300).length,
        },
        verdict: passed ? 'pass' : 'fail',
    });
    if (!passed) {
        console.error('GD-268 재측정 실패 — 증거 JSON의 deltas를 확인한다');
        process.exitCode = 1;
    }
}

await run();
console.log(`\n증거 기록: ${output} (${evidence.checks.length} checks)`);
