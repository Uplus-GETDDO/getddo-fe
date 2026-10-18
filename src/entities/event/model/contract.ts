import { z } from 'zod';

import { adminEventStatusSchema, eventTypeSchema, membershipRuleSchema } from './adminTypes';
import { eventSchema } from './types';

// spec 05-api/event.md E01·E02의 원시 응답 모양 — 화면용 Event는 utils/toEvent.ts의 매퍼로 만든다

// E02 상세의 경품 — 목록(E01)에는 실리지 않는다
export const eventPrizeSchema = z.object({
    id: z.string(),
    rank: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    winnerCount: z.number().int(),
});

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
    membershipRule: membershipRuleSchema,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    status: adminEventStatusSchema,
    serverTime: z.iso.datetime({ offset: true }),

    // 아래는 spec에 없는 시연 전용 필드 — 계약 확정 전까지 목업만 채우고 실서버 응답에는 없다
    detailImageUrl: z.string().nullable().optional(),
    // 상세 상단 캠페인 비주얼(GD-217) — 템플릿 union은 화면용 스키마의 정의를 그대로 쓴다
    detailVisual: eventSchema.shape.detailVisual,
    isRecommended: z.boolean().optional(),
    isTimeRaffle: z.boolean().optional(),
    raffleDetail: z
        .object({
            paragraphs: z.array(z.string()),
            prizeComposition: z.string(),
            shippingSchedule: z.string(),
            membershipNote: z.string(),
        })
        .optional(),
    tags: z.array(z.string()).optional(),
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

export type EventPrize = z.infer<typeof eventPrizeSchema>;
export type EventSummaryResponse = z.infer<typeof eventSummaryResponseSchema>;
export type EventDetailResponse = z.infer<typeof eventDetailResponseSchema>;
