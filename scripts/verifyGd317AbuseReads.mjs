// GD-317 AR01/AR02 배포 후 실측 — 읽기 전용. 어떤 쓰기 요청도 보내지 않는다.
// 실행: L6_DEPLOY_URL=https://<배포> node scripts/verifyGd317AbuseReads.mjs [증거 파일]
// 측정: AR01 목록 Zod·정렬·필터·빈 결과, AR02 상세+evidence 계약 대조,
//       업무 오류 ABUSE-001(403)·ABUSE-002(404), 공통 오류 COMMON-002/005·USER-003.
// 환경변수: L6_DEPLOY_URL 필수 (배포 루트 또는 .../api/v1) — 기본 대상이 없어
// 운영을 향한 오실행이 불가능하다.
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

const { envelopeSchema, pageSchema } = load('src/shared/api/envelopeSchema.ts');
const abuseCase = load('src/entities/abuseCase/model/types.ts');

const deployUrl = process.env.L6_DEPLOY_URL;
if (!deployUrl)
    throw new Error(
        'L6_DEPLOY_URL 환경변수가 필요합니다 (예: https://<배포> 또는 https://<배포>/api/v1).',
    );
const ROOT = deployUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
const BASE = `${ROOT}/api/v1`;
const ADMIN = '01a14280-f677-7a0a-a066-5553d7344fd2';
const USER = '01a14280-f678-7617-9364-6b79d2dcbef2';

const [outputArg] = process.argv.slice(2);
const output = outputArg ?? 'reports/20261023-gd317-abuse-reads.json';
const evidence = {
    at: new Date().toISOString(),
    kind: 'GD-317 AR01/AR02 배포 후 실측 — 읽기 전용',
    target: ROOT,
    checks: [],
};
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
const push = (check) => {
    evidence.checks.push(check);
    save();
    process.stdout.write(`${JSON.stringify(check, null, 2)}\n`);
};

// 읽기 전용 — method는 GET으로 고정해 쓰기 오실행을 구조적으로 막는다.
// role: 'ADMIN'이면 관리자 문맥, 'USER'면 일반 사용자 문맥(ABUSE-001 대조용),
// 'NONE'이면 헤더 자체를 생략한다(USER-003 대조용).
async function get(url, { role = 'ADMIN' } = {}) {
    const started = performance.now();
    const headers =
        role === 'NONE'
            ? {}
            : role === 'ADMIN'
              ? { 'X-User-ID': ADMIN, 'X-User-Role': 'ADMIN' }
              : {
                    'X-User-ID': USER,
                    'X-User-Role': 'USER',
                    'X-User-Membership': 'excellent',
                };
    const response = await fetch(BASE + url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
    });
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
        message: json?.message ?? null,
        at: new Date().toISOString(),
        ms,
        json,
        body: json?.data ?? null,
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

// 실서버 데이터라도 커밋되는 증거에는 계정 식별 정보를 남기지 않는다.
const REDACTED = '[REDACTED]';
const redactUserIdPath = (requestPath) =>
    requestPath.replace(/([?&]userId=)[^&]+/g, `$1${encodeURIComponent(REDACTED)}`);

// 증거에는 호출 메타와 정제된 필드만 남긴다 — 원시 응답(json/body/text)은 저장하지 않고,
// 경로의 userId 쿼리 값도 마스킹한다.
const meta = ({ json, body, text, path: requestPath, ...rest }) => ({
    ...rest,
    path: redactUserIdPath(requestPath),
});

// 목록 항목은 계약 대조에 필요한 필드와 존재 여부만 남긴다 — userId·사유 원문과 닉네임은 기록하지 않는다.
const summarizeItem = (item) => ({
    id: item.id,
    userId: REDACTED,
    eventId: item.eventId,
    eventTitle: item.eventTitle,
    sourceType: item.sourceType,
    detectionType: item.detectionType,
    detectionReason: REDACTED,
    blockedAt: item.blockedAt,
    blockedUntil: item.blockedUntil,
    hasUserNickname: typeof item.userNickname === 'string' && item.userNickname.length > 0,
});

// 기본 정렬 blockedAt DESC, id DESC를 표본으로 검증한다.
function checkDefaultSort(items) {
    for (let i = 1; i < items.length; i += 1) {
        const prev = items[i - 1];
        const cur = items[i];
        const pAt = Date.parse(prev.blockedAt);
        const cAt = Date.parse(cur.blockedAt);
        if (pAt < cAt || (pAt === cAt && prev.id < cur.id)) {
            return { pass: false, at: i, prev: prev.blockedAt, cur: cur.blockedAt };
        }
    }
    return { pass: true, compared: Math.max(0, items.length - 1) };
}

