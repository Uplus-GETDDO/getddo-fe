import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import type { DailyPolicyWrite, StreakPolicyWrite } from '@entities/attendance';

import { dailyPolicyWriteSchema, streakPolicyWriteSchema } from '@entities/attendance';
import { ApiError } from '@shared/api/client';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';

import { useCreateAttendancePolicy } from '../api/queries';
import { PolicyFields } from './PolicyFields';

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
    const fieldArray = useFieldArray({ control, name: 'milestones' });
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
                setNotice('예약했습니다. 적용일·기준월은 예약된 변경에서 확인해 주세요.'),
            onError: (error) =>
                setNotice(
                    error instanceof ApiError &&
                        ['ATTENDANCE-004', 'ATTENDANCE-005'].includes(error.code)
                        ? '이미 예약된 정책이 있습니다. 예약된 변경에서 수정해 주세요.'
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
                <PolicyFields kind={kind} register={register} fieldArray={fieldArray} />
                <Button className="min-h-11" type="submit">
                    {mutation.isPending ? '예약 중…' : `${label} 정책 예약`}
                </Button>
            </fieldset>
            {notice && <p role={mutation.isError ? 'alert' : 'status'}>{notice}</p>}
        </form>
    );
}
