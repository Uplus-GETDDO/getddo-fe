import { z } from 'zod';

export const gameSchema = z.object({
    id: z.uuid(),
    code: z.string().max(50),
    name: z.string().max(100),
    description: z.string().nullable(),
});
export const gameDetailSchema = gameSchema.extend({
    ruleVersion: z.string().max(30),
    rules: z.record(z.string(), z.unknown()),
    serverTime: z.iso.datetime(),
});
export const gameStatisticsSchema = z.object({
    gameId: z.uuid(),
    bestScore: z.number().int().nonnegative(),
    totalScore: z.number().int().nonnegative(),
    validPlayCount: z.number().int().nonnegative(),
    rewardDate: z.iso.date(),
    rewardClaimedToday: z.boolean(),
    nextResetAt: z.iso.datetime(),
    serverTime: z.iso.datetime(),
});
export type Game = z.infer<typeof gameSchema>;
export type GameStatistics = z.infer<typeof gameStatisticsSchema>;
