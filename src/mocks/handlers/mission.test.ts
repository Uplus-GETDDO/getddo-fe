import { describe, expect, it } from 'vitest';

import { apiClient } from '@shared/api/client';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

// 목업은 모듈 수준 상태를 들고 있어 테스트끼리 영향을 준다 — 테스트마다 다른 사용자를 쓴다
const SURVEY_ID = 'msn-survey-1';
const QUIZ_OX_ID = 'msn-quiz-1';
const QUIZ_SHORT_ID = 'msn-quiz-2';
const ENDED_ID = 'msn-quiz-ended';
const DONE_ID = 'msn-survey-done';

let userSeq = 0;
const nextUser = () => `mission-test-${(userSeq += 1)}`;

interface SubmissionResult {
    submissionId: string;
    missionId: string;
    isCompleted: boolean;
    reward: { ticketCount: number } | null;
}

interface Envelope<T> {
    success: boolean;
    code: string;
    data: T;
}

const SURVEY_ANSWERS = [
    { questionId: 'q-survey-1-1', selectedOptionId: 'opt-survey-1-1' },
    { questionId: 'q-survey-1-2', answerText: '더 다양한 이벤트를 열어주세요.' },
];

function submit(missionId: string, answers: unknown, key: string, userId: string) {
    return apiClient.post(
        `/v1/missions/${missionId}/submissions`,
        { answers },
        {
            headers: { [IDEMPOTENCY_HEADER]: key, 'X-User-ID': userId },
            validateStatus: () => true,
        },
    );
}

async function missionCompleted(missionId: string, userId: string) {
    const { data } = await apiClient.get<Envelope<{ completed: boolean }>>(
        `/v1/missions/${missionId}`,
        { headers: { 'X-User-ID': userId } },
    );
    return data.data.completed;
}

async function balance(userId: string) {
    const { data } = await apiClient.get<Envelope<{ availableCount: number }>>('/v1/tickets/me', {
        headers: { 'X-User-ID': userId },
    });
    return data.data.availableCount;
}

