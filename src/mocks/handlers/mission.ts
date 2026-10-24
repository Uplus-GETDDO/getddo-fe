import { http, HttpResponse } from 'msw';

import type {
    MissionAnswer,
    MissionDetail,
    MissionQuestion,
    MissionSubmissionResult,
    MissionSummary,
} from '@entities/mission';

import { env } from '@shared/config/env';
import { IDEMPOTENCY_HEADER } from '@shared/utils/idempotencyKey';

import { DAY, demoTime } from '../demoTime';
import { mockNow } from '../now';
import { fail, failBody, ok, okBody } from './response';
import { drawMockTicketGrade, recordMockTicketGrant } from './ticket';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

/** 정답 정보는 서버만 안다 — 상세 응답(M02)에서 제외하는 필드 */
interface MockQuestion extends MissionQuestion {
    correctOptionId?: string;
    correctAnswer?: string;
}

// completed·serverTime은 응답 시점에 계산하는 필드라 시드에는 두지 않는다
interface MockMission extends Omit<MissionDetail, 'questions' | 'completed' | 'serverTime'> {
    questions: MockQuestion[];
}

const mockMissions: MockMission[] = [
    {
        id: 'msn-survey-1',
        title: '서비스 이용 경험 설문',
        description:
            '응모 이벤트 서비스 이용 경험을 묻는 설문입니다. 필수 문항에 모두 답하면 완료됩니다.',
        missionType: 'SURVEY',
        startsAt: demoTime(-30 * DAY),
        endsAt: demoTime(60 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-survey-1-1',
                questionType: 'SINGLE_CHOICE',
                questionText: '이벤트 결과 알림을 받고 싶은 채널은 무엇인가요?',
                required: true,
                displayOrder: 1,
                options: [
                    { id: 'opt-survey-1-1', optionText: '앱 푸시', displayOrder: 1 },
                    { id: 'opt-survey-1-2', optionText: '문자 메시지', displayOrder: 2 },
                    { id: 'opt-survey-1-3', optionText: '받지 않는다', displayOrder: 3 },
                ],
            },
            {
                id: 'q-survey-1-2',
                questionType: 'FREE_TEXT',
                questionText: '서비스에서 개선을 바라는 점이 있다면 자유롭게 적어주세요.',
                required: false,
                displayOrder: 2,
                options: [],
            },
        ],
    },
    {
        id: 'msn-quiz-1',
        title: '5G 상식 OX 퀴즈',
        description: '5G 관련 상식을 확인하는 OX 퀴즈입니다. 정답을 맞혀야 완료됩니다.',
        missionType: 'QUIZ',
        startsAt: demoTime(-30 * DAY),
        endsAt: demoTime(60 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-quiz-1-1',
                questionType: 'OX',
                questionText: '5G는 LTE보다 데이터 전송 속도가 빠르다.',
                required: true,
                displayOrder: 1,
                options: [
                    { id: 'opt-quiz-1-o', optionText: 'O', displayOrder: 1 },
                    { id: 'opt-quiz-1-x', optionText: 'X', displayOrder: 2 },
                ],
                correctOptionId: 'opt-quiz-1-o',
            },
        ],
    },
    {
        id: 'msn-quiz-2',
        title: '유플러스 브랜드 퀴즈',
        description: '브랜드를 얼마나 알고 있는지 묻는 단답 퀴즈입니다.',
        missionType: 'QUIZ',
        startsAt: demoTime(-30 * DAY),
        endsAt: demoTime(60 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-quiz-2-1',
                questionType: 'SHORT_ANSWER',
                questionText: '유플러스의 공식 캐릭터 이름은 무엇일까요?',
                required: true,
                displayOrder: 1,
                options: [],
                // 단답 정규화(공백·대소문자 등)는 미션 완료·채점 세부 계약 미정 — 목업은 trim 후 단순 일치로 둔다
                correctAnswer: '무너',
            },
        ],
    },
    // 문항이 여러 개인 퀴즈 — 모달 안에서 문항 영역이 스크롤되는지 확인용 (모든 문항을 맞혀야 완료)
    {
        id: 'msn-quiz-multi',
        title: 'U+ 생활 상식 퀴즈',
        description: '통신·멤버십 상식을 묻는 5문항 퀴즈입니다. 모든 문항을 맞혀야 완료됩니다.',
        missionType: 'QUIZ',
        startsAt: demoTime(-30 * DAY),
        endsAt: demoTime(60 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-multi-1',
                questionType: 'OX',
                questionText: '5G는 LTE보다 지연 시간이 짧다.',
                required: true,
                displayOrder: 1,
                options: [
                    { id: 'opt-multi-1-1', optionText: 'O', displayOrder: 1 },
                    { id: 'opt-multi-1-2', optionText: 'X', displayOrder: 2 },
                ],
                correctOptionId: 'opt-multi-1-1',
            },
            {
                id: 'q-multi-2',
                questionType: 'SINGLE_CHOICE',
                questionText: '유플러스 멤버십 등급이 아닌 것은 무엇일까요?',
                required: true,
                displayOrder: 2,
                options: [
                    { id: 'opt-multi-2-1', optionText: 'VVIP', displayOrder: 1 },
                    { id: 'opt-multi-2-2', optionText: 'VIP', displayOrder: 2 },
                    { id: 'opt-multi-2-3', optionText: '골드', displayOrder: 3 },
                    { id: 'opt-multi-2-4', optionText: '다이아', displayOrder: 4 },
                ],
                correctOptionId: 'opt-multi-2-4',
            },
            {
                id: 'q-multi-3',
                questionType: 'OX',
                questionText: '와이파이는 셀룰러 데이터를 쓰지 않는다.',
                required: true,
                displayOrder: 3,
                options: [
                    { id: 'opt-multi-3-1', optionText: 'O', displayOrder: 1 },
                    { id: 'opt-multi-3-2', optionText: 'X', displayOrder: 2 },
                ],
                correctOptionId: 'opt-multi-3-1',
            },
            {
                id: 'q-multi-4',
                questionType: 'SINGLE_CHOICE',
                questionText: '데이터를 다 쓴 뒤 속도를 제한해 계속 쓰게 하는 서비스는?',
                required: true,
                displayOrder: 4,
                options: [
                    { id: 'opt-multi-4-1', optionText: '데이터 안심옵션', displayOrder: 1 },
                    { id: 'opt-multi-4-2', optionText: '로밍', displayOrder: 2 },
                    { id: 'opt-multi-4-3', optionText: '테더링', displayOrder: 3 },
                ],
                correctOptionId: 'opt-multi-4-1',
            },
            {
                id: 'q-multi-5',
                questionType: 'SHORT_ANSWER',
                questionText: '유플러스의 공식 캐릭터 이름은 무엇일까요?',
                required: true,
                displayOrder: 5,
                options: [],
                correctAnswer: '무너',
            },
        ],
    },
    // 문항이 여러 개인 설문 — 필수·선택 문항이 섞여 있다
    {
        id: 'msn-survey-multi',
        title: '응모 이벤트 만족도 설문',
        description:
            '응모 이벤트 이용 경험을 묻는 5문항 설문입니다. 필수 문항에 모두 답하면 완료됩니다.',
        missionType: 'SURVEY',
        startsAt: demoTime(-30 * DAY),
        endsAt: demoTime(60 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-smulti-1',
                questionType: 'SINGLE_CHOICE',
                questionText: '응모 이벤트에 얼마나 자주 참여하시나요?',
                required: true,
                displayOrder: 1,
                options: [
                    { id: 'opt-smulti-1-1', optionText: '매일', displayOrder: 1 },
                    { id: 'opt-smulti-1-2', optionText: '주 2~3회', displayOrder: 2 },
                    { id: 'opt-smulti-1-3', optionText: '가끔', displayOrder: 3 },
                ],
            },
            {
                id: 'q-smulti-2',
                questionType: 'SINGLE_CHOICE',
                questionText: '가장 좋아하는 응모권 적립 방법은 무엇인가요?',
                required: true,
                displayOrder: 2,
                options: [
                    { id: 'opt-smulti-2-1', optionText: '출석 체크', displayOrder: 1 },
                    { id: 'opt-smulti-2-2', optionText: '게임', displayOrder: 2 },
                    { id: 'opt-smulti-2-3', optionText: '설문·퀴즈', displayOrder: 3 },
                ],
            },
            {
                id: 'q-smulti-3',
                questionType: 'SINGLE_CHOICE',
                questionText: '겟또타임 응모 과정은 이해하기 쉬웠나요?',
                required: true,
                displayOrder: 3,
                options: [
                    { id: 'opt-smulti-3-1', optionText: '쉬웠다', displayOrder: 1 },
                    { id: 'opt-smulti-3-2', optionText: '보통이다', displayOrder: 2 },
                    { id: 'opt-smulti-3-3', optionText: '어려웠다', displayOrder: 3 },
                ],
            },
            {
                id: 'q-smulti-4',
                questionType: 'FREE_TEXT',
                questionText: '받고 싶은 경품이 있다면 적어주세요.',
                required: false,
                displayOrder: 4,
                options: [],
            },
            {
                id: 'q-smulti-5',
                questionType: 'FREE_TEXT',
                questionText: '그 밖에 하고 싶은 말을 자유롭게 적어주세요.',
                required: false,
                displayOrder: 5,
                options: [],
            },
        ],
    },
    {
        id: 'msn-survey-done',
        title: '9월 신규고객 웰컴 선물 설문',
        description: '이미 완료된 미션의 화면 상태를 보여주는 시드입니다.',
        missionType: 'SURVEY',
        startsAt: demoTime(-55 * DAY),
        endsAt: demoTime(60 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-survey-done-1',
                questionType: 'FREE_TEXT',
                questionText: '가입을 결심한 이유를 알려주세요.',
                required: true,
                displayOrder: 1,
                options: [],
            },
        ],
    },
    {
        id: 'msn-quiz-ended',
        title: '지난 시즌 퀴즈',
        description: '운영 기간이 끝난 미션입니다. 제출하면 서버가 거절합니다.',
        missionType: 'QUIZ',
        startsAt: demoTime(-55 * DAY),
        endsAt: demoTime(-25 * DAY),
        rewardTicketCount: 1,
        questions: [
            {
                id: 'q-quiz-ended-1',
                questionType: 'OX',
                questionText: '이 퀴즈는 종료됐다.',
                required: true,
                displayOrder: 1,
                options: [
                    { id: 'opt-ended-o', optionText: 'O', displayOrder: 1 },
                    { id: 'opt-ended-x', optionText: 'X', displayOrder: 2 },
                ],
                correctOptionId: 'opt-ended-o',
            },
        ],
    },
];

