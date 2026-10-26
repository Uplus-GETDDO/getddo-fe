import { http } from 'msw';
import { z } from 'zod';

import { env } from '@shared/config/env';
import { formatYmd, kstNextMonthStart } from '@shared/utils/date';

import { mockNow } from '../now';
import { fail, ok } from './response';
import { drawMockTicketGrade, recordMockTicketGrant } from './ticket';

const api = (path: string) => `${env.apiBaseUrl}${path}`;
const definitions = [
    {
        code: 'COLOR_WORD',
        name: '글자색깔 맞추기',
        version: 'color-word',
        minimum: 50,
        rules: {
            initialLives: 3,
            pointsPerCorrect: 10,
            initialTimeLimitMs: 3000,
            timeLimitDecreaseMs: 80,
            minimumTimeLimitMs: 1200,
        },
    },
    {
        code: 'TAKKO_ORDER',
        name: '타꼬 주문',
        version: 'takko-order',
        minimum: 18,
        rules: { initialLives: 3, startLength: 3, maxLength: 8 },
    },
    {
        code: 'TAKKO_RUN',
        name: '타꼬런',
        version: 'takko-run',
        minimum: 400,
        rules: { minimumRewardScore: 400, maxTicks: 72000 },
    },
    {
        code: 'TAKKO_TIMING',
        name: '타꼬 타이밍 맞추기',
        version: 'takko-timing',
        minimum: 50,
        rules: { points: 10, perfectPoints: 20, minimumRewardScore: 50 },
    },
];
const games = definitions.map((game, index) => ({
    ...game,
    id: `0199f000-0000-7000-8000-00000000010${index}`,
    description: null,
}));
const summary = (game: (typeof games)[number]) => ({
    id: game.id,
    code: game.code,
    name: game.name,
    description: game.description,
});
interface Receipt {
    playId: string;
    status: 'VALID' | 'INVALID';
    score: number | null;
    completedAt: string;
    reward: { ticketCount: number; grade: string; grantedAt: string; expiresAt: string } | null;
}
interface Play {
    userId: string;
    gameId: string;
    playToken: string;
    body?: string;
    result?: Receipt;
}
const plays = new Map<string, Play>();
const statistics = new Map<
    string,
    { bestScore: number; totalScore: number; validPlayCount: number; days: Set<string> }
>();
const userOf = (request: Request) => request.headers.get('X-User-ID') ?? 'anonymous';
function stateFor(userId: string, gameId: string) {
    const key = `${userId}:${gameId}`;
    let state = statistics.get(key);
    if (!state) {
        state = { bestScore: 0, totalScore: 0, validPlayCount: 0, days: new Set() };
        statistics.set(key, state);
    }
    return state;
}

