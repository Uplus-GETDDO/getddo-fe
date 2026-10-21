import { http } from 'msw';

import type { AdminEventStatus, Event, EventStatus, MembershipRule } from '@entities/event';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { env } from '@shared/config/env';

import { mockNow } from '../now';
// draw.ts도 이 모듈의 mockEvents를 읽는 순환이지만, 호출이 요청 시점으로 미뤄져 초기화 순서에 영향이 없다
import { getMockDrawOverview } from './draw';
import { mockUserHasAcceptedEntry } from './entry';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

const MINUTE = 60 * 1000;

const DEMO_EPOCH_KEY = 'getddo-mock-demo-epoch';

/**
 * 시연 창의 길이 — 기준 시각에서 이만큼 지나면 응모할 수 있는 래플이 하나도 남지 않는다.
 * 아래 HERO 창(기준 +60분)과 같은 값이어야 한다.
 */
const DEMO_WINDOW_MS = 60 * MINUTE;

/**
 * 시연 기준 시각.
 *
 * Date.now() + n으로 매번 계산하면 페이지를 새로 열 때마다 마감이 그만큼 뒤로 밀려서
 * 카운트다운이 리셋된다 — docs/CONTEXT.md가 금지하는 동작이다. 그래서 세션에 저장해 고정한다.
 *
 * 다만 지난 값을 무조건 재사용하면, 탭을 한참 열어 둔 뒤 돌아왔을 때 모든 창이 과거로
 * 넘어가 응모할 래플이 하나도 없게 된다. 창이 전부 끝난 경우에만 기준을 다시 잡는다 —
 * 진행 중인 창은 그대로 두므로 새로고침으로 카운트다운이 밀리지는 않는다.
 *
 * 앵커를 따로따로 저장하지 않고 이 한 값에서 파생시킨다. 개별 저장은 그중 일부만
 * 다시 잡혔을 때 시작이 마감보다 늦는 창을 만든다.
 *
 * 기준을 다시 잡을지는 가상 시계가 아니라 실제로 흐른 시간으로 판단한다.
 * 앞당긴 시각으로 저장해 버리면 실제 시각으로 돌아왔을 때 모든 창이 미래가 되어
 * 래플이 전부 '오픈 예정'이 된다. 가상 시계는 이 창 위를 지나가는 역할만 한다 —
 * 시각을 앞으로 옮기면 마감·발표로 넘어가고, 창 자체는 그대로 남는다.
 */
function demoEpoch(): number {
    const now = Date.now();

    try {
        const saved = sessionStorage.getItem(DEMO_EPOCH_KEY);
        if (saved) {
            const at = new Date(saved).getTime();
            if (!Number.isNaN(at) && now < at + DEMO_WINDOW_MS) return at;
        }
    } catch {
        // 저장소를 쓸 수 없는 환경(테스트 등)에서는 매번 현재 시각을 쓴다
    }

    try {
        sessionStorage.setItem(DEMO_EPOCH_KEY, new Date(now).toISOString());
    } catch {
        // 저장에 실패해도 이번 로드 동안은 같은 값을 쓴다
    }
    return now;
}

const DEMO_EPOCH = demoEpoch();

/** 시연 기준 시각에서 offsetMs 만큼 떨어진 시각 */
function demoTime(offsetMs: number): string {
    return new Date(DEMO_EPOCH + offsetMs).toISOString();
}

/**
 * 세션에 고정된 상대 시각 — 관리자 목업(adminEvent.ts)이 등록·중단·취소 시각에 쓴다.
 *
 * 키마다 따로 저장하지 않고 기준 시각에서 파생시킨다. 개별 저장은 창이 지난 뒤에도
 * 과거 값을 그대로 돌려줘서, 탭을 오래 열어 두면 되살아나지 않는다.
 * key는 호출부에서 어떤 시각인지 읽히도록 남겨 둔다.
 */
export function sessionFixedTime(key: string, offsetMs: number): string {
    void key;
    return demoTime(offsetMs);
}

// 홈 화면 "오늘의 타임 래플" 배너 데모용 — 세션이 유지되는 동안 마감 시각이 움직이지 않는다
const HERO_STARTS_AT = demoTime(-30 * MINUTE);
const HERO_ENDS_AT = demoTime(DEMO_WINDOW_MS);
const UPCOMING_OPENS_AT = demoTime(3 * 60 * MINUTE);

/*
 * 시연 플로우용 시각 — 응모 → 마감 → 발표 대기 → 발표 완료를 몇 분 안에 한 번 돌려보기 위한 것이다.
 * 세션 시작 시점에 고정되므로 새로고침해도 기준이 밀리지 않고, 시간이 실제로 흐른다.
 * 더 빨리 보고 싶으면 관리자 가상 시계(/admin/virtual-clock)로 시간을 앞으로 옮기면 된다.
 */
// 지금 응모할 수 있고 10분 뒤 마감된다 (발표는 ADR-009에 따라 마감 + 5분)
const FLOW_STARTS_AT = demoTime(-5 * MINUTE);
const FLOW_ENDS_AT = demoTime(10 * MINUTE);
// 이미 마감돼 발표를 기다리는 래플 — 화면을 열자마자 발표 대기 상태를 볼 수 있다
const AWAITING_STARTS_AT = demoTime(-62 * MINUTE);
const AWAITING_ENDS_AT = demoTime(-2 * MINUTE);
// 아직 열리지 않은 래플 — 오늘 몇 시 식으로 고정하면 늦은 시각에 데모할 때 오픈 예정이 하나도 남지 않는다
const PENDING_STARTS_AT = demoTime(2 * 60 * MINUTE);
const PENDING_ENDS_AT = demoTime(3 * 60 * MINUTE);
/*
 * 고정 시각(오늘 16시·17시)으로 두면 새벽·오전에 데모를 돌릴 때 진행 중인 래플이
 * 구조적으로 0개가 된다. 대표 래플은 '진행 중' 섹션에서 빠지므로 섹션도 같이 비어 버린다.
 * 그래서 두 개는 시각과 무관하게 열려 있도록 기준 시각에 붙여 둔다.
 */
const OPEN_A_STARTS_AT = demoTime(-45 * MINUTE);
const OPEN_A_ENDS_AT = demoTime(40 * MINUTE);
const OPEN_B_STARTS_AT = demoTime(-20 * MINUTE);
const OPEN_B_ENDS_AT = demoTime(55 * MINUTE);

/**
 * KST 기준 dayOffset일 뒤 hour시의 UTC ISO 문자열.
 * 타임래플은 당일 시간대별로 열리고 닫혀서, 언제 데모를 돌려도 "오픈 15:00" 같은 표기가 자연스럽도록 실행일 기준으로 만든다.
 */
function kstAt(dayOffset: number, hour: number): string {
    const kstNow = new Date(mockNow().getTime() + 9 * 60 * 60 * 1000);
    return new Date(
        Date.UTC(
            kstNow.getUTCFullYear(),
            kstNow.getUTCMonth(),
            kstNow.getUTCDate() + dayOffset,
            hour - 9,
        ),
    ).toISOString();
}

// 상세 화면 안내 문단 — 추첨·차감 정책은 모든 래플이 같아서 공통으로 쓴다
const DRAW_PARAGRAPH =
    '마감 직후 추첨이 자동으로 진행되며, 당첨자에게는 개별 알림톡과 무료 직배송 서비스를 지원합니다. 중복 응모는 가능하지만, 당첨 확률은 표시하지 않으며 응모권 사용 여부와 참여 횟수에 따라 당첨 기회가 달라질 수 있습니다.';