/** 멱등키에 묶인 처음 처리 결과 — 업무 거절(4xx)도 저장해 같은 재전송에 같은 응답을 돌려준다 (M03) */
interface StoredAttempt {
    userId: string;
    missionId: string;
    answersJson: string;
    status: number;
    body: unknown;
}
const solvedByUserMission = new Map<string, Set<string>>();
const attempts = new Map<string, StoredAttempt>();

/** 사용자별 제출 기록 — 완료 여부(completed)와 재제출 시 기존 결과 반환에 쓴다 */
const submissionsByUser = new Map<string, MissionSubmissionResult[]>();

const userIdOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';

const seedCompletedSubmission = (): MissionSubmissionResult => ({
    submissionId: 'sub-seed-survey-done',
    missionId: 'msn-survey-done',
    receivedAt: demoTime(-40 * DAY),
    isCompleted: true,
    reward: {
        claimId: 'claim-seed-survey-done',
        ticketCount: 1,
        grantedAt: demoTime(-40 * DAY),
        expiresAt: null,
    },
    createdAt: demoTime(-40 * DAY),
});

const submissionsFor = (userId: string) => {
    let list = submissionsByUser.get(userId);
    if (!list) {
        // 시연 첫 진입에도 완료 상태가 보이게 사용자별 시드 하나를 둔다
        list = [seedCompletedSubmission()];
        submissionsByUser.set(userId, list);
    }
    return list;
};

