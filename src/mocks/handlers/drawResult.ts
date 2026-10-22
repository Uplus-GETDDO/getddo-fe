import { http } from 'msw';

import type { MyResult, Prize, PublicResults, PublishedPrize } from '@entities/drawResult';

import { env } from '@shared/config/env';

import { mockNow } from '../now';
import { getMockDrawOverview } from './draw';
import { mockEventEntrantIds, mockMyEntrySummary } from './entry';
import { findMockEvent, type MockEvent } from './event';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

// 마스킹된 이름 풀 — 서버가 가린 값을 흉내 낸다(가운데 글자를 가린다). 화면은 받은 문자열을 그대로 쓴다
const MASKED_NAMES = [
    '서*준',
    '김*겸',
    '이*하',
    '박*서',
    '최*민',
    '정*우',
    '한*지',
    '오*예',
    '윤*도',
    '강*하',
];

/**
 * 등수별 경품 구성.
 *
 * 목 이벤트에는 경품이 하나(prizeName·winnerCount)뿐이라 등수를 나눌 수 없다.
 * 시연에서 1·2·3등 연출을 보려면 여러 등수가 필요해 데모 래플에만 따로 적어 둔다.
 */
const PRIZE_SETS: Record<string, { rank: number; name: string; winnerCount: number }[]> = {
    'evt-112': [
        { rank: 1, name: '닌텐도 스위치 2', winnerCount: 1 },
        { rank: 2, name: '무너 메탈릭 피규어', winnerCount: 5 },
        { rank: 3, name: '무너 아크릴 키링 세트', winnerCount: 20 },
    ],
    // 등수·인원이 많은 래플 — 명단이 길어졌을 때의 스크롤을 확인한다
    'evt-113': [
        { rank: 1, name: '무너 메탈릭 피규어', winnerCount: 1 },
        { rank: 2, name: '무너 아크릴 키링 세트', winnerCount: 15 },
        { rank: 3, name: '무너 굿즈 박스', winnerCount: 40 },
    ],
    'evt-106': [
        { rank: 1, name: '다이슨 에어랩', winnerCount: 1 },
        { rank: 2, name: '스타벅스 e카드 3만원권', winnerCount: 10 },
    ],
};

/**
 * 같은 이벤트·등수·순번이면 늘 같은 당첨자를 만든다.
 *
 * 난수를 쓰면 폴링할 때마다 명단이 바뀌어 발표된 결과처럼 보이지 않는다.
 * 뒷자리는 화면의 조회 입력과 맞춰 보는 값이라 특히 고정되어야 한다.
 */
function seededWinner(eventId: string, rank: number, index: number) {
    let hash = 0;
    for (const char of `${eventId}-${rank}-${index}`) {
        hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
    }
    return {
        maskedName: MASKED_NAMES[hash % MASKED_NAMES.length] ?? '익*명',
        maskedPhoneNum: String(hash % 10_000).padStart(4, '0'),
    };
}

function buildPrizes(event: MockEvent): PublishedPrize[] {
    const set = PRIZE_SETS[event.id] ?? [
        { rank: 1, name: event.prizeName, winnerCount: event.winnerCount },
    ];

    // 응모자가 모자라면 자리를 다 채우지 못한다 — 확정된 미충원만 unfilledCount로 적는다
    const participants = event.participantCount ?? 0;

    return (
        set
            // 하위 등수부터 연출할 수 있도록 등수 내림차순으로 내려준다 (05-api/drawing.md)
            .sort((a, b) => b.rank - a.rank)
            .map(({ rank, name, winnerCount }) => {
                const filled = Math.min(winnerCount, Math.max(0, participants));
                return {
                    prizeId: `${event.id}-prize-${rank}`,
                    rank,
                    name,
                    winnerCount: filled,
                    unfilledCount: winnerCount - filled,
                    winners: Array.from({ length: filled }, (_, index) =>
                        seededWinner(event.id, rank, index),
                    ),
                };
            })
    );
}

