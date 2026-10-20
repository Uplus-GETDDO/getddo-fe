import { z } from 'zod';

import { ticketGradeSchema } from '@entities/ticket';

const color = z.enum(['red', 'blue', 'yellow', 'green']);
const positiveInt = z.number().int().positive();
export const validationDataSchema = z.union([
    z
        .object({
            answers: z
                .array(
                    z.object({
                        sequence: positiveInt,
                        answer: color.nullable(),
                        elapsedMs: z.number().int().nonnegative(),
                    }),
                )
                .max(10000),
        })
        .strict(),
    z
        .object({
            endTick: z.number().int().min(0).max(71999),
            inputs: z
                .array(
                    z.object({
                        tick: z.number().int().nonnegative(),
                        type: z.enum(['press', 'release']),
                    }),
                )
                .max(10000),
        })
        .strict(),
    z
        .object({
            taps: z
                .array(
                    z.object({ sequence: positiveInt, elapsedMs: z.number().int().nonnegative() }),
                )
                .max(10000),
        })
        .strict(),
    z
        .object({
            rounds: z
                .array(
                    z.object({
                        sequence: positiveInt,
                        picks: z.array(z.enum(['scallion', 'cheese', 'shrimp', 'nori'])),
                    }),
                )
                .max(10000),
        })
        .strict(),
]);
export type ValidationData = z.infer<typeof validationDataSchema>;
export const gameStartSchema = z
    .object({
        playId: z.uuid(),
        playToken: z.string().min(1),
        ruleVersion: z.string(),
        startedAt: z.iso.datetime(),
        rules: z.record(z.string(), z.number()),
        gameData: z.object({
            generatorVersion: z.string(),
            seed: z.number().int().min(1).max(4294967295),
            tickMs: z.number().optional(),
        }),
    })
    .superRefine((value, ctx) => {
        const expected: Record<string, { generator: string; rules: Record<string, number> }> = {
            'color-word-v1': {
                generator: 'color-word-generator-v1',
                rules: {
                    initialLives: 3,
                    pointsPerCorrect: 10,
                    initialTimeLimitMs: 3000,
                    timeLimitDecreaseMs: 80,
                    minimumTimeLimitMs: 1200,
                },
            },
            'takko-run-v1': {
                generator: 'takko-run-generator-v1',
                rules: { minimumRewardScore: 400, maxTicks: 72000 },
            },
            'takko-timing-v1': {
                generator: 'takko-timing-generator-v1',
                rules: { points: 10, perfectPoints: 20, minimumRewardScore: 50 },
            },
            'takko-order-v1': {
                generator: 'takko-order-generator-v1',
                rules: { initialLives: 3, startLength: 3, maxLength: 8 },
            },
        };
        const config = expected[value.ruleVersion];
        if (
            !config ||
            config.generator !== value.gameData.generatorVersion ||
            Object.entries(config.rules).some(([key, n]) => value.rules[key] !== n) ||
            (value.ruleVersion === 'takko-run-v1' && value.gameData.tickMs !== 1000 / 120)
        ) {
            ctx.addIssue({ code: 'custom', message: '지원하지 않거나 손상된 게임 규칙입니다.' });
        }
    });
export type GameStart = z.infer<typeof gameStartSchema>;
export const playResultSchema = z
    .object({
        playId: z.uuid(),
        status: z.enum(['PROCESSING', 'VALID', 'INVALID']),
        score: z.number().int().nonnegative().nullable(),
        completedAt: z.iso.datetime().nullable(),
        reward: z
            .object({
                ticketCount: z.literal(1),
                grade: ticketGradeSchema,
                grantedAt: z.iso.datetime(),
                expiresAt: z.iso.datetime(),
            })
            .nullable(),
    })
    .superRefine((value, ctx) => {
        if (
            value.status === 'VALID'
                ? value.score === null || value.completedAt === null
                : value.score !== null ||
                  value.reward !== null ||
                  (value.status === 'PROCESSING' && value.completedAt !== null)
        ) {
            ctx.addIssue({
                code: 'custom',
                message: '게임 결과 상태와 점수·보상이 일치하지 않습니다.',
            });
        }
    });
export type PlayResult = z.infer<typeof playResultSchema>;
export type GameOverHandler = (
    score: number,
    validationData: ValidationData,
) => Promise<{ ticketsGranted: number; reward: PlayResult['reward'] } | void> | void;
export interface GameSessionProps {
    session: GameStart;
    onRestart: () => void;
    onRecordingError: (message: string) => void;
}