const TICKET_PARAGRAPH =
    '1회 응모 시 필요한 수량만 차감되며, 중복 요청 시 이중 차감되지 않습니다. 보유 응모권이 부족하면 응모가 제한되며, 응모권 사용 여부와 참여 횟수에 따라 당첨 기회가 달라질 수 있습니다.';

/** 타임래플 상세 화면 안내 — 첫 문단과 상품 구성만 이벤트마다 다르다 */
function raffleDetail(intro: string, prizeComposition: string) {
    return {
        paragraphs: [intro, DRAW_PARAGRAPH, TICKET_PARAGRAPH],
        prizeComposition,
        shippingSchedule: '당첨자 발표 후 3 영업일 이내 일괄 발송',
        // 이벤트마다 자격 등급이 달라 응답을 만들 때 그 래플의 등급으로 채운다 (toResponse)
        membershipNote: '',
    };
}

/**
 * 사용자 화면용 목 이벤트 항목.
 * 관리자 목업(adminEvent.ts)이 등록·수정·취소를 이 배열에도 반영해 사용자 목록과 동기화한다.
 */
export interface MockEvent {
    id: string;
    title: string;
    description: string;
    bannerImageUrl: string | null;
    detailImageUrl?: string | null;
    /** 상세 본문을 이미지 대신 글·값으로 받는 캠페인 비주얼 — 있으면 상세 본문이 이것으로 바뀐다 */
    detailVisual?: Event['detailVisual'];
    startsAt: string;
    endsAt: string;
    status: EventStatus;
    isTimeRaffle?: boolean;
    raffleDetail?: ReturnType<typeof raffleDetail>;
    requiredTickets: number;
    /**
     * spec의 이벤트 유형 필드 — 시드에서 비워 두면 entryRuleOf가 requiredTickets로 파생한다.
     * 명시하면 파생보다 우선한다 (월말 소진용·멤버십 제한 등 조합을 직접 지정할 때 쓴다).
     */
    eventType?: 'NO_TICKET' | 'TICKET';
    weightingEnabled?: boolean;
    maxTicketsPerUser?: number | null;
    membershipRule?: MembershipRule;
    prizeName: string;
    winnerCount: number;
    // 응모 현황 원천 — 이벤트 응답(E01/E02)에는 싣지 않고 E03 응모 통계로만 내려간다 (ADR-0007)
    participantCount: number | null;
    usedTicketCount: number | null;
    myEntryCount: number | null;
    myTicketCount: number | null;
}

// requiredTickets > 0 은 모은 응모권을 차감해 응모하는 이벤트, 0 은 응모권 없이 참여하는 이벤트다.
// 이벤트 목록 화면이 이 값으로 위·아래 섹션을 가른다.
// isTimeRaffle 이 true 면 타임래플 화면에만 노출하고 이벤트 목록에서는 뺀다.
/**
 * spec의 이벤트 유형 조합 — 시드가 비워 두면 requiredTickets로 파생한다.
 * 0: 응모권 미사용, 1: 사용·가중치 미적용(브론즈 1장·사용자당 1회), 2장 이상: 일반 가중치(누적 5장).
 * 월말 소진용(가중치 적용·상한 없음)은 시드가 weightingEnabled와 함께 maxTicketsPerUser: null을 명시한다.
 * 멤버십 규칙은 표시 태그('멤버십 혜택')와 별개의 정책 필드다 — 기본은 excellent다.
 */
export function entryRuleOf(event: MockEvent) {
    const eventType: 'NO_TICKET' | 'TICKET' =
        event.eventType ?? (event.requiredTickets > 0 ? 'TICKET' : 'NO_TICKET');
    const weightingEnabled = event.weightingEnabled ?? event.requiredTickets > 1;
    const maxTicketsPerUser =
        event.maxTicketsPerUser !== undefined
            ? event.maxTicketsPerUser
            : eventType === 'NO_TICKET'
              ? null
              : weightingEnabled
                ? 5
                : 1;
    const membershipRule = event.membershipRule ?? 'excellent';
    return { eventType, weightingEnabled, maxTicketsPerUser, membershipRule };
}

