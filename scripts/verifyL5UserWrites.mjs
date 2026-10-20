// 등록된 전용 시연 계정에서만 실행한다. 출석·미션 기록과 응모권에 영향을 준다.
// 관리자 정책·새 미션·이벤트 상태는 변경하지 않는다.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const [base, userId, adminId, output] = process.argv.slice(2);
if (!base || !userId || !adminId || !output)
    throw new Error('API URL·시연 USER UUID·ADMIN UUID·증거 파일이 필요합니다.');
const evidence = {
    at: new Date().toISOString(),
    kind: '실제 API 시연 계정 출석·미션 쓰기',
    checks: [],
};
const save = () => fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
async function call(method, url, body, key, admin = false) {
    const response = await fetch(base + url, {
        method,
        headers: {
            'X-User-ID': admin ? adminId : userId,
            'X-User-Role': admin ? 'ADMIN' : 'USER',
            ...(key ? { 'Idempotency-Key': key } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
    });
    const json = await response.json();
    evidence.checks.push({
        method,
        path: url,
        status: response.status,
        code: json.code,
        retryAfter: response.headers.get('retry-after'),
    });
    save();
    return { status: response.status, data: json.data };
}
const balance = async () => (await call('GET', '/tickets/me')).data;
const before = await balance();
const first = await call('POST', '/attendances');
const middle = await balance();
const again = await call('POST', '/attendances');
const after = await balance();
evidence.checks.push({
    name: 'AT02 동일 기준일',
    firstStatus: first.status,
    repeatedStatus: again.status,
    sameReceipt: JSON.stringify(first.data) === JSON.stringify(again.data),
    firstBalanceDelta: middle.availableCount - before.availableCount,
    repeatedBalanceDelta: after.availableCount - middle.availableCount,
    attendanceDate: first.data?.attendanceDate,
    confirmedRewardCount: first.data?.rewards?.reduce((sum, r) => sum + r.ticketCount, 0),
});
save();
const list = (await call('GET', '/admin/missions?page=1&size=100', undefined, undefined, true))
    .data;
for (const type of ['QUIZ', 'SURVEY']) {
    let tested = false;
    for (const summary of list?.items ?? []) {
        if (summary.missionType !== type) continue;
        const publicDetail = (await call('GET', `/missions/${summary.id}`)).data;
        if (
            publicDetail.completed ||
            publicDetail.serverTime < summary.startsAt ||
            publicDetail.serverTime >= summary.endsAt
        )
            continue;
        const detail = (
            await call('GET', `/admin/missions/${summary.id}`, undefined, undefined, true)
        ).data;
        const answers = detail.questions.map((q) =>
            q.questionType === 'SINGLE_CHOICE' || q.questionType === 'OX'
                ? {
                      questionId: q.id,
                      selectedOptionId: q.options.find((o) => type === 'SURVEY' || o.isCorrect)?.id,
                  }
                : {
                      questionId: q.id,
                      answerText: type === 'QUIZ' ? q.correctAnswer : 'L5 시연 검증 답변',
                  },
        );
        const initial = await balance();
        const key = randomUUID();
        const body = { answers: type === 'QUIZ' && answers.length > 1 ? [answers[0]] : answers };
        const result = await call('POST', `/missions/${summary.id}/submissions`, body, key);
        const repeat = await call('POST', `/missions/${summary.id}/submissions`, body, key);
        let final = result;
        if (type === 'QUIZ' && answers.length > 1 && !result.data?.isCompleted)
            final = await call(
                'POST',
                `/missions/${summary.id}/submissions`,
                { answers: answers.slice(1) },
                randomUUID(),
            );
        const completeBalance = await balance();
        const newKeyReplay = await call(
            'POST',
            `/missions/${summary.id}/submissions`,
            { answers },
            randomUUID(),
        );
        const replayBalance = await balance();
        evidence.checks.push({
            name: `${type} 완료·재시도`,
            questionCount: answers.length,
            firstStatus: result.status,
            firstCompleted: result.data?.isCompleted,
            identicalKeyStatus: repeat.status,
            sameResult: JSON.stringify(result.data) === JSON.stringify(repeat.data),
            completed: final.data?.isCompleted,
            rewardCount: final.data?.reward?.ticketCount,
            rewardGrade: final.data?.reward?.grade,
            balanceDelta: completeBalance.availableCount - initial.availableCount,
            newKeyStatus: newKeyReplay.status,
            sameCompletedSubmission: newKeyReplay.data?.submissionId === final.data?.submissionId,
            repeatedRewardDelta: replayBalance.availableCount - completeBalance.availableCount,
        });
        save();
        tested = true;
        break;
    }
    if (!tested) {
        evidence.checks.push({
            name: type,
            unverified: '이 계정에 미완료·운영 중인 시연 미션 없음',
        });
        save();
    }
}
console.log(JSON.stringify(evidence.checks.filter((c) => c.name)));
