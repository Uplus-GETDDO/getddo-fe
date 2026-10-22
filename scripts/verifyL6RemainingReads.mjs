// GD-263 통합 인수 잔여 — 읽기 전용 실측. 어떤 쓰기 요청도 보내지 않는다.
// 실행: node scripts/verifyL6RemainingReads.mjs [증거 파일]
// 모드 없이 한 번에 읽기 항목 전부를 순서대로 실행한다.
//   배포 번들 해시, AM04 집계, AM05 서술 답변(원문 미기록), AM01 ENDED 관측,
//   AP01·AP03 정책 조회(AP05·AP06 승인 제안용 현황), AR01 재확인, INACTIVE 표본,
//   관리자 이벤트 drawScheduledAt(GD-268 +1분 배포 여부)
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
const missionAdmin = load('src/entities/mission/model/adminTypes.ts');
const attendanceAdmin = load('src/entities/attendance/model/adminTypes.ts');
const eventAdmin = load('src/entities/event/model/adminTypes.ts');
const userModel = load('src/entities/user/model/types.ts');

const deployUrl = process.env.L6_DEPLOY_URL;
if (!deployUrl)
    throw new Error(
        'L6_DEPLOY_URL 환경변수가 필요합니다 (예: https://<배포> 또는 https://<배포>/api/v1).',
    );
const ROOT = deployUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
const BASE = `${ROOT}/api/v1`;
const ADMIN = '01a14280-f677-7a0a-a066-5553d7344fd2';