const hasCompleted = (userId: string, missionId: string) =>
    submissionsFor(userId).some((s) => s.missionId === missionId && s.isCompleted);

const summaryOf = (mission: MockMission, userId: string, now: string): MissionSummary => ({
    id: mission.id,
    title: mission.title,
    imageUrl: mission.imageUrl ?? null,
    missionType: mission.missionType,
    startsAt: mission.startsAt,
    endsAt: mission.endsAt,
    rewardTicketCount: mission.rewardTicketCount,
    completed: hasCompleted(userId, mission.id),
    serverTime: now,
});

const detailOf = (mission: MockMission, userId: string): MissionDetail => ({
    ...summaryOf(mission, userId, mockNow().toISOString()),
    description: mission.description,
    // 정답 필드는 사용자 응답에 포함하지 않는다 (미션 도메인 규칙)
    questions: mission.questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        questionText: question.questionText,
        required: question.required,
        displayOrder: question.displayOrder,
        options: question.options,
    })),
});

const CHOICE_TYPES: MissionQuestion['questionType'][] = ['OX', 'SINGLE_CHOICE'];
const TEXT_TYPES: MissionQuestion['questionType'][] = ['SHORT_ANSWER', 'FREE_TEXT'];

const isValidAnswerFor = (question: MissionQuestion, answer: MissionAnswer) => {
    if (CHOICE_TYPES.includes(question.questionType)) {
        // 선택형은 선택지만 — 소속 선택지인지까지 확인한다
        return (
            answer.answerText === undefined &&
            question.options.some((option) => option.id === answer.selectedOptionId)
        );
    }
    if (TEXT_TYPES.includes(question.questionType)) {
        // 서술형은 텍스트만 — 공백만 있는 답은 제출하지 않은 것으로 본다
        return (
            answer.selectedOptionId === undefined &&
            typeof answer.answerText === 'string' &&
            answer.answerText.trim().length > 0
        );
    }
    return false;
};

