import { http } from 'msw';

import { missionWriteSchema } from '@entities/mission';
import { env } from '@shared/config/env';

import type { MockMission } from './mission';

import { mockNow } from '../now';
import { mockMissions } from './mission';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

/*
 * AM01~AM03 관리자 미션 — 사용자 화면과 같은 mockMissions 시드를 관리자 계약으로 변환해 낸다.
 * 상태는 서버 저장 상태가 아니라 요청 시각 기준으로 계산한다 (운영 종료 시각이 지나면 ENDED).
 * AM04 설문 집계·AM05 자유 서술 답변은 아직 목업이 없다 — 상세 시트의 집계 패널만
 * 로컬에서 조회 실패로 보인다.
 */
const adminSummaryOf = (mission: MockMission) => ({
    id: mission.id,
    title: mission.title,
    description: mission.description,
    missionType: mission.missionType,
    startsAt: mission.startsAt,
    endsAt: mission.endsAt,
    rewardTicketCount: 1,
    imageKey: null,
    status: mockNow().getTime() >= Date.parse(mission.endsAt) ? 'ENDED' : 'ACTIVE',
    rewardPolicyId: `rp-${mission.id}`,
    createdBy: 'admin-demo',
    createdByName: '관리자',
    createdAt: mission.createdAt ?? mission.startsAt,
    updatedAt: mission.updatedAt ?? mission.createdAt ?? mission.startsAt,
});

// AM02/AM03 공통 문항 응답 — 저장형(MockQuestion)을 관리자 계약형으로 옮긴다
const adminQuestionsOf = (mission: MockMission) =>
    mission.questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        questionText: question.questionText,
        required: question.required,
        displayOrder: question.displayOrder,
        correctAnswer: question.correctAnswer,
        options: question.options.map((option) => ({
            id: option.id,
            optionText: option.optionText,
            displayOrder: option.displayOrder,
            isCorrect: option.id === question.correctOptionId || undefined,
        })),
    }));

export const adminMissionHandlers = [
    // AM01 — startsAt 내림차순(같으면 id 내림차순), 필터는 유형·상태·제목 검색어·시작일 [from,to)
    http.get(api('/v1/admin/missions'), ({ request }) => {
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
        const missionType = url.searchParams.get('missionType');
        const status = url.searchParams.get('status');
        const keyword = url.searchParams.get('keyword')?.trim();
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        const filtered = mockMissions
            .map(adminSummaryOf)
            .filter(
                (m) =>
                    (!missionType || m.missionType === missionType) &&
                    (!status || m.status === status) &&
                    (!keyword || m.title.includes(keyword)) &&
                    (!from || m.startsAt >= from) &&
                    (!to || m.startsAt < to),
            )
            .sort((a, b) => b.startsAt.localeCompare(a.startsAt) || b.id.localeCompare(a.id));
        return ok({
            items: filtered.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: filtered.length,
        });
    }),

    // AM02 — 목록 필드 + 문항·선택지(정답 포함). 관리자 화면이라 채점 필드도 내려준다
    http.get(api('/v1/admin/missions/:missionId'), ({ params }) => {
        const mission = mockMissions.find((m) => m.id === String(params.missionId));
        if (!mission) {
            return fail(404, 'MISSION-003', '미션을 찾을 수 없습니다');
        }
        return ok({
            ...adminSummaryOf(mission),
            questions: adminQuestionsOf(mission),
        });
    }),

    // AM03 — 등록은 시드 배열에 바로 붙고(세션 안에서만 유지) 상태는 시작 전이어도 ACTIVE다.
    // 요청 문항에는 id가 없으므로 저장형(id 부여·isCorrect→correctOptionId)으로 정규화하고,
    // 감사 시각은 등록 시각(mockNow)을 쓴다 — 응답은 AM02와 같은 형태다
    http.post(api('/v1/admin/missions'), async ({ request }) => {
        const parsed = missionWriteSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return fail(400, 'COMMON-002', '필수값을 확인해 주세요');
        }
        const body = parsed.data;
        const createdAt = mockNow().toISOString();
        const mission: MockMission = {
            id: `msn-admin-${crypto.randomUUID()}`,
            title: body.title,
            description: body.description,
            missionType: body.missionType,
            startsAt: body.startsAt,
            endsAt: body.endsAt,
            rewardTicketCount: 1,
            createdAt,
            updatedAt: createdAt,
            questions: body.questions.map((question, qIndex) => {
                const correctIndex = (question.options ?? []).findIndex(
                    (option) => option.isCorrect,
                );
                const options = (question.options ?? []).map((option, oIndex) => ({
                    id: `opt-new-${qIndex + 1}-${oIndex + 1}`,
                    optionText: option.optionText,
                    displayOrder: option.displayOrder,
                }));
                return {
                    id: `q-new-${qIndex + 1}`,
                    questionType: question.questionType,
                    questionText: question.questionText,
                    required: question.required ?? true,
                    displayOrder: question.displayOrder,
                    correctAnswer: question.correctAnswer,
                    options,
                    correctOptionId: correctIndex >= 0 ? options[correctIndex]?.id : undefined,
                };
            }),
        };
        mockMissions.push(mission);
        return ok({ ...adminSummaryOf(mission), questions: adminQuestionsOf(mission) }, 201);
    }),
];
