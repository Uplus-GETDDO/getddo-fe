import { http } from 'msw';

import { env } from '@shared/config/env';
import { formatYmd } from '@shared/utils/date';

import { mockNow } from '../now';
import { fail, ok } from './response';
import { drawMockTicketGrade, recordMockTicketGrant } from './ticket';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

// 게임 종류는 게임 담당자 확정 전 임시 목록 (getddo-spec 게임 규칙: '타코야끼 만들기'는 후보)
// dailyLimit은 홈 위젯 호환용, description·thumbnailUrl은 게임 카드·상세용 임시 계약
interface GameMeta {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    dailyLimit: number;
}

const mockGames: GameMeta[] = [
    {
        id: 'game-dino',
        title: '타꼬런',
        description: '소스병과 꼬치를 뛰어넘으며 멀리 달려요',
        thumbnailUrl: '/images/games/takoyaki-run.jpg',
        dailyLimit: 1,
    },
    {
        id: 'game-takoyaki',
        title: '타코야끼 만들기',
        description: '타이밍 맞춰 뒤집어 노릇하게 구워요',
        thumbnailUrl: null,
        dailyLimit: 1,
    },
    {
        // 룰렛 돌리기 자리를 타꼬 타이밍 맞추기로 바꿨다 (게임 담당자 결정)
        id: 'game-timing',
        title: '타꼬 타이밍 맞추기',
        description: '왔다 갔다 하는 이쑤시개로 타꼬를 딱 맞춰 꽂아요',
        // 피그마 image 184
        thumbnailUrl: '/images/games/takko-timing.jpg',
        dailyLimit: 1,
    },
    {
        // 카드 뒤집기 자리를 글자색깔 맞추기로 바꿨다 (게임 담당자 결정)
        id: 'game-color',
        title: '글자색깔 맞추기',
        description: '글자 뜻 말고 글자 색을 골라요',
        // 피그마 image 189
        thumbnailUrl: '/images/games/color-word.jpg',
        dailyLimit: 1,
    },
    {
        // 두더지 잡기 자리를 타꼬 주문(순서 기억)으로 바꿨다 — 다른 게임과 쓰는 능력이 겹치지 않게
        id: 'game-order',
        title: '타꼬 주문',
        description: '손님 주문을 외워 순서대로 내줘요',
        // 피그마 image 255
        thumbnailUrl: '/images/games/takko-order.jpg',
        dailyLimit: 1,
    },
];

// 플레이·보상 상태는 사용자별로 다르다 — 한 사용자의 보상 수령이 다른 사용자의 상태를 바꾸지 않는다
interface GamePlayState {
    bestScore?: number;
    todayPlayCount: number;
    rewardedToday: boolean;
    remainingPlays: number;
}

const seedPlayState: Record<string, GamePlayState> = {
    'game-dino': { bestScore: 0, todayPlayCount: 0, rewardedToday: false, remainingPlays: 1 },
    'game-takoyaki': {
        bestScore: 2589,
        todayPlayCount: 0,
        rewardedToday: false,
        remainingPlays: 1,
    },
    'game-timing': { bestScore: 0, todayPlayCount: 0, rewardedToday: false, remainingPlays: 1 },
    'game-color': { bestScore: 120, todayPlayCount: 0, rewardedToday: false, remainingPlays: 1 },
    'game-order': { bestScore: 0, todayPlayCount: 0, rewardedToday: false, remainingPlays: 1 },
};

const defaultPlayState = (): GamePlayState => ({
    todayPlayCount: 0,
    rewardedToday: false,
    remainingPlays: 1,
});

const userIdOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';

interface GameHistory {
    bestScore: number;
    days: Map<string, GamePlayState>;
}

const statesByUser = new Map<string, Map<string, GameHistory>>();

const stateFor = (userId: string, gameId: string): GamePlayState => {
    let states = statesByUser.get(userId);
    if (!states) {
        states = new Map();
        statesByUser.set(userId, states);
    }
    let history = states.get(gameId);
    if (!history) {
        history = { bestScore: seedPlayState[gameId]?.bestScore ?? 0, days: new Map() };
        states.set(gameId, history);
    }
    const date = formatYmd(mockNow().toISOString());
    let state = history.days.get(date);
    if (!state) {
        // 날짜별 기록을 보존해 가상 시계를 되돌려도 같은 날 보상을 다시 지급하지 않는다.
        state = defaultPlayState();
        history.days.set(date, state);
    }
    state.bestScore = history.bestScore;
    return state;
};

export const gameHandlers = [
    // G01 초안 — 목록은 배열을 data에 싣는다
    http.get(api('/v1/games'), ({ request }) => {
        const userId = userIdOf(request);
        return ok(mockGames.map((game) => ({ ...game, ...stateFor(userId, game.id) })));
    }),
    // 플레이 결과 — 새로고침 전까지 최고점·오늘 플레이·보상 여부를 기억한다.
    // 게임별 하루 1회 응모권 1장: 오늘 첫 유효 플레이에만 지급한다 (getddo-spec 게임 규칙)
    // spec은 G03 plays 생성 → G04 result 제출의 두 단계지만, 게임별 검증 계약 미확정으로 최종 계약이 아니라
    // 한 단계 제출을 유지한다 — 계약 확정 후 G03/G04로 나눈다 (features/playGame의 TODO와 연결)
    http.post(api('/v1/games/:gameId/play'), async ({ params, request }) => {
        const game = mockGames.find((item) => item.id === params.gameId);
        if (!game) {
            return fail(404, 'RESOURCE_NOT_FOUND', '게임을 찾을 수 없습니다');
        }
        const userId = userIdOf(request);

        const { score } = (await request.json()) as { score: number };
        const state = stateFor(userId, game.id);
        state.bestScore = Math.max(state.bestScore ?? 0, score);
        statesByUser.get(userId)!.get(game.id)!.bestScore = state.bestScore;
        state.todayPlayCount += 1;
        const ticketsGranted = state.rewardedToday ? 0 : 1;
        // 게임 보상은 등급 응모권 1장 — 서버가 확률로 등급 하나를 결정한다 (getddo-spec ticket.md)
        const grade = ticketsGranted > 0 ? drawMockTicketGrade() : null;
        if (ticketsGranted > 0 && grade) {
            state.rewardedToday = true;
            state.remainingPlays = 0;
            recordMockTicketGrant(userId, ticketsGranted, `${game.title} 게임 보상`, {
                grade,
                gameId: game.id,
            });
        }
        return ok(
            {
                gameId: game.id,
                score,
                bestScore: state.bestScore,
                todayPlayCount: state.todayPlayCount,
                ticketsGranted,
                // 받은 보상 — 색깔 게임 연동 계약의 reward 모양 (지급·만료 시각은 응모권 쪽 값이라 생략)
                reward: grade ? { ticketCount: ticketsGranted, grade } : null,
            },
            201,
        );
    }),
];