// 응모권을 쓰는 응모는 모두 겟또타임이다 — 홈·목록은 겟또타임과 응모권 미사용 이벤트로만 나눈다
export const mockEvents: MockEvent[] = [
    {
        id: 'evt-001',
        isTimeRaffle: true,
        title: '갤럭시 버즈 위클리 래플',
        description: '응모권 1장으로 참여하는 주간 추첨 이벤트',
        bannerImageUrl: null,
        // 상세 화면 본문 이미지 — 실제 URL은 백엔드 연동 후 들어온다. 로컬에서 확인하려면 임의의 이미지 URL을 넣으면 된다
        detailImageUrl: null,
        // 대표 시연 이벤트 — 세션 기준 상대 기간으로 두어 고정 마감일이 지나도 응모할 수 있다
        startsAt: demoTime(-7 * 24 * 60 * MINUTE),
        endsAt: demoTime(7 * 24 * 60 * MINUTE),
        status: 'open',
        requiredTickets: 1,
        prizeName: '갤럭시 버즈',
        winnerCount: 10,
        participantCount: 842,
        usedTicketCount: 1290,
        myEntryCount: 1,
        myTicketCount: 1,
    },
    {
        id: 'evt-002',
        isTimeRaffle: true,
        title: '출석왕 챌린지',
        description:
            '이번 달 출석 미션 완주자 대상 추첨. 응모권 1장부터 참여하고 많이 쓸수록 당첨 확률이 올라가요.',
        bannerImageUrl: null,
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-10-31T14:59:59Z',
        status: 'open',
        requiredTickets: 3,
        prizeName: '네이버페이 포인트 5만원',
        winnerCount: 100,
        participantCount: 2310,
        usedTicketCount: 5400,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-005',
        isTimeRaffle: true,
        title: '스타벅스 e카드 래플',
        description: '응모권 1장으로 참여하는 스타벅스 e카드 추첨 이벤트',
        bannerImageUrl: '/images/events/starbucks-set.webp',
        startsAt: UPCOMING_OPENS_AT,
        endsAt: '2026-10-20T14:59:59Z',
        status: 'upcoming',
        requiredTickets: 1,
        prizeName: '스타벅스 e카드',
        winnerCount: 50,
        participantCount: null,
        usedTicketCount: null,
        myEntryCount: null,
        myTicketCount: null,
    },
    {
        id: 'evt-006',
        title: '데이터 쿠폰 무료 응모',
        description:
            '응모권 없이 누구나 참여할 수 있는 데이터 쿠폰 추첨 이벤트예요. 한 번만 응모할 수 있고, 마감 뒤 자동으로 추첨합니다. 당첨되면 쿠폰이 U+ 멤버십 앱 쿠폰함으로 바로 들어가요.',
        bannerImageUrl: '/images/events/banners/data-coupon.svg',
        /* 쿠폰 한 장 꼴 캠페인 비주얼 — 경품이 한 종류라 등수를 세울 게 없다 */
        detailVisual: {
            template: 'coupon',
            category: '무료 응모',
            headline: ['데이터 5GB', '무료로 받아가세요'],
            subtitle: '버튼 한 번이면 응모 끝! 추첨을 통해 데이터 이용권을 드려요',
            coupon: { name: '데이터 이용권', amount: '5GB', value: '33,000원', emoji: '📶' },
            steps: [
                { title: '로그인', description: '이벤트 페이지에서 로그인해요' },
                { title: '무료 응모', description: '하단 버튼을 눌러 응모를 완료해요' },
                { title: '쿠폰 받기', description: '당첨 시 문자로 쿠폰 번호가 발송돼요' },
            ],
            notices: [
                '이벤트는 1인 1회만 응모할 수 있습니다.',
                // 발표일을 적지 않는다 — 공개 시점은 관리자 확인에 달려 있다 (ADR-022)
                '당첨자에게는 발표 후 문자로 쿠폰 번호가 발송됩니다.',
                '데이터 이용권은 발송일로부터 30일 이내에 등록해야 합니다.',
                '쿠폰은 현금으로 교환하거나 타인에게 양도할 수 없습니다.',
                '부정한 방법으로 응모한 경우 당첨이 취소될 수 있습니다.',
            ],
        },
        startsAt: kstAt(-25, 0),
        endsAt: kstAt(15, 23),
        status: 'open',
        requiredTickets: 0,
        prizeName: 'U+ 데이터 쿠폰 5GB',
        winnerCount: 1000,
        participantCount: 4820,
        usedTicketCount: 0,
        myEntryCount: 1,
        myTicketCount: 0,
    },
    {
        id: 'evt-007',
        title: '아메리카노 쿠폰 데일리 응모',
        description:
            '응모권 없이 참여할 수 있는 커피 쿠폰 추첨 이벤트예요. 마감 뒤 자동으로 추첨하고, 관리자 확인이 끝나면 당첨자 명단을 공개합니다. 쿠폰은 발표 후 순차 지급돼요.',
        bannerImageUrl: '/images/events/banners/americano.png',
        detailImageUrl: '/images/events/americano.jpg',
        /*
         * 응모 현황 달력 꼴 — 기간이 길어 지금 어디쯤인지가 중요한 이벤트다.
         * 달력은 운영자 입력이 아니라 이벤트 기간과 내 응모 기록에서 만든다.
         * heroHex는 경품 사진 배경에서 뽑은 색이라 사진이 히어로 배경에 얹힌 것처럼 이어진다.
         */
        detailVisual: {
            template: 'daily',
            category: '기간 응모',
            headline: ['매일 한 잔,', '아메리카노 쿠폰'],
            subtitle: '응모해 두고 발표를 기다리면 돼요',
            daily: { prizeName: '아메리카노 모바일 쿠폰', heroHex: '#CDEAE4' },
            steps: [
                { title: '응모하기', description: '응모권 없이 버튼 한 번으로 참여해요' },
                { title: '자동 추첨', description: '응모가 마감되면 자동으로 추첨해요' },
                { title: '쿠폰 받기', description: '당첨되면 발표 후 문자로 쿠폰이 와요' },
            ],
            notices: [
                /*
                 * 디자인 원안은 '하루 1회·매일 00:00 초기화'였지만 계약에 그런 규칙이 없다.
                 * 응모권 미사용 이벤트는 사용자당 1회다 (mocks/handlers/entry.ts 사용자당 1회 제한).
                 * TODO: 일일 응모를 하려면 E04 접수·E07 자격에 날짜 단위 초기화 계약이 먼저 필요하다.
                 */
                '이벤트는 기간 중 1인 1회만 참여할 수 있으며, 응모권은 사용되지 않습니다.',
                '응모는 이벤트 종료일 마감 시각에 종료되며, 마감 후에는 참여할 수 없습니다.',
                '당첨 쿠폰은 당첨자 발표 후 문자로 발송됩니다.',
                '쿠폰 유효기간은 발송일로부터 30일이며, 기간 내 미사용 시 소멸됩니다.',
                '부정한 방법으로 응모한 경우 당첨이 취소될 수 있습니다.',
            ],
        },
        startsAt: kstAt(-10, 0),
        endsAt: kstAt(20, 23),
        status: 'open',
        requiredTickets: 0,
        prizeName: '스타벅스 아메리카노 쿠폰',
        winnerCount: 500,
        participantCount: 2110,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-010',
        isTimeRaffle: true,
        title: 'VVIP 전용 데이터 쿠폰 래플',
        description: 'VVIP·VIP 등급 대상 데이터 쿠폰 추첨 이벤트. 응모권 1장부터 참여할 수 있어요.',
        // 유일한 멤버십 제한 시드 — 우수 등급 사용자는 ENTRY-003으로 거절된다
        membershipRule: 'vip',
        bannerImageUrl: '/images/events/data-coupon.webp',
        startsAt: demoTime(5 * 60 * MINUTE),
        endsAt: '2026-10-20T14:59:59Z',
        status: 'upcoming',
        requiredTickets: 3,
        prizeName: 'U+ 데이터 쿠폰 5GB',
        winnerCount: 10,
        participantCount: null,
        usedTicketCount: null,
        myEntryCount: null,
        myTicketCount: null,
    },
    {
        id: 'evt-008',
        isTimeRaffle: true,
        title: '9월 데이터 쿠폰 래플',
        description: '응모권 1장으로 참여했던 데이터 쿠폰 추첨 이벤트',
        bannerImageUrl: '/images/events/data-coupon.webp',
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-09-20T14:59:59Z',
        status: 'closed',
        requiredTickets: 1,
        prizeName: 'U+ 데이터 쿠폰 5GB',
        winnerCount: 50,
        participantCount: 3204,
        usedTicketCount: 4120,
        myEntryCount: 1,
        myTicketCount: 1,
    },
    {
        id: 'evt-009',
        isTimeRaffle: true,
        title: '8월 출석왕 챌린지',
        description: '8월 출석 미션 완주자 대상 추첨 이벤트',
        bannerImageUrl: null,
        startsAt: '2026-08-01T00:00:00Z',
        endsAt: '2026-08-31T14:59:59Z',
        status: 'drawn',
        requiredTickets: 2,
        prizeName: '네이버페이 포인트 3만원',
        winnerCount: 30,
        participantCount: 1890,
        usedTicketCount: 3560,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-011',
        title: '멤버십 위크 포인트 응모',
        description:
            '멤버십 등급별 포인트 혜택 이벤트예요. 응모권 없이 한 번 참여할 수 있고, 마감 뒤 자동으로 추첨합니다. 당첨 포인트는 발표 후 멤버십 계정으로 바로 적립돼요.',
        bannerImageUrl: '/images/events/banners/membership-point.png',
        detailImageUrl: '/images/events/membership-point.webp',
        /*
         * 포인트 금화 꼴 캠페인 비주얼 — 경품이 포인트 하나라 쿠폰도 등수도 세울 게 없다.
         * 추첨 인원·기간·마감 시각·참여 자격은 비주얼에 적지 않고 이벤트 값에서 끌어온다.
         */
        detailVisual: {
            template: 'point',
            category: '멤버십 위크',
            headline: ['멤버십 위크', '포인트 응모'],
            subtitle: '응모권 없이 한 번만 누르면 끝! 마감 후 자동으로 추첨해요',
            point: { name: 'U+ 멤버십 포인트', amount: 5000 },
            steps: [
                { title: '응모하기', description: '응모권 없이 버튼 한 번으로 참여해요' },
                // 마감 시각은 요약 표가 이벤트 값으로 적는다 — 여기에 날짜를 박으면 기간이 바뀔 때 어긋난다
                { title: '자동 추첨', description: '응모가 마감되면 자동으로 추첨해요' },
                { title: '포인트 적립', description: '발표 후 멤버십 계정으로 바로 적립돼요' },
            ],
            notices: [
                '멤버십 우수 등급 이상 고객만 참여할 수 있습니다.',
                '이벤트는 기간 중 1인 1회만 참여할 수 있으며, 응모권은 사용되지 않습니다.',
                '응모는 이벤트 종료일 마감 시각에 종료되며, 마감 후에는 참여할 수 없습니다.',
                '당첨 포인트는 발표 후 멤버십 계정으로 자동 적립됩니다.',
                '적립된 포인트는 현금으로 교환하거나 타인에게 양도할 수 없습니다.',
            ],
        },
        startsAt: kstAt(-8, 0),
        endsAt: kstAt(5, 23),
        status: 'open',
        requiredTickets: 0,
        prizeName: 'U+ 멤버십 포인트 5,000P',
        winnerCount: 1000,
        participantCount: 1540,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-012',
        title: '갤럭시 버즈3 오픈 응모',
        description:
            '응모권 없이 참여하는 갤럭시 버즈3 추첨 이벤트예요. 마감 뒤 자동으로 추첨하고, 관리자 확인이 끝나면 당첨자 명단을 공개합니다. 경품은 발표 후 3 영업일 이내 발송돼요.',
        bannerImageUrl: '/images/events/banners/galaxy-buds.png',
        detailImageUrl: '/images/events/galaxy-buds3.jpg',
        // 발표가 끝난 이벤트 — 이벤트탭에 '발표 완료' 상태가 하나는 있어야 한다
        startsAt: kstAt(-40, 0),
        endsAt: kstAt(-11, 23),
        status: 'open',
        requiredTickets: 0,
        // VIP 전용 — 상세의 '참여 자격' 문구가 등급별로 달라지는 것을 보려면 하나는 상위 등급이어야 한다
        membershipRule: 'vip',
        prizeName: '갤럭시 버즈3',
        winnerCount: 20,
        participantCount: 980,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-013',
        title: '갤럭시 워치5 스트랩 증정 응모',
        description:
            '응모권 없이 참여하는 갤럭시 워치5 40mm 스트랩 증정 이벤트예요. 한 번만 응모할 수 있고, 색상은 당첨자에게 무작위로 발송됩니다. 재고 사정에 따라 동일 가치의 다른 색으로 대체될 수 있어요.',
        bannerImageUrl: '/images/events/banners/galaxy-watch5.png',
        /*
         * 색상 고르기 꼴 캠페인 비주얼 — 굿즈 하나에 색이 여럿이고 발송 색은 무작위다.
         * 추첨 인원·기간·마감 시각·참여 방법·참여 자격은 비주얼에 적지 않고 이벤트 값에서 끌어온다.
         */
        detailVisual: {
            template: 'colorPick',
            category: '한정 증정',
            headline: ['한정 스트랩,', '어떤 색이 올까요?'],
            // 몇 명에게 주는지는 히어로 칩이 winnerCount로 적는다 — 글에 숫자를 박지 않는다
            subtitle: '응모권 없이 한 번 응모하면 추첨을 통해 스트랩을 보내드려요',
            giveaway: {
                name: '갤럭시 워치5 40mm 스트랩',
                /*
                 * 실사 사진은 라벤더 한 색만 있다. 나머지 색은 이 한 장을 색만 틀어서 보인다.
                 * baseHex는 사진에서 실제로 뽑은 스트랩 색이라 라벤더를 고르면 필터 없이 원본이 나온다.
                 * TODO: 색마다 실사 사진을 받아 colors[].photoUrl을 채우면 근사 대신 원본이 나온다.
                 */
                photo: {
                    url: '/images/events/galaxy-watch5.png',
                    baseHex: '#AFA6BD',
                    // 화면은 워치 색과 무관하다 — 필터가 돌리는 것을 원본으로 되살린다
                    overlayUrl: '/images/events/galaxy-watch5-dial.png',
                },
                colors: [
                    { name: '라벤더', hex: '#AFA6BD' },
                    { name: '그라파이트', hex: '#3B3F45' },
                    { name: '실버', hex: '#BFC4CA' },
                    { name: '블루', hex: '#4A6FA5' },
                    { name: '핑크', hex: '#E9A3B4' },
                    { name: '그린', hex: '#7FA58E' },
                ],
            },
            steps: [
                { title: '응모하기', description: '응모권 없이 버튼 한 번으로 참여해요' },
                { title: '추첨', description: '마감 후 자동으로 추첨해요' },
                {
                    title: '랜덤 색상 발송',
                    description: '당첨되면 무작위 색상의 스트랩을 보내드려요',
                },
            ],
            // 사진에 워치 본체가 같이 나오는데 경품은 스트랩뿐이라 눈에 띄는 자리에 못 박는다
            callout: '경품은 스트랩만 제공되며, 사진 속 워치 본체는 포함되지 않아요.',
            notices: [
                '경품은 갤럭시 워치5 40mm 스트랩 1개이며, 워치 본체는 제공되지 않습니다.',
                '사진 속 워치 본체는 스트랩 착용 예시를 보여 주기 위한 연출입니다.',
                '멤버십 우수 등급 이상 고객만 참여할 수 있습니다.',
                '이벤트는 기간 중 1인 1회만 참여할 수 있으며, 응모권은 사용되지 않습니다.',
                // 마감 날짜를 박지 않는다 — 요약 표가 이벤트 값으로 적는다
                '응모는 이벤트 종료일 마감 시각에 종료되며, 마감 후에는 참여할 수 없습니다.',
                '스트랩 색상은 선택할 수 없으며, 당첨자에게 무작위로 발송됩니다.',
                '재고 사정에 따라 동일 가치의 다른 색상으로 대체될 수 있습니다.',
                '경품은 현금으로 교환하거나 타인에게 양도할 수 없습니다.',
            ],
        },
        startsAt: kstAt(-28, 0),
        endsAt: kstAt(9, 23),
        status: 'open',
        requiredTickets: 0,
        prizeName: '갤럭시 워치5 40mm 스트랩',
        winnerCount: 20,
        participantCount: 640,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-014',
        isTimeRaffle: true,
        title: 'VIP 전용 10월 래플',
        description: 'VIP 이상 멤버십 전용 추첨 이벤트. 브론즈 응모권 1장으로 참여해요.',
        // 진행 중인 멤버십 제한 시드 — 우수 등급은 ENTRY-003으로 거절돼 화면에서 안내가 보인다
        membershipRule: 'vip',
        bannerImageUrl: null,
        startsAt: demoTime(-10 * 24 * 60 * MINUTE),
        endsAt: demoTime(20 * 24 * 60 * MINUTE),
        status: 'open',
        requiredTickets: 1,
        prizeName: 'U+ 데이터 쿠폰 10GB',
        winnerCount: 20,
        participantCount: 210,
        usedTicketCount: 210,
        myEntryCount: 0,
        myTicketCount: 0,
    },

    {
        id: 'evt-201',
        isTimeRaffle: true,
        title: '갤럭시 탭 S11 응모',
        description: '응모권 1장으로 참여하는 태블릿 추첨 이벤트',
        bannerImageUrl: null,
        startsAt: '2026-09-05T00:00:00Z',
        endsAt: '2026-10-05T14:59:59Z',
        status: 'open',
        requiredTickets: 1,
        prizeName: '갤럭시 탭 S11',
        winnerCount: 3,
        participantCount: 1820,
        usedTicketCount: 2640,
        myEntryCount: 1,
        myTicketCount: 1,
    },
    {
        id: 'evt-202',
        title: '배달앱 5천원 쿠폰 응모',
        description:
            '응모권 없이 참여하는 배달 쿠폰 추첨 이벤트예요. 한 번만 응모할 수 있고, 쿠폰은 발표 후 문자로 받은 코드로 배달앱에 등록해 쓸 수 있어요. 쿠폰 유효기간은 발급일로부터 30일입니다.',
        bannerImageUrl: '/images/events/banners/delivery-coupon.svg',
        /*
         * 금액권 티켓 꼴 캠페인 비주얼 — 경품이 금액권 하나다.
         * 추첨 인원·기간·마감 시각·참여 방법·참여 자격은 비주얼에 적지 않고 이벤트 값에서 끌어온다.
         */
        detailVisual: {
            template: 'voucher',
            category: '배달 쿠폰 추첨',
            headline: ['배달앱 5천원', '쿠폰 응모'],
            subtitle: '응모권 없이 한 번만 응모하면 추첨에 참여할 수 있어요',
            voucher: {
                name: '배달앱 쿠폰',
                amount: 5000,
                amountLabel: '5천원',
                validDays: 30,
                emoji: '🛵',
            },
            steps: [
                { title: '응모하기', description: '응모권 없이 버튼 한 번으로 참여해요' },
                {
                    title: '문자로 코드 받기',
                    description: '당첨되면 발표 후 쿠폰 코드가 문자로 와요',
                },
                {
                    title: '배달앱에 등록',
                    description: '받은 코드를 배달앱 쿠폰함에 등록해 써요',
                },
            ],
            smsPreview: {
                from: '[이벤트] 당첨 안내',
                lines: [
                    '축하합니다! 배달앱 쿠폰 5천원에 당첨되셨어요.',
                    '쿠폰 코드: XXXX-XXXX-XXXX',
                    '배달앱 쿠폰함에서 코드를 등록해 주세요.',
                ],
            },
            notices: [
                '멤버십 우수 등급 이상 고객만 참여할 수 있습니다.',
                '이벤트는 기간 중 1인 1회만 참여할 수 있으며, 응모권은 사용되지 않습니다.',
                // 마감 날짜를 박지 않는다 — 요약 표가 이벤트 값으로 적는다
                '응모는 이벤트 종료일 마감 시각에 종료되며, 마감 후에는 참여할 수 없습니다.',
                '당첨자에게는 발표 후 쿠폰 코드가 문자로 발송됩니다.',
                '쿠폰 유효기간은 발급일로부터 30일이며, 기간 내 미등록 또는 미사용 시 소멸됩니다.',
                '쿠폰은 현금으로 교환하거나 타인에게 양도할 수 없습니다.',
            ],
        },
        startsAt: kstAt(-36, 0),
        endsAt: kstAt(9, 23),
        status: 'open',
        requiredTickets: 0,
        prizeName: '배달앱 5,000원 쿠폰',
        winnerCount: 10,
        participantCount: 3120,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-203',
        title: '무너 캘린더 증정 응모',
        description:
            '응모권 없이 참여하는 2027년 무너 캘린더 증정 이벤트예요. 한 번만 응모할 수 있고, 캘린더는 당첨자 주소로 무료 배송됩니다. 주소가 등록되지 않은 경우 당첨이 취소될 수 있어요.',
        bannerImageUrl: '/images/events/banners/muno-calendar.svg',
        // 발표가 끝난 이벤트 — '발표 완료' 상태를 둘로 둬서 목록 거르기가 비어 보이지 않게 한다
        startsAt: kstAt(-34, 0),
        endsAt: kstAt(-4, 23),
        status: 'open',
        requiredTickets: 0,
        prizeName: '무너 2027 캘린더',
        winnerCount: 200,
        participantCount: 1460,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-204',
        isTimeRaffle: true,
        title: '데이터 2GB 충전 쿠폰 응모',
        description: '응모권 1장으로 참여하는 데이터 충전 쿠폰 추첨 이벤트',
        bannerImageUrl: '/images/events/data-coupon.webp',
        startsAt: '2026-09-08T00:00:00Z',
        endsAt: '2026-10-24T14:59:59Z',
        status: 'open',
        requiredTickets: 1,
        prizeName: 'U+ 데이터 쿠폰 2GB',
        winnerCount: 500,
        participantCount: 2740,
        usedTicketCount: 3180,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-205',
        title: '멤버십 VIP콕 더블 혜택',
        description:
            'VVIP 등급에게 VIP콕 혜택을 한 번 더 드리는 이벤트예요. 응모권 없이 한 번 참여할 수 있고, 당첨되면 이번 달 VIP콕을 한 번 더 쓸 수 있는 이용권이 지급됩니다.',
        bannerImageUrl: '/images/events/banners/vip-double.png',
        detailImageUrl: '/images/events/vip-double.png',
        // 아직 열리지 않은 이벤트 — '오픈 예정' 상태와 잠긴 응모 버튼을 확인하려면 하나는 미래여야 한다
        startsAt: kstAt(2, 0),
        endsAt: kstAt(30, 23),
        status: 'open',
        requiredTickets: 0,
        membershipRule: 'vvip',
        prizeName: 'VIP콕 더블 이용권',
        winnerCount: 800,
        // 아직 열리지 않아 응모자도, 내 응모도 없다
        participantCount: null,
        usedTicketCount: null,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-206',
        isTimeRaffle: true,
        title: 'CGV 영화 관람권 응모',
        description:
            '응모권 1장부터 참여하고 많이 쓸수록 당첨 확률이 올라가는 영화 관람권 추첨 이벤트',
        bannerImageUrl: null,
        startsAt: '2026-09-03T00:00:00Z',
        endsAt: '2026-10-27T14:59:59Z',
        status: 'open',
        requiredTickets: 2,
        prizeName: 'CGV 관람권 2매',
        winnerCount: 150,
        participantCount: 4210,
        usedTicketCount: 8640,
        myEntryCount: 2,
        myTicketCount: 4,
    },
    {
        id: 'evt-207',
        isTimeRaffle: true,
        title: '에어팟 4 응모',
        description: '응모권 1장부터 참여하고 많이 쓸수록 당첨 확률이 올라가는 이어폰 추첨 이벤트',
        bannerImageUrl: null,
        startsAt: '2026-09-06T00:00:00Z',
        endsAt: '2026-10-06T14:59:59Z',
        status: 'open',
        requiredTickets: 2,
        prizeName: '에어팟 4',
        winnerCount: 5,
        participantCount: 3640,
        usedTicketCount: 7120,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-208',
        title: '무너 리유저블 컵 증정',
        description:
            '응모권 없이 참여하는 한정 리유저블 컵 증정 이벤트예요. 한 번만 응모할 수 있고, 컵은 당첨자 발표 후 순차 발송됩니다. 수량 한정이라 조기 종료될 수 있어요.',
        bannerImageUrl: '/images/events/banners/reusable-cup.svg',
        /*
         * 방금 마감돼 발표를 기다리는 이벤트 — 화면을 열자마자 '발표 대기'를 볼 수 있다.
         * 마감 + 5분이 지나면 '발표 완료'로 넘어간다. 다시 보려면 새로고침하거나
         * 관리자 가상 시계(/admin/virtual-clock)로 시간을 되돌리면 된다.
         */
        startsAt: kstAt(-20, 0),
        endsAt: demoTime(-2 * MINUTE),
        status: 'open',
        requiredTickets: 0,
        prizeName: '무너 리유저블 컵',
        winnerCount: 400,
        participantCount: 1230,
        usedTicketCount: 0,
        myEntryCount: 0,
        myTicketCount: 0,
    },

    // ── 타임래플 ── 정해진 시간에만 열리는 한정 굿즈 래플. 전부 응모권을 사용한다.
    {
        id: 'evt-003',
        title: '무너 한정 굿즈 타임 래플',
        description:
            '무너 캐릭터를 메탈릭 코팅으로 새로 빚은 커스텀 피규어입니다. 아크릴 케이스와 인증 카드를 갖춘 소량 제작분이라 이번 시즌이 지나면 다시 만들지 않습니다.',
        bannerImageUrl: null,
        startsAt: HERO_STARTS_AT,
        endsAt: HERO_ENDS_AT,
        status: 'open',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '무너 커스텀 피규어를 메탈릭 코팅으로 마감한 타임래플 전용 구성입니다. 제작 수량이 정해져 있어 이번 회차가 끝나면 추가로 만들지 않습니다.',
            '무너 커스텀 메탈릭 피규어 1종 + 아크릴 디스플레이 케이스 + 인증 카드',
        ),
        requiredTickets: 1,
        prizeName: '무너 한정 굿즈 세트',
        winnerCount: 5,
        participantCount: 1234,
        usedTicketCount: 6412,
        myEntryCount: 2,
        myTicketCount: 2,
    },
    {
        id: 'evt-004',
        title: '닌텐도 스위치 2',
        description:
            '국내 정식 발매 구성 그대로의 미개봉 새 제품입니다. 조이콘 두 개와 전용 캐리 파우치가 함께 들어 있어 받는 날 바로 꺼내 쓸 수 있습니다.',
        bannerImageUrl: '/images/events/nintendo-switch-2.webp',
        startsAt: kstAt(0, 15),
        endsAt: kstAt(0, 22),
        status: 'open',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '정해진 한 시간 동안만 열리는 래플입니다. 국내 정식 발매 구성 그대로, 개봉하지 않은 새 제품을 단 한 분께 드립니다.',
            '닌텐도 스위치 2 본체 + 조이콘 2 + 전용 캐리 파우치',
        ),
        requiredTickets: 1,
        prizeName: '닌텐도 스위치 2',
        winnerCount: 1,
        participantCount: 1284,
        usedTicketCount: 3102,
        myEntryCount: 2,
        myTicketCount: 2,
    },
    {
        id: 'evt-101',
        title: '에어팟 프로 3',
        description:
            '지하철과 카페의 소음을 눌러 주는 노이즈 캔슬링 이어폰입니다. 실리콘 팁이 세 가지 크기로 들어 있어 귀에 맞는 것을 골라 쓸 수 있습니다.',
        bannerImageUrl: null,
        startsAt: OPEN_A_STARTS_AT,
        endsAt: OPEN_A_ENDS_AT,
        status: 'open',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '소음이 많은 출퇴근길에서도 몰입할 수 있는 노이즈 캔슬링 이어폰입니다. 정품 등록까지 마친 새 제품으로 보내드립니다.',
            '에어팟 프로 3 본체 + 충전 케이스 + 실리콘 팁 3종',
        ),
        requiredTickets: 2,
        prizeName: '에어팟 프로 3',
        winnerCount: 3,
        participantCount: 2048,
        usedTicketCount: 5120,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-102',
        title: '무너 인형 세트',
        description:
            '무너와 친구들 네 캐릭터를 인형으로 옮긴 세트입니다. 이번 시즌 생산분만으로 구성했고 추가 제작 계획은 없습니다.',
        bannerImageUrl: null,
        startsAt: OPEN_B_STARTS_AT,
        endsAt: OPEN_B_ENDS_AT,
        status: 'open',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '무너와 친구들을 한 번에 만날 수 있는 인형 세트입니다. 이번 시즌 생산분으로만 구성했고 추가 제작 계획은 없습니다.',
            '무너와 친구들 인형 4종 + 전용 보관 파우치',
        ),
        requiredTickets: 1,
        prizeName: '무너 인형 4종 세트',
        winnerCount: 20,
        participantCount: 3320,
        usedTicketCount: 4180,
        myEntryCount: 1,
        myTicketCount: 1,
    },
    {
        id: 'evt-103',
        title: '아이패드 에어 M3',
        description:
            '필기와 영상 편집을 한 대로 소화하는 11형 태블릿입니다. 정품 스마트 폴리오가 함께 들어가 커버와 스탠드로 그대로 쓸 수 있습니다.',
        bannerImageUrl: null,
        startsAt: kstAt(0, 20),
        endsAt: kstAt(0, 21),
        status: 'upcoming',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '필기와 영상 작업을 한 대로 끝낼 수 있는 태블릿입니다. 정품 스마트 폴리오를 함께 드립니다.',
            '아이패드 에어 M3 11형 128GB + 정품 스마트 폴리오',
        ),
        requiredTickets: 3,
        prizeName: '아이패드 에어 M3',
        winnerCount: 1,
        participantCount: null,
        usedTicketCount: null,
        myEntryCount: null,
        myTicketCount: null,
    },
    {
        id: 'evt-104',
        title: '무너 키링 세트',
        description:
            '가방이나 파우치에 달 수 있는 아크릴 키링 여섯 개입니다. 캐릭터마다 표정을 다르게 만들어 모으는 재미를 남겼습니다.',
        bannerImageUrl: null,
        startsAt: kstAt(0, 21),
        endsAt: kstAt(0, 22),
        status: 'upcoming',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '가방이나 파우치에 달기 좋은 무너 키링 6종 세트입니다. 컬렉터 카드가 함께 들어갑니다.',
            '무너 아크릴 키링 6종 + 컬렉터 카드',
        ),
        requiredTickets: 1,
        prizeName: '무너 키링 6종 세트',
        winnerCount: 50,
        participantCount: null,
        usedTicketCount: null,
        myEntryCount: null,
        myTicketCount: null,
    },
    {
        id: 'evt-105',
        title: 'LG 스탠바이미 2',
        description:
            '바퀴 달린 스탠드에 올려 방마다 옮겨 가며 보는 화면입니다. 배터리를 내장해 콘센트가 없는 자리에서도 쓸 수 있습니다.',
        bannerImageUrl: null,
        startsAt: PENDING_STARTS_AT,
        endsAt: PENDING_ENDS_AT,
        status: 'upcoming',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '자리를 옮겨 가며 볼 수 있는 무빙 스크린입니다. 전용 스탠드까지 함께 드립니다.',
            'LG 스탠바이미 2 본체 + 전용 무빙 스탠드',
        ),
        requiredTickets: 3,
        prizeName: 'LG 스탠바이미 2',
        winnerCount: 1,
        participantCount: null,
        usedTicketCount: null,
        myEntryCount: null,
        myTicketCount: null,
    },
    {
        id: 'evt-106',
        title: '갤럭시 워치8',
        description:
            '운동 기록과 수면 추적을 손목에서 한 번에 확인하는 스마트워치입니다. 스트랩이 하나 더 들어 있어 상황에 따라 바꿔 낄 수 있습니다.',
        bannerImageUrl: null,
        startsAt: AWAITING_STARTS_AT,
        endsAt: AWAITING_ENDS_AT,
        status: 'closed',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '운동과 수면 기록을 함께 챙길 수 있는 스마트워치입니다. 추가 스트랩을 함께 드렸습니다.',
            '갤럭시 워치8 40mm + 추가 스트랩 1종',
        ),
        requiredTickets: 2,
        prizeName: '갤럭시 워치8',
        winnerCount: 2,
        participantCount: 1740,
        usedTicketCount: 3980,
        myEntryCount: 1,
        myTicketCount: 2,
    },
    {
        id: 'evt-107',
        title: '무너 굿즈 박스',
        description:
            '머그컵과 에코백, 스티커 팩을 한 상자에 담은 시즌 구성입니다. 머그컵과 에코백은 이번 시즌에만 제작했습니다.',
        bannerImageUrl: null,
        startsAt: kstAt(-1, 13),
        endsAt: kstAt(-1, 14),
        // 어제 끝나고 발표까지 끝난 래플 — 공개 시드다 (추첨 목업이 이 값으로 과거 공개를 재현한다)
        status: 'drawn',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '무너 시즌 굿즈를 한 상자에 담았습니다. 머그컵과 에코백은 이번 시즌에만 제작된 구성입니다.',
            '무너 머그컵 + 스티커 팩 + 에코백',
        ),
        requiredTickets: 1,
        prizeName: '무너 시즌 굿즈 박스',
        winnerCount: 30,
        participantCount: 2960,
        usedTicketCount: 3410,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        // 등수가 여럿이고 당첨자가 많은 래플 — 결과 화면의 등수 카드와 명단 스크롤을 확인한다
        id: 'evt-113',
        title: '무너 컬렉터 패키지 대형 래플',
        description:
            '피규어와 키링, 굿즈 박스를 등수별로 나눠 드리는 대형 래플입니다. 1등부터 3등까지 당첨자를 한 번에 뽑았습니다.',
        bannerImageUrl: null,
        startsAt: kstAt(-1, 10),
        endsAt: kstAt(-1, 12),
        status: 'drawn',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '무너 컬렉터 패키지를 등수별로 나눠 드립니다. 1등 메탈릭 피규어, 2등 아크릴 키링 세트, 3등 굿즈 박스 구성입니다.',
            '1등 무너 메탈릭 피규어 · 2등 무너 아크릴 키링 세트 · 3등 무너 굿즈 박스',
        ),
        requiredTickets: 2,
        prizeName: '무너 메탈릭 피규어',
        winnerCount: 56,
        participantCount: 4820,
        usedTicketCount: 9640,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-108',
        title: '다이슨 에어랩',
        description:
            '고온으로 인한 열 손상을 줄이면서 말리고 마는 멀티 스타일러입니다. 전용 케이스에 헤드를 정리해 두고 쓸 수 있습니다.',
        bannerImageUrl: null,
        startsAt: kstAt(-1, 15),
        endsAt: kstAt(-1, 16),
        status: 'closed',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '열 손상을 줄이며 스타일링할 수 있는 멀티 스타일러입니다. 전용 케이스를 함께 드렸습니다.',
            '다이슨 에어랩 멀티 스타일러 + 전용 케이스',
        ),
        requiredTickets: 3,
        prizeName: '다이슨 에어랩',
        winnerCount: 1,
        participantCount: 4120,
        usedTicketCount: 9840,
        myEntryCount: 2,
        myTicketCount: 6,
    },
    {
        id: 'evt-109',
        title: '소니 WH-1000XM6',
        description:
            '장거리 이동에서도 주변 소음을 눌러 주는 헤드폰입니다. 하드 케이스와 항공 어댑터가 들어 있어 기내에서도 그대로 연결됩니다.',
        bannerImageUrl: null,
        startsAt: kstAt(-1, 17),
        endsAt: kstAt(-1, 18),
        status: 'drawn',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '업계 최고 수준의 노이즈 캔슬링 헤드폰입니다. 장거리 이동에 쓸 수 있는 항공 어댑터를 함께 드렸습니다.',
            '소니 WH-1000XM6 본체 + 하드 케이스 + 항공 어댑터',
        ),
        requiredTickets: 2,
        prizeName: '소니 WH-1000XM6',
        winnerCount: 2,
        participantCount: 2280,
        usedTicketCount: 5060,
        myEntryCount: 0,
        myTicketCount: 0,
    },
    {
        id: 'evt-110',
        title: '무너 한정 담요',
        description:
            '겨울 시즌에만 제작한 무너 극세사 담요입니다. 보관 파우치에 접어 넣으면 부피가 줄어 차 안이나 캠핑장에서도 쓰기 좋습니다.',
        bannerImageUrl: null,
        startsAt: kstAt(-1, 19),
        endsAt: kstAt(-1, 20),
        status: 'drawn',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '겨울 시즌 한정으로 제작한 무너 극세사 담요입니다. 보관 파우치가 함께 들어갑니다.',
            '무너 극세사 담요 1종 + 보관 파우치',
        ),
        requiredTickets: 1,
        prizeName: '무너 한정 담요',
        winnerCount: 40,
        participantCount: 3610,
        usedTicketCount: 4220,
        myEntryCount: 1,
        myTicketCount: 1,
    },
    {
        id: 'evt-111',
        title: '스타벅스 럭키백',
        description:
            '텀블러와 드립백 원두, 리유저블 컵을 함께 담은 구성입니다. 집과 사무실에 하나씩 두고 번갈아 쓸 수 있게 컵을 두 종류로 넣었습니다.',
        bannerImageUrl: '/images/events/starbucks-set.webp',
        startsAt: kstAt(-1, 21),
        endsAt: kstAt(-1, 22),
        status: 'drawn',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '텀블러와 원두를 함께 담은 럭키백입니다. 리유저블 컵이 함께 들어갑니다.',
            '스타벅스 텀블러 + 드립백 원두 세트 + 리유저블 컵',
        ),
        requiredTickets: 1,
        prizeName: '스타벅스 럭키백',
        winnerCount: 25,
        participantCount: 1980,
        usedTicketCount: 2340,
        myEntryCount: 0,
        myTicketCount: 0,
    },

    // ── 시연 플로우용 ── 응모 → 마감 → 발표 대기 → 발표 완료를 몇 분 안에 한 번 돌려보기 위한 래플
    {
        id: 'evt-112',
        title: '무너 시그니처 머그 타임 래플',
        description:
            '무너 얼굴을 입체로 올린 도자기 머그입니다. 손잡이 안쪽까지 유약을 입혀 설거지 후에도 물이 고이지 않습니다.',
        bannerImageUrl: null,
        startsAt: FLOW_STARTS_AT,
        endsAt: FLOW_ENDS_AT,
        status: 'open',
        isTimeRaffle: true,
        raffleDetail: raffleDetail(
            '무너 시그니처 머그는 타임래플 전용으로 소량 제작한 도자기 머그입니다. 전자레인지와 식기세척기를 모두 쓸 수 있습니다.',
            '무너 시그니처 머그 1종 + 전용 코스터',
        ),
        requiredTickets: 1,
        prizeName: '무너 시그니처 머그',
        winnerCount: 10,
        participantCount: 412,
        usedTicketCount: 530,
        myEntryCount: 0,
        myTicketCount: 0,
    },
];

