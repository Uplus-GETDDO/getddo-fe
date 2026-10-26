import { z } from 'zod';

const milestoneWriteSchema = z.object({
    milestoneDays: z.number().int().min(1).max(28),
    rewardTicketCount: z.number().int().positive(),
});
export const dailyPolicyWriteSchema = z.object({ rewardTicketCount: z.number().int().positive() });
export const streakPolicyWriteSchema = z
    .object({
        milestones: z.array(milestoneWriteSchema).min(1),
    })
    .refine(
        ({ milestones }) =>
            milestones.every(
                (m, i) => i === 0 || m.milestoneDays > milestones[i - 1]!.milestoneDays,
            ),
        '단계 일수는 중복 없이 오름차순으로 지정해 주세요.',
    );
export const dailyAttendancePolicySchema = dailyPolicyWriteSchema.extend({
    id: z.string(),
    effectiveFrom: z.iso.datetime({ offset: true }),
    effectiveUntil: z.iso.datetime({ offset: true }).nullable(),
    createdBy: z.string(),
    // ADR-028 표시용 작성자 현재 이름 — BE 미배포라 생략·null을 허용한다
    createdByName: z.string().nullish(),
    createdAt: z.iso.datetime({ offset: true }),
});
export const streakPolicySetSchema = z.object({
    id: z.string(),
    effectiveMonth: z.string().regex(/^\d{4}-\d{2}$/),
    milestones: z.array(milestoneWriteSchema.extend({ id: z.string() })),
    createdBy: z.string(),
    createdByName: z.string().nullish(),
    createdAt: z.iso.datetime({ offset: true }),
});
export type DailyPolicyWrite = z.infer<typeof dailyPolicyWriteSchema>;
export type StreakPolicyWrite = z.infer<typeof streakPolicyWriteSchema>;
export type DailyAttendancePolicy = z.infer<typeof dailyAttendancePolicySchema>;
export type StreakPolicySet = z.infer<typeof streakPolicySetSchema>;
