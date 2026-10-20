// GD-261 배포 쓰기 인수 — 시연 계정의 실제 응모 1건을 배포 프록시로 수행한다.
// 실행: node scripts/verifyL6DeployEntry.mjs <API 기본 URL> <시연 USER UUID> <증거 파일> [membership=excellent] [full|grades]
//   full   — BRONZE 응모·멱등 재시도·등급 검사 전부 (기본). 실행할 때마다 실제 응모가 추가된다.
//   grades — 자격 조회 후 SILVER·PLATINUM 등급 검사만 실행한다 (BRONZE 재응모 없음).
//   closed — EVENT_NOT_OPEN 이벤트에 응모해 마감·미오픈 거절만 확인한다.
// 자격(canEnter)이 확인된 첫 이벤트에 BRONZE 1장으로 응모하고,
// 같은 멱등키 재시도→같은 영수증, 새 키 재시도→중복 거절/동일 응모 유지를 확인한다.
// 응모는 실제 응모권을 차감하고 해당 이벤트의 실제 참여로 기록된다 — 승인된 계정에서만 실행한다.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const [base, userId, output, membership = 'excellent', mode = 'full'] = process.argv.slice(2);
if (!base || !userId || !output)
    throw new Error('API 기본 URL·시연 USER UUID·증거 파일이 필요합니다.');
const evidence = fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output, 'utf8'))
    : { at: new Date().toISOString(), kind: '배포 실서버 응모 쓰기', checks: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
async function call(method, url, body, key) {
    const response = await fetch(base + url, {
        method,
        headers: {
            'X-User-ID': userId,
            'X-User-Role': 'USER',
            'X-User-Membership': membership,
            ...(key ? { 'Idempotency-Key': key } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
    });
    const json = await response.json();
    return { status: response.status, code: json.code, data: json.data };
}
const wallet = async () => (await call('GET', '/tickets/me')).data;

const events = (await call('GET', '/events?size=100')).data;
const items = events?.items ?? events ?? [];
const eligibilities = [];
let target = null;
for (const event of items) {
    const eligibility = (await call('GET', `/events/${event.id}/eligibility`)).data;
    eligibilities.push({ eventId: event.id, title: event.title, ...eligibility });
    if (!target && eligibility?.canEnter && eligibility?.availableTicketBalance >= 1) {
        target = { event, eligibility };
    }
}
evidence.checks.push({ name: '응모 자격 조회', eligibilities });
save();
if (!target && mode !== 'closed') {
    evidence.checks.push({ name: '응모 실행', unverified: 'canEnter 이벤트 없음' });
    save();
    console.log('NO_ELIGIBLE_EVENT');
    process.exit(0);
}

if (mode !== 'grades') {
    const before = await wallet();
    const body = { tickets: { BRONZE: 1 } };
    const key = randomUUID();
    const first = await call('POST', `/events/${target.event.id}/entries`, body, key);
    const replay = await call('POST', `/events/${target.event.id}/entries`, body, key);
    const again = await call('POST', `/events/${target.event.id}/entries`, body, randomUUID());
    const after = await wallet();
    const myEntries = (await call('GET', '/users/me/entries?size=20')).data;
    const eligibilityAfter = (await call('GET', `/events/${target.event.id}/eligibility`)).data;

    evidence.checks.push({
        name: '응모 접수·멱등·중복',
        eventId: target.event.id,
        eventTitle: target.event.title,
        firstStatus: first.status,
        receipt: first.data,
        replayStatus: replay.status,
        sameReceipt: JSON.stringify(first.data) === JSON.stringify(replay.data),
        newKeyStatus: again.status,
        newKeyCode: again.code,
        newKeyReceiptStatus: again.data?.status,
        newKeyRejection: again.data?.rejectionCode ?? again.code,
        balanceDelta: after.availableCount - before.availableCount,
        bronzeDelta: after.countByGrade?.BRONZE - before.countByGrade?.BRONZE,
        eligibilityAfter,
        myEntriesSample: (myEntries?.items ?? [])
            .filter((entry) => entry.eventId === target.event.id)
            .map((entry) => ({
                id: entry.id,
                status: entry.status,
                requestedTicketCount: entry.requestedTicketCount,
                deductedTicketCount: entry.deductedTicketCount,
            })),
    });
    save();
}

if (mode === 'full' || mode === 'grades') {
    // 등급별 응모·잔액 부족 거절 — SILVER는 보유분으로 추가 접수, PLATINUM은 잔액 부족 거절을 기대한다.
    // 거절된 응모도 거절 이력으로 기록되지만 응모권은 차감되지 않는다.
    const gradeResults = {};
    for (const grade of ['SILVER', 'PLATINUM']) {
        const balanceBefore = await wallet();
        const result = await call(
            'POST',
            `/events/${target.event.id}/entries`,
            { tickets: { [grade]: 1 } },
            randomUUID(),
        );
        const balanceAfter = await wallet();
        gradeResults[grade] = {
            status: result.status,
            receiptStatus: result.data?.status,
            rejectionCode: result.data?.rejectionCode ?? result.code,
            deducted: result.data?.deductedTicketCount,
            balanceDelta: balanceAfter.availableCount - balanceBefore.availableCount,
        };
    }
    evidence.checks.push({ name: '등급별 응모·잔액 부족 거절', ...gradeResults });
    save();
}

if (mode === 'closed') {
    const closed = eligibilities.find(
        (e) => !e.canEnter && (e.reasons ?? []).includes('EVENT_NOT_OPEN'),
    );
    if (!closed) {
        evidence.checks.push({
            name: '마감·미오픈 거절',
            unverified: 'EVENT_NOT_OPEN 이벤트 없음',
        });
    } else {
        const balanceBefore = await wallet();
        const result = await call(
            'POST',
            `/events/${closed.eventId}/entries`,
            { tickets: { BRONZE: 1 } },
            randomUUID(),
        );
        const balanceAfter = await wallet();
        evidence.checks.push({
            name: '마감·미오픈 거절',
            eventId: closed.eventId,
            eventTitle: closed.title,
            status: result.status,
            receiptStatus: result.data?.status,
            rejectionCode: result.data?.rejectionCode ?? result.code,
            deducted: result.data?.deductedTicketCount,
            balanceDelta: balanceAfter.availableCount - balanceBefore.availableCount,
        });
    }
    save();
}
console.log(JSON.stringify(evidence.checks.at(-1), null, 2));
