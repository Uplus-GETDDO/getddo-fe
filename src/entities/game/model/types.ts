import { z } from 'zod';

export const gameSchema = z.object({
    id: z.string(),
    title: z.string(),
    // 홈 위젯이 쓰는 기존 필드 — getddo-spec 게임 규칙은 '횟수 제한 없이 플레이'라 연동 계약 확정 시 정리 대상
    dailyLimit: z.number().int().positive(),
    remainingPlays: z.number().int().nonnegative(),
    // 아래는 게임 카드용 선택 필드 — 백엔드와 확정 전 임시 계약
    description: z.string().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    /** 오늘(00:00 KST 기준일) 이 게임의 보상 응모권 1장을 이미 받았는지 */
    rewardedToday: z.boolean().optional(),
    /** 개인 최고점 — 서버가 유효로 판정한 플레이만 반영 (getddo-spec 게임 규칙) */
    bestScore: z.number().int().nonnegative().optional(),
    /** 오늘(00:00 KST 기준일) 유효 플레이 횟수 */
    todayPlayCount: z.number().int().nonnegative().optional(),
});

export type Game = z.infer<typeof gameSchema>;