/** 응모 목업이 한도·잔액을 검사하기 전에 대상 이벤트를 찾을 때 쓴다 */
export function findMockEvent(eventId: string) {
    return mockEvents.find((e) => e.id === eventId) ?? null;
}

/**
 * 응모 목업이 접수를 확정한 뒤 호출한다 — 내 응모 기록과 실시간 현황 지표를 함께 올린다.
 * 서버가 보관할 상태를 목업에서 흉내 내는 것이라 응모 핸들러가 아니라 이벤트 데이터 옆에 둔다.
 */
export function recordMockEventEntry(
    event: NonNullable<ReturnType<typeof findMockEvent>>,
    ticketCount: number,
) {
    // 같은 사람이 여러 번 응모해도 응모자 수는 한 번만 는다
    if ((event.myEntryCount ?? 0) === 0) {
        event.participantCount = (event.participantCount ?? 0) + 1;
    }
    event.myEntryCount = (event.myEntryCount ?? 0) + 1;
    event.myTicketCount = (event.myTicketCount ?? 0) + ticketCount;
    event.usedTicketCount = (event.usedTicketCount ?? 0) + ticketCount;
}

/** E03 응모 통계 — 목업의 시드·접수 카운터를 EntryStatistics 모양으로 바꾼다 */
export function getMockEventStatistics(event: NonNullable<ReturnType<typeof findMockEvent>>) {
    return {
        eventId: event.id,
        participantCount: event.participantCount ?? 0,
        totalSpentTicketCount: event.usedTicketCount ?? 0,
        mySpentTicketCount: event.myTicketCount ?? 0,
        serverTime: mockNow().toISOString(),
    };
}

