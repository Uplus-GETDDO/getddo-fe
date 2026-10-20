// GD-261 배포 통합 인수 잔여 — 격리 데이터 생성을 포함한 실서버 검증.
// 실행: node scripts/verifyL6DeployRemaining.mjs <모드> [증거 파일]
// 모드:
//   probe        — 읽기: 기존 추첨·발표·취소 반환·알림 잡 이력, INACTIVE·AR01/AR02 재확인
//   already      — ENTRY-006 ALREADY_ENTERED 거절 (거절 이력만 생김)
//   limit-cancel — 격리 이벤트 생성 → 상한 거절 → 관리자 취소 → 원래 등급 반환·이력 일치
//   draw         — 격리 이벤트 생성 → 응모 → 마감+5분 자동 추첨 → 관리자 검증 → 발표 → 결과·알림
//   banner       — L3 배너 등록·수정·순서·삭제 (짧은 수명의 [TEST] 배너)
//   admin-writes — L5 관리자 쓰기: AP02·AP04·AM03 (성공 생성은 하지 않고 검증
//                  실패·보장된 중복 거절만 실행 — 운영에 데이터를 남기지 않는다)
//   misc         — 429 유도 시도(출석 반복)·p95 측정
// 증거는 모드별 별도 JSON으로 나눠 병렬 실행해도 덮어쓰지 않는다.
// 환경변수: L6_DEPLOY_URL 필수 (배포 루트 또는 .../api/v1) — 기본 대상이 없어
// 운영을 향한 오실행이 불가능하다.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// 대상은 환경변수로만 지정한다 — 기본값이 프로덕션이면 실수로 운영에 쓰기를
// 반복할 수 있어 하드코딩하지 않는다. 배포 루트·API 루트 둘 다 받는다.
const deployUrl = process.env.L6_DEPLOY_URL;
if (!deployUrl)
    throw new Error(
        'L6_DEPLOY_URL 환경변수가 필요합니다 (예: https://<배포> 또는 https://<배포>/api/v1).',
    );
const BASE = deployUrl.replace(/\/$/, '').endsWith('/api/v1')
    ? deployUrl.replace(/\/$/, '')
    : `${deployUrl.replace(/\/$/, '')}/api/v1`;
const ADMIN = '01a14280-f677-7a0a-a066-5553d7344fd2';
const USER = '01a14280-f678-7617-9364-6b79d2dcbef2';
const USER_MEMBERSHIP = 'excellent';
const PREFIX = '[TEST-GD261]';

