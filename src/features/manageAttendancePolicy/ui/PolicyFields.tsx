import type { UseFieldArrayReturn, UseFormRegister } from 'react-hook-form';

import type { DailyPolicyWrite, StreakPolicyWrite } from '@entities/attendance';

import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

/** 등록 폼과 수정 다이얼로그가 공유하는 폼 값 — kind에 따라 실제로 쓰는 필드만 검증한다 */
export type PolicyFormValues = DailyPolicyWrite & StreakPolicyWrite;

/**
 * 일일 보상 장수·연속 단계 입력 묶음 — 예약 등록과 예약 수정(AP05·AP06)이 같은 필드를 쓴다.
 * 부모 폼의 register·field array를 그대로 받아 그린다
 */
export function PolicyFields({
    kind,
    register,
    fieldArray,
}: {
    kind: 'daily' | 'streak';
    register: UseFormRegister<PolicyFormValues>;
    fieldArray: UseFieldArrayReturn<PolicyFormValues, 'milestones'>;
}) {
    const { fields, append, remove } = fieldArray;
    return (
        <>
            {kind === 'daily' ? (
                <label className="flex flex-col gap-2">
                    일일 보상 장수
                    <Input
                        type="number"
                        min={1}
                        step={1}
                        required
                        {...register('rewardTicketCount', { valueAsNumber: true })}
                    />
                </label>
            ) : (
                <>
                    {fields.map((field, i) => (
                        <div key={field.id} className="flex flex-wrap items-end gap-2">
                            <label className="flex min-w-0 flex-1 flex-col gap-2">
                                {i + 1}단계 일수
                                <Input
                                    type="number"
                                    min={1}
                                    max={28}
                                    required
                                    {...register(`milestones.${i}.milestoneDays`, {
                                        valueAsNumber: true,
                                    })}
                                />
                            </label>
                            <label className="flex min-w-0 flex-1 flex-col gap-2">
                                {i + 1}단계 보상 장수
                                <Input
                                    type="number"
                                    min={1}
                                    required
                                    {...register(`milestones.${i}.rewardTicketCount`, {
                                        valueAsNumber: true,
                                    })}
                                />
                            </label>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={fields.length <= 1}
                                onClick={() => remove(i)}
                                aria-label={`${i + 1}단계 삭제`}
                            >
                                삭제
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={fields.length >= 28}
                        onClick={() =>
                            append({
                                milestoneDays: Math.min(
                                    28,
                                    (fields.at(-1)?.milestoneDays ?? 0) + 1,
                                ),
                                rewardTicketCount: 1,
                            })
                        }
                    >
                        단계 추가
                    </Button>
                </>
            )}
        </>
    );
}
