import { z } from 'zod';

import { adminEventStatusSchema, eventTypeSchema, membershipRuleSchema } from './adminTypes';
import { eventPrizeSchema, eventSchema } from './types';

// spec 05-api/event.md E01·E02의 원시 응답 모양 — 화면용 Event는 utils/toEvent.ts의 매퍼로 만든다

// E02 상세의 경품 — 목록(E01)에는 실리지 않는다. 화면 모델과 같은 모양이라 한 곳에서 정의한다
export { eventPrizeSchema } from './types';

// E01 목록 항목 — spec의 EventSummary
export const eventSummaryResponseSchema = z.object({
    id: z.string(),
    title: z.string(),
    // 대표 이미지 — 매퍼가 bannerImageUrl로 옮긴다
    imageUrl: z.string().nullable(),
    eventType: eventTypeSchema,
    weightingEnabled: z.boolean(),
    // spec 필수이나 BE 배포 확인 전까지 optional. E02에는 없으며 상세 매핑에서는 무시한다.
    myEntered: z.boolean().optional(),
    // 경품 당첨 인원의 합계 — 목록에는 prizes가 없어 합계만 따로 받는다.
    // BE 작업 중이라 아직 내려오지 않는다 (2026-10-20 실측) — 올 때까지 optional로 둔다.
    winnerCount: z.number().int().nonnegative().optional(),
    membershipRule: membershipRuleSchema,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    status: adminEventStatusSchema,
    serverTime: z.iso.datetime({ offset: true }),

    // 아래는 spec에 없는 시연 전용 필드 — 계약 확정 전까지 목업만 채우고 실서버 응답에는 없다
    detailImageUrl: z.string().nullable().optional(),
    // 상세 상단 캠페인 비주얼(GD-217) — 템플릿 union은 화면용 스키마의 정의를 그대로 쓴다
    detailVisual: eventSchema.shape.detailVisual,
    isTimeRaffle: z.boolean().optional(),
    raffleDetail: z
        .object({
            paragraphs: z.array(z.string()),
            prizeComposition: z.string(),
            shippingSchedule: z.string(),
        })
        .optional(),
    myEntryCount: z.number().int().nonnegative().nullable().optional(),
    myTicketCount: z.number().int().nonnegative().nullable().optional(),

    // 목록에도 실어 주는지 계약 확인 중 — BE가 추가하면 매퍼가 화면 요약에 반영한다
    description: z.string().optional(),
    prizes: z.array(eventPrizeSchema).optional(),
});

// E02 상세 — 목록 항목 전부에 상세 본문·응모 상한·경품 목록이 더해진다
export const eventDetailResponseSchema = eventSummaryResponseSchema.extend({
    description: z.string(),
    maxTicketsPerUser: z.number().int().nullable(),
    prizes: z.array(eventPrizeSchema),
});

export type { EventPrize } from './types';
export type EventSummaryResponse = z.infer<typeof eventSummaryResponseSchema>;
export type EventDetailResponse = z.infer<typeof eventDetailResponseSchema>;