describe('미션 목업 핸들러', () => {
    it('다문항 퀴즈는 정답을 누적하고 마지막 문항에서 한 장만 보상한다', async () => {
        const userId = nextUser();
        const { data: detail } = await apiClient.get<
            Envelope<{
                questions: { id: string; questionType: string; options: { id: string }[] }[];
            }>
        >('/v1/missions/msn-quiz-multi', { headers: { 'X-User-ID': userId } });
        const answers = [
            { questionId: 'q-multi-1', selectedOptionId: 'opt-multi-1-1' },
            { questionId: 'q-multi-2', selectedOptionId: 'opt-multi-2-4' },
            { questionId: 'q-multi-3', selectedOptionId: 'opt-multi-3-1' },
            { questionId: 'q-multi-4', selectedOptionId: 'opt-multi-4-1' },
            { questionId: 'q-multi-5', answerText: '무너' },
        ];
        expect(detail.data.questions).toHaveLength(5);
        const before = await balance(userId);
        for (let i = 0; i < answers.length; i++) {
            const response = await submit(
                'msn-quiz-multi',
                [answers[i]],
                `partial-${userId}-${i}`,
                userId,
            );
            expect(response.status).toBe(201);
            const result = (response.data as Envelope<SubmissionResult>).data;
            expect(result.isCompleted).toBe(i === 4);
            expect(result.reward?.ticketCount ?? 0).toBe(i === 4 ? 1 : 0);
        }
        expect(await balance(userId)).toBe(before + 1);
    });
    it('설문 필수 문항을 모두 답하면 201·완료·보상을 받는다', async () => {
        const userId = nextUser();
        const res = await submit(SURVEY_ID, SURVEY_ANSWERS, `k-${userId}`, userId);
        expect(res.status).toBe(201);
        const result = (res.data as Envelope<SubmissionResult>).data;
        expect(result.isCompleted).toBe(true);
        expect(result.reward?.ticketCount).toBe(1);
        expect(await missionCompleted(SURVEY_ID, userId)).toBe(true);
    });

    it('필수 문항을 빼먹으면 400이다', async () => {
        const userId = nextUser();
        const res = await submit(
            SURVEY_ID,
            [{ questionId: 'q-survey-1-2', answerText: '선택 문항을 건너뛴 답변' }],
            `k-${userId}`,
            userId,
        );
        expect(res.status).toBe(400);
    });

    it('선택형 문항에 텍스트 답을내면 400이다', async () => {
        const userId = nextUser();
        const res = await submit(
            SURVEY_ID,
            [{ questionId: 'q-survey-1-1', answerText: '앱 푸시' }],
            `k-${userId}`,
            userId,
        );
        expect(res.status).toBe(400);
    });

    it('퀴즈 오답은 isCompleted=false·보상 없음이고 재시도할 수 있다', async () => {
        const userId = nextUser();
        const wrong = await submit(
            QUIZ_OX_ID,
            [{ questionId: 'q-quiz-1-1', selectedOptionId: 'opt-quiz-1-x' }],
            `k-${userId}-w`,
            userId,
        );
        expect(wrong.status).toBe(201);
        expect((wrong.data as Envelope<SubmissionResult>).data.isCompleted).toBe(false);
        expect((wrong.data as Envelope<SubmissionResult>).data.reward).toBeNull();

        const right = await submit(
            QUIZ_OX_ID,
            [{ questionId: 'q-quiz-1-1', selectedOptionId: 'opt-quiz-1-o' }],
            `k-${userId}-r`,
            userId,
        );
        expect((right.data as Envelope<SubmissionResult>).data.isCompleted).toBe(true);
        expect(await missionCompleted(QUIZ_OX_ID, userId)).toBe(true);
    });

    it('단답 퀴즈는 정답과 일치할 때만 완료된다', async () => {
        const userId = nextUser();
        const wrong = await submit(
            QUIZ_SHORT_ID,
            [{ questionId: 'q-quiz-2-1', answerText: '모른다' }],
            `k-${userId}-w`,
            userId,
        );
        expect((wrong.data as Envelope<SubmissionResult>).data.isCompleted).toBe(false);

        const right = await submit(
            QUIZ_SHORT_ID,
            [{ questionId: 'q-quiz-2-1', answerText: ' 무너 ' }],
            `k-${userId}-r`,
            userId,
        );
        expect((right.data as Envelope<SubmissionResult>).data.isCompleted).toBe(true);
        expect((right.data as Envelope<SubmissionResult>).data.reward?.ticketCount).toBe(1);
    });

    it('완료된 미션 재제출은 기존 결과를 200으로 돌려주고 보상을 중복 지급하지 않는다', async () => {
        const userId = nextUser();
        const first = await submit(
            QUIZ_OX_ID,
            [{ questionId: 'q-quiz-1-1', selectedOptionId: 'opt-quiz-1-o' }],
            `k-${userId}-1`,
            userId,
        );
        const firstResult = (first.data as Envelope<SubmissionResult>).data;
        const afterFirst = await balance(userId);

        const again = await submit(
            QUIZ_OX_ID,
            [{ questionId: 'q-quiz-1-1', selectedOptionId: 'opt-quiz-1-x' }],
            `k-${userId}-2`,
            userId,
        );
        expect(again.status).toBe(200);
        expect((again.data as Envelope<SubmissionResult>).data.submissionId).toBe(
            firstResult.submissionId,
        );
        expect(await balance(userId)).toBe(afterFirst);
    });

    it('같은 멱등키·다른 본문은 409다', async () => {
        const userId = nextUser();
        const key = `k-${userId}`;
        await submit(SURVEY_ID, SURVEY_ANSWERS, key, userId);
        const res = await submit(
            SURVEY_ID,
            [{ questionId: 'q-survey-1-1', selectedOptionId: 'opt-survey-1-2' }],
            key,
            userId,
        );
        expect(res.status).toBe(409);
        expect((res.data as { code: string }).code).toBe('MISSION-005');
    });

    it('같은 멱등키·같은 본문 재전송은 처음 결과를 돌려준다', async () => {
        const userId = nextUser();
        const key = `k-${userId}`;
        const first = await submit(
            QUIZ_OX_ID,
            [{ questionId: 'q-quiz-1-1', selectedOptionId: 'opt-quiz-1-o' }],
            key,
            userId,
        );
        const retry = await submit(
            QUIZ_OX_ID,
            [{ questionId: 'q-quiz-1-1', selectedOptionId: 'opt-quiz-1-o' }],
            key,
            userId,
        );
        expect(retry.status).toBe(200);
        expect((retry.data as Envelope<SubmissionResult>).data.submissionId).toBe(
            (first.data as Envelope<SubmissionResult>).data.submissionId,
        );
    });

    it('운영 기간이 끝난 미션은 409를 돌려준다', async () => {
        const userId = nextUser();
        const res = await submit(
            ENDED_ID,
            [{ questionId: 'q-quiz-ended-1', selectedOptionId: 'opt-ended-o' }],
            `k-${userId}`,
            userId,
        );
        expect(res.status).toBe(409);
        expect((res.data as { code: string }).code).toBe('MISSION-004');
    });

    it('완료 시드 미션은 목록에서 completed로 표시된다', async () => {
        const userId = nextUser();
        const { data } = await apiClient.get<
            Envelope<{ items: { id: string; completed: boolean }[] }>
        >('/v1/missions', { headers: { 'X-User-ID': userId } });
        const done = data.data.items.find((m) => m.id === DONE_ID);
        expect(done?.completed).toBe(true);
        const active = data.data.items.find((m) => m.id === QUIZ_OX_ID);
        expect(active?.completed).toBe(false);
    });

    it('상세 응답의 문항에는 정답 필드가 없다', async () => {
        const userId = nextUser();
        const { data } = await apiClient.get<Envelope<{ questions: Record<string, unknown>[] }>>(
            `/v1/missions/${QUIZ_OX_ID}`,
            { headers: { 'X-User-ID': userId } },
        );
        for (const question of data.data.questions) {
            expect(question).not.toHaveProperty('correctAnswer');
            expect(question).not.toHaveProperty('correctOptionId');
            expect(question).not.toHaveProperty('isCorrect');
        }
    });
});