/** ADR-026 — 최초 자동 추첨은 마감 + 1분부터 대상이 된다. 공개 예정 시각이 아니다 */
export const DRAW_DELAY_MS = 60 * 1000;

/**
 * 응답 시점의 이벤트 상태.
 *
 * 목 데이터에 적어 둔 status는 작성 당시의 값이라 시간이 지나면 기간과 어긋난다
 * (마감일이 지났는데 계속 진행 중으로 남는 식). 서버가 할 일이므로 응답을 만들 때 다시 계산해
 * 진행 예정 → 진행 중 → 마감이 실제로 이어지게 한다.
 * 발표 완료('drawn')는 시간이 아니라 당첨자 공개 요청의 성공으로만 생긴다 (ADR-022).
 */
function statusAt(startsAt: string, endsAt: string, now: number, published: boolean): EventStatus {
    const starts = new Date(startsAt).getTime();
    const ends = new Date(endsAt).getTime();

    if (now < starts) return 'upcoming';
    if (now < ends) return 'open';
    // 마감 후 당첨자 공개까지는 '발표 대기' 구간이다 — 시각이 지나도 공개되지 않는다
    return published ? 'drawn' : 'closed';
}

/** 이 이벤트가 공개됐는지 — 추첨 목업의 공개 사실과 같은 값을 읽는다 */
const isPublishedEvent = (eventId: string): boolean => getMockDrawOverview(eventId).published;

