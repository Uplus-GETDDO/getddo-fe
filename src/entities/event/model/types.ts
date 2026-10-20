import { z } from 'zod';

import { eventTypeSchema, membershipRuleSchema } from './adminTypes';

export const eventStatusSchema = z.enum([
    'upcoming',
    'open',
    'closed',
    'drawn',
    'canceled',
    'ended',
]);

/** 캠페인 비주얼의 모든 꼴이 함께 쓰는 값 (detailVisual 참고) */
const detailVisualCommonShape = {
    /** 히어로 칩 문구 (예: '응모 이벤트') — 목록 카드의 tags와 별개다 */
    category: z.string(),
    /** 히어로 큰 제목 — 줄바꿈 자리를 운영자가 정하므로 줄 단위 배열로 받는다 */
    headline: z.array(z.string()),
    subtitle: z.string(),
    steps: z.array(z.object({ title: z.string(), description: z.string() })),
    notices: z.array(z.string()),
};

// 서버 응답 스키마 — startsAt/endsAt은 UTC ISO 8601 문자열, 화면 표시 시 shared/utils/date의 KST 변환 사용
export const eventSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    // 목록 카드 썸네일 (가로형)
    bannerImageUrl: z.string().nullable(),
    // 상세 화면 본문 이미지 — 이벤트마다 디자이너가 만드는 세로로 긴 한 장. 썸네일과 비율·용도가 달라 분리했다.
    // TODO: 필드명·형식·용량 제한은 백엔드와 미합의 (docs/CONTEXT.md "배너 이미지 형식·용량 제한 — 담당자 확정 대기")
    detailImageUrl: z.string().nullable().optional(),
    detailVisual: z
        .discriminatedUnion('template', [
            /** 등수별 경품을 줄로 세우는 꼴 — 1·2·3등이 있는 추첨 이벤트 */
            z.object({
                template: z.literal('prizeTiers'),
                ...detailVisualCommonShape,
                prizes: z.array(
                    z.object({
                        rank: z.string(),
                        name: z.string(),
                        count: z.number().int().positive(),
                        /** 경품 그림 대신 쓰는 이모지 — 없으면 자리를 비운다 */
                        emoji: z.string().optional(),
                    }),
                ),
            }),
            /** 경품 한 종류를 쿠폰 한 장으로 크게 보이는 꼴 — 데이터·기프티콘 무료 응모 */
            z.object({
                template: z.literal('coupon'),
                ...detailVisualCommonShape,
                coupon: z.object({
                    /** 쿠폰 종류 (예: '데이터 이용권') */
                    name: z.string(),
                    /** 쿠폰에 큰 글씨로 박는 값 (예: '5GB') */
                    amount: z.string(),
                    /** 쿠폰 액면가 — 없으면 자리를 비운다 */
                    value: z.string().optional(),
                    /** 사진 대신 쓰는 이모지 — 경품 사진이 없을 때 자리를 채운다 */
                    emoji: z.string().optional(),
                }),
            }),
            /** 포인트를 금화 한 장으로 보이는 꼴 — 멤버십 포인트 응모 */
            z.object({
                template: z.literal('point'),
                ...detailVisualCommonShape,
                point: z.object({
                    /** 포인트 종류 (예: 'U+ 멤버십 포인트') */
                    name: z.string(),
                    /** 금화에 박는 포인트 수 */
                    amount: z.number().int().positive(),
                }),
            }),
            /** 금액권을 뜯는 티켓 한 장으로 보이는 꼴 — 배달·쇼핑 쿠폰 응모 */
            z.object({
                template: z.literal('voucher'),
                ...detailVisualCommonShape,
                voucher: z.object({
                    /** 금액권 종류 (예: '배달앱 쿠폰') */
                    name: z.string(),
                    /** 티켓에 박는 금액 (원) */
                    amount: z.number().int().positive(),
                    /**
                     * 화면에 적을 금액 표기 — 없으면 amount를 '5,000원'으로 적는다.
                     * '5천원'처럼 운영자가 쓰는 말이 따로 있을 때만 준다. 금액 자체는 amount가 원천이다.
                     */
                    amountLabel: z.string().optional(),
                    /** 발급일로부터 쓸 수 있는 날수 */
                    validDays: z.number().int().positive(),
                    /** 사진 대신 쓰는 이모지 — 경품 사진이 없을 때 자리를 채운다 */
                    emoji: z.string().optional(),
                }),
                /** 당첨 안내 문자 미리보기 — 운영자가 실제 발송 문구를 적는다. 없으면 자리를 비운다 */
                smsPreview: z.object({ from: z.string(), lines: z.array(z.string()) }).optional(),
            }),
            /**
             * 기간 동안의 응모 현황을 달력으로 보이는 꼴 — 쿠폰처럼 기간이 긴 응모 이벤트.
             * 달력은 운영자 입력이 아니라 이벤트 기간과 내 응모 기록에서 만든다.
             */
            z.object({
                template: z.literal('daily'),
                ...detailVisualCommonShape,
                daily: z.object({
                    /** 경품 이름 (예: '아메리카노 모바일 쿠폰') */
                    prizeName: z.string(),
                    /** 히어로 배경 — 경품 사진 배경과 같은 색을 주면 사진이 자연스럽게 얹힌다 */
                    heroHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
                }),
            }),
            /** 색상이 여럿인 굿즈를 골라 보는 꼴 — 색상 랜덤 발송 증정 이벤트 */
            z.object({
                template: z.literal('colorPick'),
                ...detailVisualCommonShape,
                giveaway: z.object({
                    /** 굿즈 이름 (예: '갤럭시 워치5 40mm') */
                    name: z.string(),
                    /*
                     * 색이 하나만 찍힌 기준 사진 — 나머지 색은 이 한 장을 틀어서 보인다.
                     * 밝기를 조절하므로 배경이 투명해야 한다 (흰 배경이면 배경까지 회색이 된다).
                     */
                    photo: z
                        .object({
                            url: z.string(),
                            /** 이 사진에 실제로 찍힌 색 — colors 중 하나와 같아야 그 색이 원본 그대로 나온다 */
                            baseHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
                            /*
                             * 색을 바꾸면 안 되는 부분만 남긴 같은 크기의 덧장 사진.
                             * 화면처럼 굿즈 색과 상관없는 영역은 기준 사진 위에 원본 그대로 덮어 되살린다.
                             */
                            overlayUrl: z.string().optional(),
                        })
                        .optional(),
                    /*
                     * 미리보기용 색상 — 실제 발송 색상 목록이다.
                     *
                     * photoUrl이 있으면 그 색의 실사 사진을 보이고, 없으면 hex로 칠한 그림을 보인다.
                     * 사진과 그림을 한 화면에서 섞으면 어느 쪽이 실제인지 헷갈려서, 사진이 한 장이라도
                     * 있으면 사진 있는 색만 고를 수 있게 한다 (ColorPickEventVisual).
                     */
                    colors: z
                        .array(
                            z.object({
                                name: z.string(),
                                /** #RRGGBB — 스와치 색이자, 사진이 없을 때 그림에 칠하는 색 */
                                hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
                                /** 이 색 실사 사진 — 색마다 따로 찍어야 한다 */
                                photoUrl: z.string().optional(),
                            }),
                        )
                        .min(1),
                }),
                /** 참여 방법 아래 따로 띄우는 한 줄 — 없으면 자리를 비운다 */
                callout: z.string().optional(),
            }),
        ])
        .optional(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: eventStatusSchema,
    // 발표 예정 시각(publicationScheduledAt)은 ADR-022 수동 공개 전환으로 계약에서 제거됐다 —
    // 서버가 내려주지 않으므로 화면도 '발표 대기' 상태만 보인다 (getddo-spec 05-api/event.md)
    // 정해진 시간에만 열리는 한정 굿즈 래플 — 겟또타임 화면에만 노출하고 이벤트 목록에서는 뺀다.
    // 서버는 이 값을 따로 주지 않는다. 기본 이벤트는 NO_TICKET, 겟또타임은 TICKET 전체라는
    // R4 확정(getddo-spec 05-api/event.md)에 따라 toEvent가 eventType으로 판정해 채운다.
    isTimeRaffle: z.boolean().optional(),
    // 타임래플 상세 화면의 안내 문구 — 운영자가 이벤트마다 작성하는 값이라 계산으로 만들 수 없다.
    // TODO: 필드 구성은 백엔드와 미합의. 없으면 상세 화면이 기본값으로 대체한다.
    raffleDetail: z
        .object({
            paragraphs: z.array(z.string()),
            prizeComposition: z.string(),
            shippingSchedule: z.string(),
            membershipNote: z.string(),
        })
        .optional(),
    // spec EventSummary의 응모 규칙 필드 — 응모 요청(tickets 맵)의 허용 조합을 이 값으로 판정한다.
    // 미사용은 NO_TICKET, 브론즈 1장 고정은 TICKET+weightingEnabled:false, 일반 가중치는 누적 상한이 있는
    // weightingEnabled:true, 월말 소진용은 maxTicketsPerUser:null 조합이다 (getddo-spec 05-api/event.md)
    eventType: eventTypeSchema,
    weightingEnabled: z.boolean(),
    myEntered: z.boolean().default(false),
    // 상한 실값은 상세(E02)에만 있다 — 목록(E01)만으로 만든 이벤트는 undefined다
    maxTicketsPerUser: z.number().int().nullable().optional(),
    membershipRule: membershipRuleSchema,
    // 레거시 표시용 필드 — 목록 섹션 분리·카드 표시에 쓴다. 응모 규칙 판정은 위 네 필드를 따른다.
    // TODO: 응모권 필요 여부 표시를 eventType으로 옮기는 전환은 별도 작업
    requiredTickets: z.number().int().nonnegative(),
    // 경품 요약 — prizes는 상세(E02)에만 있어 목록만으로 만든 이벤트에는 없다 (spec EventSummary)
    prizeName: z.string().optional(),
    winnerCount: z.number().int().positive().optional(),
    // 응모 현황(응모자 수·차감 합계)은 E03 전용 조회(entities/entry의 useEntryStatistics)로 받는다 — ADR-0007
    myEntryCount: z.number().int().nonnegative().nullable().optional(),
    // 내가 이 이벤트에 지금까지 쓴 응모권 수 — 추가 응모로 한도(ADR-010)까지 얼마나 남았는지 계산하는 값.
    // 한 번에 여러 장을 쓸 수 있어서 myEntryCount × requiredTickets로는 실제 사용량을 알 수 없다.
    // TODO: 필드명·제공 여부는 백엔드와 미합의. 없으면 myEntryCount × requiredTickets로 근사한다.
    myTicketCount: z.number().int().nonnegative().nullable().optional(),
});

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type Event = z.infer<typeof eventSchema>;