function buildResults(event: MockEvent, now: number): PublicResults {
    // 공개 여부는 시각이 아니라 당첨자 공개 요청의 성공으로 판정한다 (ADR-022) —
    // 관리자 상태·공개 이력과 같은 추첨 목업의 사실을 읽는다
    const draw = getMockDrawOverview(event.id);
    const isPublished = draw.published;
    const hasEntrants = (event.participantCount ?? 0) > 0;

    const displayStatus: PublicResults['displayStatus'] = !isPublished
        ? 'WAITING'
        : hasEntrants
          ? 'PUBLISHED'
          : 'NO_ENTRANTS';

    return {
        eventId: event.id,
        isPublished,
        // 발표 전에는 공개 정보를 하나도 싣지 않는다 (05-api/drawing.md)
        publishedAt: isPublished ? draw.publishedAt : null,
        revision: isPublished ? draw.revision : null,
        updatedAt: isPublished ? draw.publishedAt : null,
        serverTime: new Date(now).toISOString(),
        displayStatus,
        prizes: isPublished && hasEntrants ? buildPrizes(event) : [],
    };
}

const userIdOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';

/**
 * 본인 당첨 여부 — 공개 명단(E08)의 당첨 자리를 응모 순서대로 나눠 가진다.
 *
 * 사용자마다 따로 뽑으면 1등 한 자리짜리 래플에서 두 사람이 모두 당첨으로 나올 수 있다.
 * 자리 수가 곧 공개된 당첨 인원이므로, 응모 순번이 그 안에 들면 그 등수다.
 *
 * 목업에 실제로 응모 기록이 남는 사용자는 이 브라우저에서 응모한 사람뿐이라
 * (participantCount는 화면 표시용 시드 숫자다) 먼저 응모한 사람이 윗등수를 받는다.
 */
function seededWin(userId: string, prizes: PublishedPrize[], entrants: string[]): Prize | null {
    const slot = entrants.indexOf(userId);
    if (slot < 0) return null;

    let cursor = slot;
    for (const prize of [...prizes].sort((a, b) => a.rank - b.rank)) {
        if (cursor < prize.winnerCount) return toPrize(prize);
        cursor -= prize.winnerCount;
    }
    return null;
}

function toPrize(prize: PublishedPrize): Prize {
    return {
        id: prize.prizeId,
        rank: prize.rank,
        name: prize.name,
        description: null,
        imageUrl: null,
        winnerCount: prize.winnerCount,
    };
}

function buildMyResult(event: MockEvent, userId: string, now: number): MyResult {
    const published = buildResults(event, now);
    const { entryCount } = mockMyEntrySummary(userId, event.id);

    // 응모하지 않았으면 발표와 무관하게 알려 줄 결과가 없다
    if (entryCount === 0) {
        return {
            eventId: event.id,
            result: 'NOT_ENTERED',
            prize: null,
            isPublished: published.isPublished,
            revision: published.revision,
            serverTime: new Date(now).toISOString(),
        };
    }

    // 공개 전에는 추첨이 끝났더라도 당첨 여부를 내려 주지 않는다 (05-api/drawing.md)
    if (!published.isPublished) {
        return {
            eventId: event.id,
            result: 'PENDING',
            prize: null,
            isPublished: false,
            revision: null,
            serverTime: new Date(now).toISOString(),
        };
    }

    const prize = seededWin(userId, published.prizes, mockEventEntrantIds(event.id));
    return {
        eventId: event.id,
        result: prize ? 'WON' : 'LOST',
        prize,
        isPublished: true,
        revision: published.revision,
        serverTime: new Date(now).toISOString(),
    };
}

export const drawResultHandlers = [
    // E08 — 공개 결과 조회
    http.get(api('/v1/events/:eventId/results'), ({ params }) => {
        const eventId = String(params.eventId);
        const event = findMockEvent(eventId);
        if (!event) return fail(404, 'EVENT_NOT_FOUND', '이벤트를 찾을 수 없습니다');

        return ok(buildResults(event, mockNow().getTime()));
    }),
    // E09 — 본인 결과 조회
    http.get(api('/v1/events/:eventId/my-result'), ({ params, request }) => {
        const eventId = String(params.eventId);
        const event = findMockEvent(eventId);
        if (!event) return fail(404, 'EVENT_NOT_FOUND', '이벤트를 찾을 수 없습니다');

        return ok(buildMyResult(event, userIdOf(request), mockNow().getTime()));
    }),
];