// 로컬 개발용 고정 예제만 판정한다. 실제 서버 검증을 대체하지 않는다.
function fixtureScore(code: string, input: Record<string, unknown>): number | null {
    if (code === 'TAKKO_TIMING' && Array.isArray(input.taps)) {
        const taps = input.taps as { sequence: number; elapsedMs: number }[];
        const signature = taps.map((tap) => tap.elapsedMs).join(',');
        if (!taps.every((tap, i) => tap.sequence === i + 1)) return null;
        return (
            (
                {
                    '0': 0,
                    '304,1240,0': 40,
                    '304,1240,954,0': 50,
                    '304,1240,850,0': 60,
                    '2896,1840,954,0': 50,
                } as Record<string, number>
            )[signature] ?? null
        );
    }
    if (code === 'TAKKO_RUN')
        return input.endTick === 348 &&
            JSON.stringify(input.inputs) === '[{"tick":0,"type":"press"}]'
            ? 122
            : null;
    if (code === 'COLOR_WORD' && Array.isArray(input.answers)) {
        const answers = input.answers as {
            sequence: number;
            answer: string | null;
            elapsedMs: number;
        }[];
        return answers.length === 3 &&
            answers.every(
                (answer, i) =>
                    answer.sequence === i + 1 &&
                    answer.answer === null &&
                    answer.elapsedMs === 3000,
            )
            ? 0
            : null;
    }
    if (code === 'TAKKO_ORDER' && Array.isArray(input.rounds)) {
        const rounds = input.rounds as { sequence: number; picks: string[] }[];
        const success = [
            ['scallion', 'scallion', 'shrimp'],
            ['scallion', 'shrimp', 'scallion', 'scallion'],
            ['scallion', 'cheese', 'shrimp', 'shrimp', 'cheese'],
            ['shrimp', 'scallion', 'scallion', 'nori', 'scallion', 'nori'],
        ];
        if (
            rounds.length === 7 &&
            rounds.every(
                (round, i) =>
                    round.sequence === i + 1 &&
                    JSON.stringify(round.picks) ===
                        JSON.stringify(i < 4 ? success[i] : i === 5 ? ['scallion'] : ['cheese']),
            )
        )
            return 18;
        return null;
    }
    return null;
}
export const gameHandlers = [
    http.get(api('/v1/games'), () => ok(games.map(summary))),
    http.get(api('/v1/games/:gameId'), ({ params }) => {
        const game = games.find((game) => game.id === params.gameId);
        return game
            ? ok({
                  ...summary(game),
                  ruleVersion: `${game.version}-v1`,
                  rules: game.rules,
                  serverTime: mockNow().toISOString(),
              })
            : fail(404, 'GAME-002', '게임을 찾을 수 없습니다.');
    }),
    http.get(api('/v1/games/:gameId/statistics/me'), ({ params, request }) => {
        if (request.headers.get('X-User-Role') === 'ADMIN')
            return fail(403, 'GAME-007', '일반 사용자만 기록을 조회할 수 있습니다.');
        const game = games.find((game) => game.id === params.gameId);
        if (!game) return fail(404, 'GAME-002', '게임을 찾을 수 없습니다.');
        const now = mockNow();
        const day = formatYmd(now.toISOString());
        const state = stateFor(userOf(request), game.id);
        return ok({
            gameId: game.id,
            bestScore: state.bestScore,
            totalScore: state.totalScore,
            validPlayCount: state.validPlayCount,
            rewardDate: day,
            rewardClaimedToday: state.days.has(day),
            nextResetAt: new Date(`${day}T15:00:00Z`).toISOString(),
            serverTime: now.toISOString(),
        });
    }),
    http.post(api('/v1/games/:gameId/plays'), ({ params, request }) => {
        const game = games.find((game) => game.id === params.gameId);
        if (!game) return fail(404, 'GAME-002', '게임을 찾을 수 없습니다.');
        const playId = crypto.randomUUID();
        const playToken = crypto.randomUUID();
        plays.set(playId, { gameId: game.id, userId: userOf(request), playToken });
        return ok(
            {
                playId,
                playToken,
                ruleVersion: `${game.version}-v1`,
                startedAt: mockNow().toISOString(),
                rules: game.rules,
                gameData: {
                    generatorVersion: `${game.version}-generator-v1`,
                    seed: 1,
                    ...(game.code === 'TAKKO_RUN' ? { tickMs: 1000 / 120 } : {}),
                },
            },
            201,
        );
    }),
    http.put(api('/v1/games/:gameId/plays/:playId/result'), async ({ params, request }) => {
        if (request.headers.get('X-User-Role') === 'ADMIN')
            return fail(403, 'GAME-007', '관리자 체험은 저장하지 않습니다.');
        const play = plays.get(String(params.playId));
        const game = games.find((game) => game.id === params.gameId);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 1048576)
            return fail(413, 'GAME-008', '입력 한도 초과');
        let body: { playToken: string; validationData: Record<string, unknown> };
        try {
            const parsed: unknown = JSON.parse(raw);
            body = z
                .object({
                    playToken: z.string(),
                    validationData: z.record(z.string(), z.unknown()),
                })
                .parse(parsed);
        } catch {
            return fail(400, 'COMMON-005', '요청 형식 오류');
        }
        if (
            !play ||
            !game ||
            play.userId !== userOf(request) ||
            play.gameId !== game.id ||
            play.playToken !== body.playToken
        )
            return fail(404, 'GAME-005', '플레이를 확인할 수 없습니다.');
        const input = body.validationData;
        if (!input || typeof input !== 'object') return fail(400, 'COMMON-005', '요청 형식 오류');
        if (Object.values(input).some((value) => Array.isArray(value) && value.length > 10000))
            return fail(413, 'GAME-008', '입력 한도 초과');
        const normalize = (value: unknown): unknown =>
            Array.isArray(value)
                ? value.map(normalize)
                : value && typeof value === 'object'
                  ? Object.fromEntries(
                        Object.entries(value)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([key, item]) => [key, normalize(item)]),
                    )
                  : value;
        const canonical = JSON.stringify(normalize(input));
        if (play.result)
            return play.body === canonical
                ? ok(play.result)
                : fail(409, 'GAME-006', '입력 변경 충돌');
        const score = fixtureScore(game.code, input);
        const completedAt = mockNow().toISOString();
        const state = stateFor(play.userId, game.id);
        const day = formatYmd(completedAt);
        let reward: Receipt['reward'] = null;
        if (score !== null) {
            state.bestScore = Math.max(state.bestScore, score);
            state.totalScore += score;
            state.validPlayCount += 1;
            if (score >= game.minimum && !state.days.has(day)) {
                const grade = drawMockTicketGrade();
                const expiresAt = kstNextMonthStart(mockNow()).toISOString();
                reward = { ticketCount: 1, grade, grantedAt: completedAt, expiresAt };
                state.days.add(day);
                recordMockTicketGrant(play.userId, 1, `${game.name} 게임 보상`, {
                    grade,
                    expiresAt,
                    gameId: game.id,
                });
            }
        }
        play.body = canonical;
        play.result = {
            playId: String(params.playId),
            status: score === null ? 'INVALID' : 'VALID',
            score,
            completedAt,
            reward,
        };
        return ok(play.result);
    }),
];