const [mode, outputArg] = process.argv.slice(2);
const output = outputArg ?? `reports/20261021-L6-deploy-remaining-${mode}.json`;
if (!mode) throw new Error('모드가 필요합니다.');
const evidence = fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output, 'utf8'))
    : { at: new Date().toISOString(), kind: `배포 통합 인수 잔여 — ${mode}`, checks: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
const push = (check) => {
    evidence.checks.push(check);
    save();
    console.log(JSON.stringify(check, null, 2));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, url, { admin = false, body, key, timed = false } = {}) {
    const started = performance.now();
    const response = await fetch(BASE + url, {
        method,
        headers: {
            'X-User-ID': admin ? ADMIN : USER,
            'X-User-Role': admin ? 'ADMIN' : 'USER',
            ...(admin ? {} : { 'X-User-Membership': USER_MEMBERSHIP }),
            ...(key ? { 'Idempotency-Key': key } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
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
        status: response.status,
        code: json?.code,
        data: json?.data ?? json ?? text.slice(0, 300),
        retryAfter: response.headers.get('retry-after'),
        ...(timed ? { ms } : {}),
    };
}
const adminGet = (url) => call('GET', url, { admin: true });
const userGet = (url, extra = {}) => call('GET', url, extra);
const wallet = async () => (await userGet('/tickets/me')).data;
const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();

// ── probe: 기존 데이터로 추첨·발표·취소 반환 읽기 계약 검증 ──
async function runProbe() {
    const users = await adminGet('/admin/users?status=INACTIVE&size=5');
    push({
        name: 'INACTIVE 계정 존재 여부',
        status: users.status,
        count: users.data?.items?.length ?? users.data?.totalElements ?? 0,
        note: '0이면 INACTIVE 동작 검증은 계정 입력 없이 불가',
    });

    const abuse = await adminGet('/admin/abuse-cases?size=5');
    push({
        name: 'AR01 abuse-cases 상태',
        status: abuse.status,
        code: abuse.code,
        note: '404면 여전히 미구현 — 완료로 표시하지 않는다',
    });

    const events = await adminGet('/admin/events?size=50&sort=endsAt,desc');
    const items = events.data?.items ?? [];
    const interesting = items.filter((e) =>
        ['PUBLISHED', 'REDRAWING', 'CANCELED', 'DRAW_CONFIRMED', 'NO_ENTRANTS'].includes(e.status),
    );
    push({
        name: '종료·발표 상태 이벤트 목록',
        count: interesting.length,
        events: interesting.map((e) => ({
            id: e.id,
            title: e.title,
            status: e.status,
            endsAt: e.endsAt,
        })),
    });

    // endsAt 최신순 앞 4개가 아니라 상태별 대표를 고른다 — PUBLISHED·REDRAWING이
    // 뒤로 밀려 누락되는 것을 막는다.
    const representatives = ['PUBLISHED', 'REDRAWING', 'DRAW_CONFIRMED', 'NO_ENTRANTS', 'CANCELED']
        .map((status) => interesting.find((e) => e.status === status))
        .filter(Boolean);
    for (const event of representatives) {
        const draws = await adminGet(`/admin/events/${event.id}/draws?size=10`);
        const runs = draws.data?.items ?? [];
        const detail = runs[0] ? await adminGet(`/admin/draws/${runs[0].id}`) : null;
        const participants = runs[0]
            ? await adminGet(`/admin/draws/${runs[0].id}/participants?size=5`)
            : null;
        const checks = runs[0] ? await adminGet(`/admin/draws/${runs[0].id}/checks?size=5`) : null;
        const failures = runs[0]
            ? await adminGet(`/admin/draws/${runs[0].id}/failures?size=5`)
            : null;
        const results = await userGet(`/events/${event.id}/results`);
        push({
            name: `추첨 이력 — ${event.title} (${event.status})`,
            eventId: event.id,
            drawsStatus: draws.status,
            runs: runs.map((r) => ({
                id: r.id,
                runNumber: r.runNumber,
                drawType: r.drawType,
                status: r.status,
                confirmedAt: r.confirmedAt,
            })),
            latestResults: detail?.data?.results?.map((r) => ({
                prizeRank: r.prizeRank,
                resultType: r.resultType,
                userId: r.userId,
                wasPublished: r.wasPublished,
                isCanceled: r.isCanceled,
            })),
            execution: detail?.data?.execution,
            participantCount: participants?.data?.totalElements,
            checksCount: checks?.data?.totalElements,
            failuresCount: failures?.data?.totalElements,
            publicResults: {
                status: results.status,
                isPublished: results.data?.isPublished,
                displayStatus: results.data?.displayStatus,
                winnersSample: results.data?.prizes?.[0]?.winners?.slice(0, 3),
            },
        });
    }

    const refunds = await adminGet('/admin/ticket-refunds?size=10');
    push({
        name: '관리자 응모권 반환 이력(AO08)',
        status: refunds.status,
        total: refunds.data?.totalElements,
        items: (refunds.data?.items ?? []).slice(0, 5),
    });

    const jobs = await adminGet('/admin/notification-jobs?size=10');
    push({
        name: '알림 잡 이력(AN01)',
        status: jobs.status,
        total: jobs.data?.totalElements,
        items: (jobs.data?.items ?? []).map((j) => ({
            id: j.id,
            type: j.notificationType,
            status: j.status,
            attempts: j.attemptCount,
        })),
    });
}

// ── already: 이미 응모한 이벤트에 새 키로 응모 → ENTRY-006 ──
async function runAlready() {
    const events = (await userGet('/events?size=100')).data;
    for (const event of events?.items ?? []) {
        const eligibility = (await userGet(`/events/${event.id}/eligibility`)).data;
        if ((eligibility?.reasons ?? []).includes('ALREADY_ENTERED')) {
            const before = await wallet();
            const result = await call('POST', `/events/${event.id}/entries`, {
                body: { tickets: { BRONZE: 1 } },
                key: randomUUID(),
            });
            const after = await wallet();
            push({
                name: 'ALREADY_ENTERED 거절',
                eventId: event.id,
                eventTitle: event.title,
                status: result.status,
                rejectionCode: result.data?.rejectionCode ?? result.code,
                balanceDelta: after.availableCount - before.availableCount,
            });
            return;
        }
    }
    push({ name: 'ALREADY_ENTERED 거절', unverified: 'ALREADY_ENTERED 자격 이벤트 없음' });
}

// ── 격리 이벤트 생성 공통 ──
// startsAtOffset 기준 windowMs 만큼 열리는 이벤트를 만든다.
// 과거 시작이 400으로 거절되면 60초 뒤 시작으로 한 번 재시도한다.
async function createIsolatedEvent({ title, startsAtOffset, windowMs, maxTicketsPerUser = 1 }) {
    const makeBody = (offset) => ({
        title,
        description: `${PREFIX} 통합 인수용 격리 이벤트`,
        imageKey: null,
        eventType: 'TICKET',
        weightingEnabled: false,
        maxTicketsPerUser,
        membershipRule: 'excellent',
        startsAt: iso(offset),
        endsAt: iso(offset + windowMs),
        prizes: [
            {
                rank: 1,
                name: `${PREFIX} 상품`,
                description: null,
                imageKey: null,
                winnerCount: 1,
            },
        ],
    });
    const created = await call('POST', '/admin/events', {
        admin: true,
        body: makeBody(startsAtOffset),
    });
    if (created.status === 400 && startsAtOffset < 0) {
        const retry = await call('POST', '/admin/events', { admin: true, body: makeBody(60_000) });
        return { response: retry, startsAt: makeBody(60_000).startsAt };
    }
    return { response: created, startsAt: makeBody(startsAtOffset).startsAt };
}
const waitOpen = async (eventId, timeoutMs = 120_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const eligibility = (await userGet(`/events/${eventId}/eligibility`)).data;
        if (eligibility?.canEnter) return eligibility;
        await sleep(5_000);
    }
    return null;
};

// ── limit-cancel: 상한 거절 + 취소 반환 ──
async function runLimitCancel() {
    const { response: created, startsAt } = await createIsolatedEvent({
        title: `${PREFIX} 상한·취소 반환`,
        startsAtOffset: -60_000,
        windowMs: 6 * 3_600_000,
    });
    const eventId = created.data?.id;
    push({
        name: '격리 이벤트 생성(상한 1장)',
        status: created.status,
        eventId,
        startsAt,
        code: created.code,
    });
    if (created.status !== 201) return;

    const eligibility = await waitOpen(eventId);
    if (!eligibility) {
        push({ name: '응모·취소', unverified: '이벤트 OPEN 대기 시간 초과' });
        return;
    }
    // maxTicketsPerUser=1인 이벤트에 상한 초과 수량을 먼저 요청한다 — 응모 이력이
    // 없는 상태라 중복(ENTRY-006)보다 상한(ENTRY-007)이 먼저 평가돼야 한다.
    const limit = await call('POST', `/events/${eventId}/entries`, {
        body: { tickets: { BRONZE: 2 } },
        key: randomUUID(),
    });
    const limitBalanceAfter = await wallet();
    const entry = await call('POST', `/events/${eventId}/entries`, {
        body: { tickets: { BRONZE: 1 } },
        key: randomUUID(),
    });
    const dup = await call('POST', `/events/${eventId}/entries`, {
        body: { tickets: { BRONZE: 1 } },
        key: randomUUID(),
    });
    push({
        name: '상한 초과·응모·중복 거절',
        limitStatus: limit.status,
        limitRejectionCode: limit.data?.rejectionCode ?? null,
        limitEnvelopeCode: limit.code,
        limitDeducted: limit.data?.deductedTicketCount,
        bronzeAfterLimit: limitBalanceAfter.countByGrade?.BRONZE,
        entryStatus: entry.status,
        entryReceiptStatus: entry.data?.status,
        duplicateStatus: dup.status,
        duplicateRejectionCode: dup.data?.rejectionCode ?? null,
        duplicateEnvelopeCode: dup.code,
    });

    const beforeCancel = await wallet();
    const cancel = await call('POST', `/admin/events/${eventId}/cancel`, {
        admin: true,
        body: { reason: `${PREFIX} 통합 인수 검증 후 정리` },
    });
    const afterCancel = await wallet();
    const histories = (await userGet('/tickets/histories/me?size=10')).data;
    const adminRefunds = await adminGet(`/admin/ticket-refunds?eventId=${eventId}&size=10`);
    const myEntries = (await userGet(`/events/${eventId}/entries/me?size=10`)).data;
    const adminParticipants = await adminGet(`/admin/events/${eventId}/participants?size=10`);
    const del = await call('DELETE', `/admin/events/${eventId}`, { admin: true });
    push({
        name: '이벤트 취소→원래 등급 반환→이력 일치',
        cancelStatus: cancel.status,
        operation: cancel.data,
        bronzeBefore: beforeCancel.countByGrade?.BRONZE,
        bronzeAfter: afterCancel.countByGrade?.BRONZE,
        recentHistories: (histories?.items ?? histories ?? []).slice(0, 5),
        adminRefundStatus: adminRefunds.status,
        adminRefunds: adminRefunds.data?.items ?? [],
        myEntries: (myEntries?.items ?? []).map((e) => ({
            id: e.id,
            status: e.status,
            deductedTicketCount: e.deductedTicketCount,
        })),
        adminParticipantCount: adminParticipants.data?.totalElements,
        deleteAfterEntriesStatus: del.status,
        deleteAfterEntriesCode: del.code,
    });
}

// ── draw: 자동 추첨 → 관리자 검증 → 발표 → 결과·알림 ──
async function runDraw() {
    const { response: created, startsAt } = await createIsolatedEvent({
        title: `${PREFIX} 추첨·발표`,
        startsAtOffset: -60_000,
        windowMs: 4 * 60_000,
    });
    const eventId = created.data?.id;
    push({
        name: '격리 이벤트 생성(추첨)',
        status: created.status,
        code: created.code,
        eventId,
        startsAt,
    });
    if (created.status !== 201) return;
    const adminEvent = await adminGet(`/admin/events/${eventId}`);
    const drawAt = adminEvent.data?.drawScheduledAt;
    const eligibility = await waitOpen(eventId, 180_000);
    if (!eligibility) {
        push({ name: '추첨', unverified: '이벤트 OPEN 대기 시간 초과' });
        return;
    }
    const entry = await call('POST', `/events/${eventId}/entries`, {
        body: { tickets: { BRONZE: 1 } },
        key: randomUUID(),
    });
    push({ name: '추첨 대상 응모', status: entry.status, receipt: entry.data?.status });
    if (entry.status !== 201 && entry.status !== 200) return;

    // 마감+5분 자동 추첨 대기 — 최대 20분 폴링
    const deadline = Math.max(Date.parse(drawAt ?? 0), Date.now()) + 20 * 60_000;
    let run = null;
    while (Date.now() < deadline) {
        const draws = await adminGet(`/admin/events/${eventId}/draws?size=5`);
        run = (draws.data?.items ?? []).find((r) =>
            ['CONFIRMED', 'FAILED', 'NO_ENTRIES'].includes(r.status),
        );
        if (run) break;
        await sleep(20_000);
    }
    push({
        name: '서버 마감·자동 추첨',
        waitedUntil: new Date().toISOString(),
        run: run ?? null,
        unverified: run ? undefined : '시간 내 CONFIRMED 실행 없음',
    });
    if (!run) return;

    const detail = await adminGet(`/admin/draws/${run.id}`);
    const participants = await adminGet(`/admin/draws/${run.id}/participants?size=10`);
    const failures = await adminGet(`/admin/draws/${run.id}/failures?size=10`);
    const audits = await adminGet(`/admin/draws/${run.id}/execution-audits?size=10`);
    const check = await call('POST', `/admin/draws/${run.id}/checks`, { admin: true });
    push({
        name: '관리자 추첨 검토',
        drawStatus: run.status,
        results: detail.data?.results,
        execution: detail.data?.execution,
        participantCount: participants.data?.totalElements,
        candidates: participants.data?.items?.map((c) => ({
            userId: c.userId,
            ticketCount: c.ticketCount,
            weight: c.weight,
        })),
        failuresTotal: failures.data?.totalElements,
        auditsTotal: audits.data?.totalElements,
        verificationStatus: check.status,
        verification: check.data,
    });

    // 검증 직후 즉시 발표하면 409 DRAW-005가 관측됐다 — 짧은 백오프 재시도를 둔다.
    const publishAttempts = [];
    let publish = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const attemptAt = new Date().toISOString();
        publish = await call('POST', `/admin/draws/${run.id}/result-confirmation`, {
            admin: true,
        });
        publishAttempts.push({
            attempt: attempt + 1,
            at: attemptAt,
            status: publish.status,
            code: publish.code,
        });
        if (publish.status === 200) break;
        if (publish.code !== 'DRAW-005') break; // 재시도해도 의미 없는 오류는 중단
        await sleep(5_000 * (attempt + 1));
    }
    const eventAfter = await adminGet(`/admin/events/${eventId}`);
    const runsAfter = await adminGet(`/admin/events/${eventId}/draws?size=5`);
    push({
        name: '발표(result-confirmation)·최종 상태',
        attempts: publishAttempts,
        data: publish.data,
        eventStatusAfter: eventAfter.data?.status,
        finalRuns: (runsAfter.data?.items ?? []).map((r) => ({
            id: r.id,
            runNumber: r.runNumber,
            drawType: r.drawType,
            status: r.status,
        })),
    });

    const publicResults = await userGet(`/events/${eventId}/results`);
    const myResult = await userGet(`/events/${eventId}/my-result`);
    push({
        name: '공개 결과·마스킹·본인 결과',
        publicStatus: publicResults.status,
        isPublished: publicResults.data?.isPublished,
        displayStatus: publicResults.data?.displayStatus,
        prizes: publicResults.data?.prizes,
        myStatus: myResult.status,
        myResult: myResult.data,
    });

    // 알림 잡이 COMPLETED가 될 때까지 최대 3분 폴링
    let jobs = null;
    const jobDeadline = Date.now() + 3 * 60_000;
    while (Date.now() < jobDeadline) {
        const r = await adminGet(`/admin/notification-jobs?eventId=${eventId}&size=10`);
        jobs = r.data?.items ?? [];
        if (jobs.length && jobs.every((j) => j.status === 'COMPLETED')) break;
        await sleep(10_000);
    }
    const myNotifications = await userGet('/notifications/me?size=10');
    push({
        name: '발표 알림·복구',
        jobs: jobs?.map((j) => ({
            type: j.notificationType,
            status: j.status,
            attempts: j.attemptCount,
        })),
        userNotifications: (myNotifications.data?.items ?? [])
            .filter((n) => n.eventId === eventId)
            .slice(0, 5),
    });
}

// ── banner: AB02~AB05 ──
async function runBanner() {
    const before = await adminGet('/admin/banners');
    const list = before.data ?? [];
    push({ name: '배너 현황', status: before.status, count: list.length });

    const open = (await adminGet('/admin/events?size=5&status=OPEN')).data?.items?.[0];
    if (!open) {
        push({ name: '배너 CRUD', unverified: 'OPEN 상태 이벤트가 없어 연결 대상을 고르지 못함' });
        return;
    }
    if (list.length >= 5) {
        const blocked = await call('POST', '/admin/banners', {
            admin: true,
            body: { eventId: open?.id, imageKey: 'demo-20261016/banner-01.svg', displayOrder: 6 },
        });
        push({
            name: '배너 5개 상한 거절',
            status: blocked.status,
            code: blocked.code,
            unverified: blocked.status === 409 ? undefined : '예상 409 BANNER-004와 다름',
        });
        return;
    }
    const imageKey = 'demo-20261016/banner-01.svg';
    const created = await call('POST', '/admin/banners', {
        admin: true,
        body: { eventId: open.id, imageKey, displayOrder: list.length + 1 },
    });
    const bannerId = created.data?.id;
    push({
        name: '배너 등록(AB02)',
        status: created.status,
        bannerId,
        eventId: open.id,
        data: created.data,
    });
    if (created.status !== 201) return;

    // 중간에 예외가 나도 테스트 배너가 배포 환경에 남지 않게 정리를 finally로 보장한다.
    try {
        const updated = await call('PUT', `/admin/banners/${bannerId}`, {
            admin: true,
            body: {
                eventId: open.id,
                imageKey: 'demo-20261016/banner-02.svg',
                displayOrder: 1,
            },
        });
        const userList = await userGet('/banners');
        push({
            name: '배너 수정·사용자 목록 반영(AB03·B01)',
            updateStatus: updated.status,
            displayOrderAfter: updated.data?.displayOrder,
            imageKeyAfter: updated.data?.imageKey,
            userBanners: (userList.data ?? []).map((b) => ({
                id: b.id,
                displayOrder: b.displayOrder,
                eventId: b.eventId,
            })),
        });

        const mid = await adminGet('/admin/banners');
        const order = (mid.data ?? []).map((b) => b.id);
        const reordered = await call('PUT', '/admin/banners/order', {
            admin: true,
            body: { bannerIds: [bannerId, ...order.filter((id) => id !== bannerId)] },
        });
        const restored = await call('PUT', '/admin/banners/order', {
            admin: true,
            body: { bannerIds: order },
        });
        push({
            name: '배너 순서 변경·복원(AB05)',
            reorderStatus: reordered.status,
            restoreStatus: restored.status,
        });
    } finally {
        const deleted = await call('DELETE', `/admin/banners/${bannerId}`, { admin: true });
        const originalOrder = list.map((b) => b.id);
        const orderRestored = originalOrder.length
            ? await call('PUT', '/admin/banners/order', {
                  admin: true,
                  body: { bannerIds: originalOrder },
              })
            : null;
        const after = await adminGet('/admin/banners');
        push({
            name: '배너 삭제·원본 순서 복원(AB04)',
            deleteStatus: deleted.status,
            orderRestoreStatus: orderRestored?.status,
            remainingCount: (after.data ?? []).length,
            testBannerRemoved: !(after.data ?? []).some((b) => b.id === bannerId),
        });
    }
}

// ── admin-writes: AP02·AP04·AM03 ──
// 성공 생성은 다음 적용일의 실제 정책·미션을 공유 운영 환경에 남긴다(삭제 API 부재).
// 따라서 성공 요청은 보내지 않고, 검증 실패(400)와 보장된 중복 거절(409)만 보낸다 —
// 중복 POST는 동일 적용일 정책이 이미 있을 때만 보내므로 새 데이터가 생기지 않는다.
const nextKstMidnightUtc = () => {
    const kst = new Date(Date.now() + 9 * 3_600_000);
    const next = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1);
    return new Date(next - 9 * 3_600_000).toISOString();
};
const nextKstMonth = () => {
    const kst = new Date(Date.now() + 9 * 3_600_000);
    const year = kst.getUTCMonth() === 11 ? kst.getUTCFullYear() + 1 : kst.getUTCFullYear();
    const month = ((kst.getUTCMonth() + 1) % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
};

async function runAdminWrites() {
    const daily = await adminGet('/admin/policies/attendance/daily?size=20');
    const dailyItems = daily.data?.items ?? [];
    const nextEffective = nextKstMidnightUtc();
    const dailyCovered = dailyItems.some((p) => p.effectiveFrom === nextEffective);
    const invalid = await call('POST', '/admin/policies/attendance/daily', {
        admin: true,
        body: { rewardTicketCount: 0 },
    });
    // 동일 적용일 정책이 이미 있어야 이 POST는 항상 409로 끝난다 — 없으면 성공
    // 생성이 되어 운영에 정책을 남기므로 미실행으로 기록한다.
    const dup = dailyCovered
        ? await call('POST', '/admin/policies/attendance/daily', {
              admin: true,
              body: { rewardTicketCount: dailyItems[0]?.rewardTicketCount ?? 1 },
          })
        : null;
    push({
        name: 'AP02 일일 출석 정책',
        nextEffectiveFrom: nextEffective,
        policies: dailyItems.map((p) => ({
            id: p.id,
            effectiveFrom: p.effectiveFrom,
            rewardTicketCount: p.rewardTicketCount,
        })),
        invalidStatus: invalid.status,
        invalidCode: invalid.code,
        duplicateStatus: dup?.status,
        duplicateCode: dup?.code,
        createSkipped: dailyCovered
            ? undefined
            : '다음 KST 자정 정책 없음 — 성공 생성은 운영 데이터를 남기므로 실행하지 않음',
    });

    const streak = await adminGet('/admin/policies/attendance/streak?size=20');
    const streakItems = streak.data?.items ?? [];
    const nextMonth = nextKstMonth();
    const streakCovered = streakItems.some((s) => s.effectiveMonth === nextMonth);
    const streakDup = streakCovered
        ? await call('POST', '/admin/policies/attendance/streak', {
              admin: true,
              body: { milestones: [{ milestoneDays: 1, rewardTicketCount: 1 }] },
          })
        : null;
    const streakInvalid = await call('POST', '/admin/policies/attendance/streak', {
        admin: true,
        body: {
            milestones: [
                { milestoneDays: 3, rewardTicketCount: 1 },
                { milestoneDays: 1, rewardTicketCount: 1 },
            ],
        },
    });
    push({
        name: 'AP04 연속 출석 정책',
        nextEffectiveMonth: nextMonth,
        existing: streakItems.map((s) => s.effectiveMonth),
        duplicateStatus: streakDup?.status,
        duplicateCode: streakDup?.code,
        invalidStatus: streakInvalid.status,
        invalidCode: streakInvalid.code,
        createSkipped: streakCovered
            ? undefined
            : '다음 KST 월 정책 없음 — 성공 생성은 운영 데이터를 남기므로 실행하지 않음',
    });

    const missionBody = {
        title: `${PREFIX} 인수 검증 미션`,
        description: `${PREFIX} 관리자 쓰기 검증용`,
        missionType: 'QUIZ',
        startsAt: iso(-2 * 3_600_000),
        endsAt: iso(-3_600_000),
        rewardTicketCount: 1,
        imageKey: null,
        questions: [
            {
                questionType: 'OX',
                questionText: '검증용 문항',
                displayOrder: 1,
                options: [
                    { optionText: 'O', displayOrder: 1, isCorrect: true },
                    { optionText: 'X', displayOrder: 2, isCorrect: false },
                ],
            },
        ],
    };
    // 재실행마다 미션이 쌓이지 않도록 동일 PREFIX 미션이 있으면 생성을 건너뛴다
    // (삭제 API 부재 — 최초 1회 생성분만 운영 잔여 데이터로 기록한다).
    const existing = await adminGet(
        `/admin/missions?size=20&keyword=${encodeURIComponent(PREFIX)}`,
    );
    const existingMission = (existing.data?.items ?? []).find((m) => m.title?.startsWith(PREFIX));
    const mission = existingMission
        ? null
        : await call('POST', '/admin/missions', { admin: true, body: missionBody });
    const missionInvalid = await call('POST', '/admin/missions', {
        admin: true,
        body: { ...missionBody, rewardTicketCount: 5 },
    });
    push({
        name: 'AM03 미션 등록',
        createdStatus: mission?.status,
        createdCode: mission?.code,
        createdId: mission?.data?.id,
        missionStatus: mission?.data?.status,
        existingTestMission: existingMission
            ? { id: existingMission.id, title: existingMission.title }
            : undefined,
        invalidStatus: missionInvalid.status,
        invalidCode: missionInvalid.code,
    });
}

// ── misc: 429 유도·p95 ──
async function runMisc() {
    const burst = [];
    await Promise.all(
        Array.from({ length: 40 }, async () => {
            const r = await call('POST', '/attendances');
            burst.push({ status: r.status, retryAfter: r.retryAfter });
        }),
    );
    const counts = burst.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});
    push({
        name: '429 유도 시도(출석 40회 버스트)',
        statusCounts: counts,
        retryAfter: burst.find((r) => r.retryAfter)?.retryAfter ?? null,
        unverified: counts[429] ? undefined : '레이트리밋 미발동 — 임계치 부재 또는 상회',
    });

    const lat = async (path, n) => {
        const ms = [];
        for (let i = 0; i < n; i++) ms.push((await userGet(path, { timed: true })).ms);
        ms.sort((a, b) => a - b);
        return {
            n,
            p50: ms[Math.floor(ms.length * 0.5)],
            p95: ms[Math.floor(ms.length * 0.95)],
            max: ms.at(-1),
        };
    };
    push({
        name: 'p95 측정(클라이언트 관측, 네트워크 포함)',
        ticketsMe: await lat('/tickets/me', 30),
        eventsList: await lat('/events?page=1&size=12', 30),
    });
}

const runners = {
    probe: runProbe,
    already: runAlready,
    'limit-cancel': runLimitCancel,
    draw: runDraw,
    banner: runBanner,
    'admin-writes': runAdminWrites,
    misc: runMisc,
};
await runners[mode]();
save();