const isCorrect = (question: MockQuestion, answer: MissionAnswer) => {
    if (question.correctOptionId !== undefined) {
        return answer.selectedOptionId === question.correctOptionId;
    }
    if (question.correctAnswer !== undefined) {
        const normalize = (text: string) =>
            text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
        return (
            answer.answerText !== undefined &&
            normalize(answer.answerText) === normalize(question.correctAnswer)
        );
    }
    // 정답이 없는 문항(설문 서술형)은 채점 대상이 아니다
    return true;
};

export const missionHandlers = [
    // M01 초안 — Page<MissionSummary> 봉투, page·size는 1부터
    http.get(api('/v1/missions'), ({ request }) => {
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
        const now = mockNow().toISOString();
        const userId = userIdOf(request);
        const items = mockMissions
            .map((mission) => summaryOf(mission, userId, now))
            .slice((page - 1) * size, page * size);
        return ok({ items, page, size, totalElements: mockMissions.length });
    }),

    // M02 초안 — 문항·선택지를 포함한 상세. 정답은 응답하지 않는다
    http.get(api('/v1/missions/:missionId'), ({ params, request }) => {
        const mission = mockMissions.find((m) => m.id === String(params.missionId));
        if (!mission) {
            return fail(404, 'MISSION_NOT_FOUND', '미션을 찾을 수 없습니다');
        }
        return ok(detailOf(mission, userIdOf(request)));
    }),

    // M03 초안 — 멱등키 필수. 같은 키·같은 본문은 처음 결과를 돌려준다
    http.post(api('/v1/missions/:missionId/submissions'), async ({ params, request }) => {
        const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
        if (!idempotencyKey) {
            return fail(400, 'COMMON-002', '멱등키가 필요합니다');
        }
        const userId = userIdOf(request);
        const missionId = String(params.missionId);
        const body = (await request.json().catch(() => null)) as {
            answers?: unknown;
        } | null;
        const answersJson = JSON.stringify(
            Array.isArray(body?.answers)
                ? [...(body.answers as MissionAnswer[])].sort((a, b) =>
                      a.questionId.localeCompare(b.questionId),
                  )
                : null,
        );

        const attempt = attempts.get(idempotencyKey);
        if (attempt) {
            // 같은 키에 다른 내용이 오면 재시도가 아니라 다른 요청이다
            if (
                attempt.userId !== userId ||
                attempt.missionId !== missionId ||
                attempt.answersJson !== answersJson
            ) {
                return fail(409, 'MISSION-005', '같은 멱등키로 다른 제출을 보낼 수 없습니다');
            }
            const status = attempt.status === 201 ? 200 : attempt.status;
            return HttpResponse.json(attempt.body as object, { status });
        }

        // 여기서부터는 키에 처음 묶이는 새 요청 — 업무 거절도 결과를 키에 저장한다
        const remember = (status: number, responseBody: unknown) => {
            attempts.set(idempotencyKey, {
                userId,
                missionId,
                answersJson,
                status,
                body: responseBody,
            });
            return HttpResponse.json(responseBody as object, { status });
        };

        const mission = mockMissions.find((m) => m.id === missionId);
        if (!mission) {
            return remember(404, failBody('MISSION_NOT_FOUND', '미션을 찾을 수 없습니다'));
        }

        if (!Array.isArray(body?.answers)) {
            return remember(400, failBody('COMMON-002', '답변 목록이 올바르지 않습니다'));
        }
        const answers = body.answers as MissionAnswer[];

        // 문항 소속·중복·유형별 필드 검증 — 선택형은 선택지만, 서술형은 텍스트만 받는다
        const questionIds = new Set(answers.map((a) => a?.questionId));
        if (questionIds.size !== answers.length) {
            return remember(400, failBody('COMMON-002', '같은 문항에 중복으로 답할 수 없습니다'));
        }
        const answeredValid = answers.every((answer) => {
            const question = mission.questions.find((q) => q.id === answer?.questionId);
            return question !== undefined && isValidAnswerFor(question, answer);
        });
        if (!answeredValid) {
            return remember(400, failBody('COMMON-002', '답변 형식이 문항과 맞지 않습니다'));
        }

        const missingRequired = mission.questions.some(
            (q) => q.required && !answers.some((a) => a.questionId === q.id),
        );
        if (mission.missionType === 'SURVEY' && missingRequired) {
            return remember(400, failBody('COMMON-002', '필수 문항에 모두 답해야 합니다'));
        }

        // 이미 완료한 제출은 운영 기간 이후에도 기존 결과를 돌려준다.
        const existing = submissionsFor(userId).find(
            (entry) => entry.missionId === missionId && entry.isCompleted,
        );
        if (existing) return remember(200, okBody(existing));
        const now = mockNow();
        if (now < new Date(mission.startsAt) || now >= new Date(mission.endsAt)) {
            return remember(409, failBody('MISSION-004', '미션 운영 기간이 아닙니다'));
        }
        const solvedKey = `${userId}:${missionId}`;
        const solved = solvedByUserMission.get(solvedKey) ?? new Set<string>();
        if (mission.missionType === 'QUIZ') {
            const pendingAnswers = answers.filter((answer) => !solved.has(answer.questionId));
            if (!pendingAnswers.length)
                return remember(
                    400,
                    failBody('MISSION-002', '아직 완료하지 않은 문항에 답해 주세요.'),
                );
            for (const answer of pendingAnswers) {
                const question = mission.questions.find((q) => q.id === answer.questionId)!;
                if (isCorrect(question, answer)) solved.add(question.id);
            }
            solvedByUserMission.set(solvedKey, solved);
        }
        const isCompleted =
            mission.missionType === 'SURVEY' || mission.questions.every((q) => solved.has(q.id));

        const receivedAt = now.toISOString();
        // 미션 보상은 등급 응모권 — 보상 건의 등급을 확률로 추첨해 응답과 지급 이력에 같은 등급을 쓴다
        const grade = isCompleted ? drawMockTicketGrade() : null;
        const result: MissionSubmissionResult = {
            submissionId: idempotencyKey,
            missionId,
            receivedAt,
            isCompleted,
            reward: isCompleted
                ? {
                      claimId: crypto.randomUUID(),
                      ticketCount: mission.rewardTicketCount,
                      grade,
                      grantedAt: receivedAt,
                      expiresAt: null,
                  }
                : null,
            createdAt: receivedAt,
        };

        if (isCompleted && grade) {
            // 완료 보상은 사용자·미션당 등급 응모권 한 장이다.
            recordMockTicketGrant(userId, mission.rewardTicketCount, `${mission.title} 보상`, {
                grade,
                missionId,
            });
        }
        submissionsFor(userId).unshift(result);

        return remember(201, okBody(result));
    }),
];