/** 응모·자격 목업이 응모 가능 상태를 판정할 때 쓴다 — 저장값이 아니라 시간으로 재계산한 상태 */
export function mockEventEffectiveStatus(event: MockEvent): EventStatus {
    return statusAt(event.startsAt, event.endsAt, mockNow().getTime(), isPublishedEvent(event.id));
}

// spec의 원시 상태(enum) — 화면 상태와 다른 계약 값이다. 발표 완료는 PUBLISHED로 싣는다
const SPEC_STATUS: Record<EventStatus, AdminEventStatus> = {
    upcoming: 'SCHEDULED',
    open: 'OPEN',
    closed: 'CLOSED',
    drawn: 'PUBLISHED',
    canceled: 'CANCELED',
    ended: 'NO_ENTRANTS',
};

/**
 * 목 이벤트를 spec의 EventDetail 모양으로 바꾼다 — 실서버와 같은 계약이라
 * 화면 필드(상태·배너·응모권 수·경품 요약)는 entities/event의 toEvent 매퍼가 파생한다.
 * 추첨·발표 예정 시각은 싣지 않는다. 최초 공개는 관리자가 명단을 확인한 뒤 직접 하는 절차라
 * 사용자에게 약속할 시각이 없다 (GD-203, 05-api/event.md). 관리자 응답에만 drawScheduledAt을 준다.
 * 응모 현황(participantCount·usedTicketCount)은 E03 전용이라 싣지 않는다 (ADR-0007).
 */
