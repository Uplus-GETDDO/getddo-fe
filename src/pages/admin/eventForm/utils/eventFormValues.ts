import { z } from 'zod';

import type { AdminEvent, EventWriteRequest } from '@entities/event';

import { kstInputToUtcIso, utcIsoToKstInput } from '@shared/utils/date';

// 경품의 id는 수정 시 기존 경품 식별용이다 (spec PrizeWrite.id — 없으면 신규로 취급)
// useFieldArray가 'id'를 내부 키로 예약하므로 호출부에서 keyName을 바꿔 충돌을 피한다
const prizeSchema = z.object({
    id: z.string().optional(),
    rank: z.coerce.number().int().min(1, '등수는 1 이상이어야 합니다'),
    name: z.string().trim().min(1, '경품명을 입력하세요'),
    winnerCount: z.coerce.number().int().min(1, '당첨 인원은 1명 이상이어야 합니다'),
    description: z.string(),
    imageKey: z.string(),
});

// 관리자 입력 시각은 KST로 해석한다 — datetime-local 값을 그대로 받고 제출 시 UTC로 변환 (spec 공통 시간 기준)
export const eventFormSchema = z
    .object({
        title: z.string().trim().min(1, '이벤트 이름을 입력하세요'),
        description: z.string().trim().min(1, '설명을 입력하세요'),
        imageKey: z.string(),
        eventType: z.enum(['NO_TICKET', 'TICKET']),
        weightingEnabled: z.boolean(),
        // 상한 없음(월말 소진용)은 빈 입력으로 둔다 — 일반 이벤트는 ADR-010의 사용자당 누적 5장 상한까지
        maxTicketsPerUser: z
            .string()
            .refine(
                (s) => s.trim() === '' || /^[1-5]$/.test(s.trim()),
                '1~5 사이의 정수를 입력하세요',
            ),
        membershipRule: z.enum(['excellent', 'vip', 'vvip']),
        startsAt: z.string().min(1, '시작 시각을 입력하세요'),
        endsAt: z.string().min(1, '마감 시각을 입력하세요'),
        prizes: z
            .array(prizeSchema)
            .min(1, '경품은 최소 1개 필요합니다')
            .refine(
                (prizes) => new Set(prizes.map((p) => p.rank)).size === prizes.length,
                '같은 등수에 경품이 중복됐습니다',
            ),
    })
    .refine((v) => v.endsAt > v.startsAt, {
        message: '마감 시각은 시작 시각 이후여야 합니다',
        path: ['endsAt'],
    });

// coerce를 쓰는 경품 숫자 필드 때문에 입력(z.input)과 출력(z.output) 타입이 다르다 — RHF는 입력 기준으로 폼을 잡는다
export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

/**
 * 유형×가중치 조합을 spec EventWriteRequest로 변환한다.
 * NO_TICKET은 가중치 false·상한 null, 가중치 미적용 TICKET은 1장 고정,
 * 가중치 적용은 빈 입력이면 null(상한 없음) 아니면 입력 장수다 (spec 05-api/event.md 초안).
 */
export function eventFormToRequest(v: EventFormValues): EventWriteRequest {
    const usesTicket = v.eventType === 'TICKET';
    const weighted = usesTicket && v.weightingEnabled;
    return {
        title: v.title.trim(),
        description: v.description.trim(),
        imageKey: v.imageKey.trim() || null,
        eventType: v.eventType,
        weightingEnabled: weighted,
        maxTicketsPerUser: !usesTicket
            ? null
            : !weighted
              ? 1
              : v.maxTicketsPerUser.trim() === ''
                ? null
                : Number(v.maxTicketsPerUser),
        membershipRule: v.membershipRule,
        startsAt: kstInputToUtcIso(v.startsAt),
        endsAt: kstInputToUtcIso(v.endsAt),
        prizes: v.prizes.map((p) => ({
            id: p.id,
            rank: p.rank,
            name: p.name.trim(),
            winnerCount: p.winnerCount,
            description: p.description.trim() || null,
            imageKey: p.imageKey.trim() || null,
        })),
    };
}

// 경품 응답에는 imageKey가 없고 imageUrl만 있다 — URL을 스토리지 키로 재전송하지 않도록 imageKey는 빈 값으로 둔다
export function eventToFormValues(event: AdminEvent): EventFormInput {
    return {
        title: event.title,
        description: event.description,
        imageKey: event.imageKey ?? '',
        eventType: event.eventType,
        weightingEnabled: event.weightingEnabled,
        maxTicketsPerUser: event.maxTicketsPerUser === null ? '' : String(event.maxTicketsPerUser),
        membershipRule: event.membershipRule,
        startsAt: utcIsoToKstInput(event.startsAt),
        endsAt: utcIsoToKstInput(event.endsAt),
        prizes: event.prizes.map((p) => ({
            id: p.id,
            rank: p.rank,
            name: p.name,
            winnerCount: p.winnerCount,
            description: p.description ?? '',
            imageKey: '',
        })),
    };
}