async function run() {
    // ── 배포 식별 — index.html의 entry chunk 이름을 배포 버전 근거로 남긴다 ──
    const page = await fetch(ROOT || '/', { signal: AbortSignal.timeout(30000) }).then(
        async (r) => ({ status: r.status, text: await r.text() }),
    );
    const chunk = page.text.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[0] ?? null;
    push({
        name: '배포 식별(엔트리 청크)',
        method: 'GET',
        path: '/',
        status: page.status,
        at: new Date().toISOString(),
        entryChunk: chunk,
    });

    // ── AR01 전체 목록 — 200 + Zod + 기본 정렬 ──
    const list = await get('/admin/abuse-cases?page=1&size=20');
    const items = list.body?.items ?? [];
    push({
        ...meta(list),
        name: 'AR01 차단 이력 목록',
        zod: zodCheck(envelopeSchema(pageSchema(abuseCase.abuseCaseSchema)), list.json),
        totalElements: list.body?.totalElements ?? null,
        page: list.body?.page ?? null,
        size: list.body?.size ?? null,
        sortCheck: checkDefaultSort(items),
        items: items.map(summarizeItem),
    });

    // ── AR01 필터 — userId·sourceType·from/to 각각 계약대로 좁히는지 ──
    if (items.length > 0) {
        const first = items[0];
        const byUser = await get(`/admin/abuse-cases?page=1&size=20&userId=${first.userId}`);
        const userItems = byUser.body?.items ?? [];
        push({
            ...meta(byUser),
            name: 'AR01 userId 필터',
            zod: zodCheck(envelopeSchema(pageSchema(abuseCase.abuseCaseSchema)), byUser.json),
            filteredUserId: REDACTED,
            totalElements: byUser.body?.totalElements ?? null,
            allMatchUser: userItems.every((i) => i.userId === first.userId),
        });

        const byType = await get('/admin/abuse-cases?page=1&size=20&sourceType=ENTRY');
        push({
            ...meta(byType),
            name: 'AR01 sourceType=ENTRY 필터',
            zod: zodCheck(envelopeSchema(pageSchema(abuseCase.abuseCaseSchema)), byType.json),
            totalElements: byType.body?.totalElements ?? null,
            allEntry: (byType.body?.items ?? []).every((i) => i.sourceType === 'ENTRY'),
        });

        // [from,to)는 blockedAt 기준 — 첫 항목의 차단 시각만 포함하는 좁은 구간과
        // 그 구간을 빠뜨리는 구간으로 포함·제외를 함께 본다.
        const at = Date.parse(first.blockedAt);
        const narrow = await get(
            `/admin/abuse-cases?page=1&size=20` +
                `&from=${encodeURIComponent(new Date(at - 60_000).toISOString())}` +
                `&to=${encodeURIComponent(new Date(at + 60_000).toISOString())}`,
        );
        const excluded = await get(
            `/admin/abuse-cases?page=1&size=20` +
                `&from=${encodeURIComponent(new Date(at + 120_000).toISOString())}` +
                `&to=${encodeURIComponent(new Date(at + 180_000).toISOString())}`,
        );
        push({
            ...meta(narrow),
            name: 'AR01 from/to 기간 필터 (blockedAt [from,to))',
            zod: zodCheck(envelopeSchema(pageSchema(abuseCase.abuseCaseSchema)), narrow.json),
            windowContains: (narrow.body?.items ?? []).some((i) => i.id === first.id),
            excludedStatus: excluded.status,
            excludedContains: (excluded.body?.items ?? []).some((i) => i.id === first.id),
            excludedEmpty: (excluded.body?.items ?? []).length === 0,
        });
    }

    // ── AR01 빈 결과는 오류가 아니라 200 + 빈 items다 ──
    const empty = await get(
        '/admin/abuse-cases?page=1&size=20&userId=00000000-0000-4000-8000-000000000000',
    );
    push({
        ...meta(empty),
        name: 'AR01 결과 없음 → 200 빈 items',
        zod: zodCheck(envelopeSchema(pageSchema(abuseCase.abuseCaseSchema)), empty.json),
        totalElements: empty.body?.totalElements ?? null,
        itemCount: empty.body?.items?.length ?? null,
    });

    // ── AR01 입력 오류 — 계약상 COMMON-002(범위·필터)·COMMON-005(형식) ──
    const badSize = await get('/admin/abuse-cases?page=1&size=0');
    const badSource = await get('/admin/abuse-cases?page=1&size=20&sourceType=GAME');
    const badUuid = await get('/admin/abuse-cases?page=1&size=20&userId=not-a-uuid');
    push({
        name: 'AR01 입력 오류 대조',
        pass:
            badSize.status === 400 &&
            badSize.envelopeCode === 'COMMON-002' &&
            badSource.status === 400 &&
            badSource.envelopeCode === 'COMMON-002' &&
            badUuid.status === 400 &&
            badUuid.envelopeCode === 'COMMON-005',
        size0: { status: badSize.status, code: badSize.envelopeCode },
        sourceTypeGame: { status: badSource.status, code: badSource.envelopeCode },
        userIdMalformed: { status: badUuid.status, code: badUuid.envelopeCode },
        expected: '400 COMMON-002 (size·sourceType) / 400 COMMON-005 (UUID 형식)',
    });

    // ── AR02 상세 — 200 + evidence 계약 대조 ──
    if (items.length > 0) {
        const detail = await get(`/admin/abuse-cases/${items[0].id}`);
        const d = detail.body;
        push({
            ...meta(detail),
            name: 'AR02 차단 이력 상세 + evidence',
            zod: zodCheck(envelopeSchema(abuseCase.abuseCaseDetailSchema), detail.json),
            caseId: items[0].id,
            summary: d ? summarizeItem(d) : null,
            evidence: d?.evidence
                ? {
                      ruleVersion: d.evidence.ruleVersion,
                      triggerScope: d.evidence.triggerScope,
                      windowStartedAt: d.evidence.windowStartedAt,
                      windowEndsAt: d.evidence.windowEndsAt,
                      requestLimit: d.evidence.requestLimit,
                      rejectedCount: d.evidence.rejectedCount,
                      rejectionThreshold: d.evidence.rejectionThreshold,
                      // 응답 필드와 파생 계산을 구분해 기록한다 — 계약 외 필드라 없으면 null.
                      thresholdReached: d.evidence.thresholdReached ?? null,
                      derivedThresholdReached:
                          d.evidence.rejectedCount >= d.evidence.rejectionThreshold,
                  }
                : null,
        });
    }

    // ── AR02 오류 — 없는 이력 404 ABUSE-002, 형식 오류 400 COMMON-005 ──
    const missing = await get('/admin/abuse-cases/00000000-0000-4000-8000-000000000000');
    const malformed = await get('/admin/abuse-cases/not-a-uuid');
    push({
        name: 'AR02 오류 대조',
        pass:
            missing.status === 404 &&
            missing.envelopeCode === 'ABUSE-002' &&
            malformed.status === 400 &&
            malformed.envelopeCode === 'COMMON-005',
        missing: {
            status: missing.status,
            code: missing.envelopeCode,
            message: missing.message,
        },
        malformed: { status: malformed.status, code: malformed.envelopeCode },
        expected: '404 ABUSE-002 / 400 COMMON-005',
    });

    // ── 권한 — USER는 AR01·AR02 모두 403 ABUSE-001, 헤더 누락은 USER-003 ──
    const userList = await get('/admin/abuse-cases?page=1&size=5', { role: 'USER' });
    const userDetail = await get(`/admin/abuse-cases/${items[0]?.id ?? 'x'}`, {
        role: 'USER',
    });
    const noHeader = await get('/admin/abuse-cases?page=1&size=5', { role: 'NONE' });
    push({
        name: '권한 대조 — ABUSE-001·USER-003',
        pass:
            userList.status === 403 &&
            userList.envelopeCode === 'ABUSE-001' &&
            userDetail.status === 403 &&
            userDetail.envelopeCode === 'ABUSE-001' &&
            noHeader.status === 401 &&
            noHeader.envelopeCode === 'USER-003',
        userList: { status: userList.status, code: userList.envelopeCode },
        userDetail: { status: userDetail.status, code: userDetail.envelopeCode },
        noHeader: { status: noHeader.status, code: noHeader.envelopeCode },
        expected: 'USER → 403 ABUSE-001 / 헤더 없음 → 401 USER-003',
    });
}

await run();
// 점검 실패(pass=false)나 Zod 실패(fail:…)가 하나라도 있으면 비정상 종료로 드러낸다.
process.exitCode = evidence.checks.some(
    (check) => check.pass === false || String(check.zod ?? '').startsWith('fail'),
)
    ? 1
    : 0;
process.stdout.write(`\n증거 기록: ${output} (${evidence.checks.length} checks)\n`);