function toResponse(event: MockEvent, now: number) {
    const rule = entryRuleOf(event);
    return {
        id: event.id,
        title: event.title,
        description: event.description,
        imageUrl: event.bannerImageUrl,
        detailImageUrl: event.detailImageUrl ?? null,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: SPEC_STATUS[
            statusAt(event.startsAt, event.endsAt, now, isPublishedEvent(event.id))
        ],
        serverTime: new Date(now).toISOString(),
        ...rule,
        prizes: [
            {
                id: `${event.id}-prize-1`,
                rank: 1,
                name: event.prizeName,
                description: null,
                imageUrl: null,
                winnerCount: event.winnerCount,
            },
        ],
        // 시연 전용 표시 필드 — spec에 없어 실서버 응답에는 오지 않는다
        isTimeRaffle: event.isTimeRaffle,
        detailVisual: event.detailVisual,
        // 멤버십 안내는 공통 문구가 아니라 이 래플의 자격 등급으로 적는다
        raffleDetail: event.raffleDetail && {
            ...event.raffleDetail,
            membershipNote: `${MEMBERSHIP_LABEL[rule.membershipRule]} 등급 이상 응모할 수 있어요`,
        },
        myEntryCount: event.myEntryCount,
        myTicketCount: event.myTicketCount,
    };
}

