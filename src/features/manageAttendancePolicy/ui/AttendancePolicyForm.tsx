import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import type { DailyPolicyWrite, StreakPolicyWrite } from '@entities/attendance';

import { dailyPolicyWriteSchema, streakPolicyWriteSchema } from '@entities/attendance';
import { ApiError } from '@shared/api/client';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

import { useCreateAttendancePolicy } from '../api/queries';

export function AttendancePolicyForm({ kind }: { kind: 'daily' | 'streak' }) {
    const mutation = useCreateAttendancePolicy();
    const [notice, setNotice] = useState('');
    const { register, control, handleSubmit } = useForm<DailyPolicyWrite & StreakPolicyWrite>({
        defaultValues: {
            rewardTicketCount: 1,
            milestones: [
                { milestoneDays: 7, rewardTicketCount: 1 },
                { milestoneDays: 14, rewardTicketCount: 3 },
                { milestoneDays: 28, rewardTicketCount: 7 },
            ],
        },
    });
    const { fields, append, remove } = useFieldArray({ control, name: 'milestones' });
    const label = kind === 'daily' ? '일일' : '연속';
    const submit = handleSubmit((values) => {
        const parsed =
            kind === 'daily'
                ? dailyPolicyWriteSchema.safeParse(values)
                : streakPolicyWriteSchema.safeParse(values);
        if (!parsed.success) {
            setNotice(parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.');
            return;
        }
        const request =
            kind === 'daily'
                ? { kind, body: dailyPolicyWriteSchema.parse(values) }
                : { kind, body: streakPolicyWriteSchema.parse(values) };
        setNotice('');
        mutation.mutate(request, {
            onSuccess: () =>
                setNotice('예약했습니다. 적용일·기준월은 아래 서버 정책에서 확인해 주세요.'),
            onError: (error) =>
                setNotice(
                    error instanceof ApiError &&
                        ['ATTENDANCE-004', 'ATTENDANCE-005'].includes(error.code)
                        ? '이미 예약된 정책이 있습니다. 목록을 새로 확인해 주세요. 예약 수정 API는 제공되지 않습니다.'
                        : `${getErrorMessage(error)} 처리 여부가 불확실하면 목록을 먼저 확인해 주세요.`,
                ),
        });
    });
    return (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <p>
                브론즈 응모권으로 지급하며,{' '}
                {kind === 'daily' ? '다음 KST 기준일 00:00' : '다음 KST 기준월 1일 00:00'}부터
                적용합니다.
            </p>
            <fieldset disabled={mutation.isPending} className="flex min-w-0 flex-col gap-3">
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
                <Button className="min-h-11" type="submit">
                    {mutation.isPending ? '예약 중…' : `${label} 정책 예약`}
                </Button>
            </fieldset>
            {notice && <p role={mutation.isError ? 'alert' : 'status'}>{notice}</p>}
        </form>
    );
}