const [outputArg] = process.argv.slice(2);
const output = outputArg ?? 'reports/20261022-GD-263-remaining-reads.json';
const evidence = fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output, 'utf8'))
    : {
          at: new Date().toISOString(),
          kind: 'GD-263 통합 인수 잔여 — 읽기 전용 실측',
          target: ROOT,
          checks: [],
      };
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
const push = (check) => {
    evidence.checks.push(check);
    save();
    console.log(JSON.stringify(check, null, 2));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 읽기 전용 — method는 GET으로 고정해 쓰기 오실행을 구조적으로 막는다.
async function get(url, { admin = true, raw = false } = {}) {
    const started = performance.now();
    const response = await fetch(BASE + url, {
        method: 'GET',
        headers: {
            'X-User-ID': ADMIN,
            'X-User-Role': 'ADMIN',
        },
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
    const entry = {
        method: 'GET',
        path: url,
        status: response.status,
        envelopeCode: json?.code ?? null,
        at: new Date().toISOString(),
        ms,
    };
    if (raw) return { ...entry, text };
    return { ...entry, json, body: json?.data ?? json };
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
// 설문 답변 원문·사용자 식별자를 증거 파일에 쓰지 않기 위한 안전장치다.
const meta = ({ json, body, text, ...rest }) => rest;

async function run() {
    // ── 배포 번들 식별 — index.html의 entry chunk 이름을 배포 버전 근거로 남긴다 ──
    const page = await fetch(ROOT || '/', { signal: AbortSignal.timeout(30000) }).then(
        async (r) => ({
            status: r.status,
            text: await r.text(),
        }),
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

    // ── AM04 선택형 설문 집계 — [DEMO-20261016] 08 설문, BE 대조값 응답 5건 ──
    const AM04_MISSION = '01a143a8-b6df-7cbd-a070-7a196e668677';
    const am04 = await get(
        `/admin/missions/${AM04_MISSION}/survey-summary?from=2026-10-16&to=2026-10-22`,
    );
    const am04Data = am04.body;
    push({
        ...meta(am04),
        name: 'AM04 설문 집계 (08 설문, BE 대조값 5건)',
        zod: zodCheck(envelopeSchema(missionAdmin.surveySummarySchema), am04.json),
        dailyResponses: am04Data?.dailyResponses ?? null,
        dailyTotal: (am04Data?.dailyResponses ?? []).reduce((sum, d) => sum + d.count, 0),
        // 문항·선택지 텍스트는 질문 설정값이라 기록한다 — 사용자 답변 원문은 아니다.
        questions: (am04Data?.questions ?? []).map((q) => ({
            questionId: q.questionId,
            questionText: q.questionText,
            optionCounts: (q.options ?? []).map((o) => ({
                optionId: o.optionId,
                optionText: o.optionText,
                count: o.count,
            })),
            optionTotal: (q.options ?? []).reduce((sum, o) => sum + o.count, 0),
        })),
    });

    // ── AM05 자유 서술 답변 — [DEMO-20261016] 09 설문(대조값 3건), 대체 07 설문(2건) ──
    // 답변 원문·사용자 식별자는 증거에 남기지 않는다 — 길이·시각만 기록한다.
    const AM05_TARGETS = [
        {
            label: '09 설문 (BE 대조값 3건)',
            missionId: '01a143a8-b6df-7557-b040-1b65deb194cb',
            questionId: '01a143a8-b6df-78eb-947e-2cccf4bcb83c',
        },
        {
            label: '07 설문 (BE 대조값 2건, 대체)',
            missionId: '01a143a8-b6df-73fa-9ec8-5e3d4f3fb668',
            questionId: '01a143a8-b6df-7c59-bc7f-409949111210',
        },
    ];
    for (const target of AM05_TARGETS) {
        const am05 = await get(
            `/admin/missions/${target.missionId}/survey-answers` +
                `?questionId=${target.questionId}&from=2026-10-16&to=2026-10-22&page=1&size=20`,
        );
        const items = am05.body?.items ?? [];
        push({
            ...meta(am05),
            name: `AM05 자유 서술 답변 — ${target.label}`,
            zod: zodCheck(
                envelopeSchema(pageSchema(missionAdmin.surveyFreeTextAnswerSchema)),
                am05.json,
            ),
            totalElements: am05.body?.totalElements ?? null,
            itemCount: items.length,
            answers: items.map((a) => ({
                submittedAt: a.submittedAt,
                answerTextLength: typeof a.answerText === 'string' ? a.answerText.length : null,
            })),
        });
    }

    // ── AM01 미션 목록 — status=ENDED 필터와 종료 시각 경과 반영 관측 ──
    const all = await get('/admin/missions?page=1&size=50');
    const endedFilter = await get('/admin/missions?page=1&size=50&status=ENDED');
    const items = all.body?.items ?? [];
    const now = Date.now();
    const missions = items.map((m) => ({
        id: m.id,
        title: m.title,
        missionType: m.missionType,
        status: m.status,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        minutesSinceEnd: Math.round(((now - Date.parse(m.endsAt)) / 60_000) * 10) / 10,
        // ADR-028 관측용 — 작성자 이름 필드가 응답에 내려오는지만 기록한다
        hasCreatedByName: m.createdByName !== undefined && m.createdByName !== null,
    }));
    push({
        ...meta(all),
        name: 'AM01 미션 목록 — 상태·종료 시각 대조',
        zod: zodCheck(envelopeSchema(pageSchema(missionAdmin.adminMissionSummarySchema)), all.json),
        endedFilterStatus: endedFilter.status,
        endedFilterZod: zodCheck(
            envelopeSchema(pageSchema(missionAdmin.adminMissionSummarySchema)),
            endedFilter.json,
        ),
        endedFilterTotal: endedFilter.body?.totalElements ?? null,
        missions,
        pastEndStillActive: missions.filter((m) => m.minutesSinceEnd > 0 && m.status !== 'ENDED'),
    });

    // 종료 시각이 막 지났거나 곧 지나는 미션이 있으면 최대 2.5분 폴링해 전환을 관측한다.
    const pending = missions.filter(
        (m) => m.minutesSinceEnd > -3 && m.minutesSinceEnd <= 2 && m.status !== 'ENDED',
    );
    for (const target of pending.slice(0, 2)) {
        const deadline = Date.parse(target.endsAt) + 150_000;
        const polls = [];
        let observed = null;
        while (Date.now() < deadline) {
            const detail = await get(`/admin/missions?page=1&size=50&status=ENDED`);
            const flipped = (detail.body?.items ?? []).some((m) => m.id === target.id);
            const current = (await get(`/admin/missions?page=1&size=50`)).body?.items?.find(
                (m) => m.id === target.id,
            );
            polls.push({
                at: new Date().toISOString(),
                status: current?.status ?? null,
                inEndedFilter: flipped,
            });
            if (flipped || current?.status === 'ENDED') {
                observed = { flippedAt: new Date().toISOString() };
                break;
            }
            await sleep(15_000);
        }
        push({
            name: `ENDED 전환 관측 — ${target.title}`,
            missionId: target.id,
            endsAt: target.endsAt,
            polls,
            observed,
            unverified: observed ? undefined : '관측 창(종료+2.5분) 안에 ENDED 전환을 보지 못함',
        });
    }

    // ── AP01·AP03 출석 정책 조회 — AP05·AP06 승인 제안의 현황 근거 ──
    const daily = await get('/admin/policies/attendance/daily?page=1&size=50');
    const streak = await get('/admin/policies/attendance/streak?page=1&size=50');
    push({
        ...meta(daily),
        name: 'AP01 일일 출석 정책 목록',
        zod: zodCheck(
            envelopeSchema(pageSchema(attendanceAdmin.dailyAttendancePolicySchema)),
            daily.json,
        ),
        totalElements: daily.body?.totalElements ?? null,
        policies: (daily.body?.items ?? []).map((p) => ({
            id: p.id,
            rewardTicketCount: p.rewardTicketCount,
            effectiveFrom: p.effectiveFrom,
            effectiveUntil: p.effectiveUntil,
            createdByName: p.createdByName ?? null,
            createdAt: p.createdAt,
        })),
    });
    push({
        ...meta(streak),
        name: 'AP03 연속 출석 정책 목록',
        zod: zodCheck(
            envelopeSchema(pageSchema(attendanceAdmin.streakPolicySetSchema)),
            streak.json,
        ),
        totalElements: streak.body?.totalElements ?? null,
        policySets: (streak.body?.items ?? []).map((p) => ({
            id: p.id,
            effectiveMonth: p.effectiveMonth,
            milestones: (p.milestones ?? []).map((m) => ({
                id: m.id,
                milestoneDays: m.milestoneDays,
                rewardTicketCount: m.rewardTicketCount,
            })),
            createdByName: p.createdByName ?? null,
            createdAt: p.createdAt,
        })),
    });

    // ── AR01 차단 조회 — 404 유지 여부 재확인 ──
    const abuse = await get('/admin/abuse-cases?page=1&size=5');
    push({
        ...meta(abuse),
        name: 'AR01 abuse-cases 상태 재확인',
        note:
            abuse.status === 404
                ? '404 유지 — 배포 전. 완료로 표시하지 않는다'
                : '배포된 것으로 보임 — 목록 계약을 대조한다',
        totalElements: abuse.body?.totalElements ?? null,
        itemCount: abuse.body?.items?.length ?? null,
    });

    // ── INACTIVE 계정 표본 ──
    const inactive = await get('/admin/users?status=INACTIVE&page=1&size=5');
    push({
        ...meta(inactive),
        name: 'INACTIVE 계정 표본',
        zod: zodCheck(envelopeSchema(pageSchema(userModel.adminUserSchema)), inactive.json),
        totalElements: inactive.body?.totalElements ?? null,
        note: '0이면 INACTIVE 동작 검증은 계정 입력 없이 불가',
    });

    // ── GD-268 drawScheduledAt — 이벤트별 endsAt 대비 델타(초) 측정 ──
    const events = await get('/admin/events?page=1&size=50');
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
            httpStatus: detail.status,
        });
    }
    push({
        name: 'GD-268 drawScheduledAt 델타 (마감+1분=60초 기대)',
        listStatus: events.status,
        measured: deltas.length,
        deltas,
        summary: {
            plus60: deltas.filter((d) => d.deltaSeconds === 60).length,
            plus300: deltas.filter((d) => d.deltaSeconds === 300).length,
            other: deltas.filter((d) => d.deltaSeconds !== 60 && d.deltaSeconds !== 300).length,
        },
    });
}

await run();
console.log(`\n증거 기록: ${output} (${evidence.checks.length} checks)`);