/** E01 목록 항목은 spec의 EventSummary — description·prizes·maxTicketsPerUser는 상세(E02)에만 있다 */
function toSummary(event: MockEvent, now: number, userId: string | null) {
    const {
        description: _description,
        prizes: _prizes,
        maxTicketsPerUser: _maxTicketsPerUser,
        ...summary
    } = toResponse(event, now);
    void _description;
    void _prizes;
    void _maxTicketsPerUser;
    return {
        ...summary,
        // 목록에는 prizes가 없어 당첨 인원 합계를 따로 싣는다 (BE 작업 중인 계약과 같은 모양)
        winnerCount: event.winnerCount,
        myEntered: userId ? mockUserHasAcceptedEntry(userId, event.id) : false,
    };
}

/**
 * 마감 + 1분의 최초 자동 추첨 기준 시각 — 관리자 응답에만 싣는다 (05-api/event.md AdminEvent).
 * 실제 추첨 실행·명단 확인·결과 공개가 끝났다는 뜻이 아니다 (ADR-026).
 */
export function mockDrawScheduledAt(endsAt: string): string {
    return new Date(new Date(endsAt).getTime() + DRAW_DELAY_MS).toISOString();
}

export const eventHandlers = [
    // E01 — Page 봉투 + status 필터. 목업 항목은 시연 표시용 필드(내 응모 등)를 더 싣는다
    http.get(api('/v1/events'), ({ request }) => {
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const size = Math.max(1, Number(url.searchParams.get('size')) || 20);
        const status = url.searchParams.get('status');
        const now = mockNow().getTime();
        const items = mockEvents
            .map((event) =>
                toSummary(
                    event,
                    now,
                    request.headers.get('X-User-Role') === 'ADMIN'
                        ? null
                        : request.headers.get('X-User-ID'),
                ),
            )
            .filter((event) => !status || event.status === status);
        return ok({
            items: items.slice((page - 1) * size, page * size),
            page,
            size,
            totalElements: items.length,
        });
    }),
    http.get(api('/v1/events/:eventId'), ({ params }) => {
        const event = mockEvents.find((e) => e.id === params.eventId);
        if (!event) {
            return fail(404, 'RESOURCE_NOT_FOUND', '이벤트를 찾을 수 없습니다');
        }
        return ok(toResponse(event, mockNow().getTime()));
    }),
];
