import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

import { dailyPolicyWriteSchema, streakPolicyWriteSchema } from '@entities/attendance';
import { ApiError } from '@shared/api/client';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { formatKst } from '@shared/utils/date';

import type { PolicyFormValues } from './PolicyFields';

import { useUpdateAttendancePolicy } from '../api/queries';
import { PolicyFields } from './PolicyFields';

export type PolicyEditTarget =
    { kind: 'daily'; policy: DailyAttendancePolicy } | { kind: 'streak'; policy: StreakPolicySet };

/**
 * 예약 출석 정책 수정 (AP05·AP06) — 시작하지 않은 정책만 열고, 이미 시작했으면
 * 서버가 409 ATTENDANCE-007로 거절한다. 적용 시점(적용일·기준월)은 바꿀 수 없다
 */
export function AttendancePolicyEditDialog({
    target,
    onClose,
}: {
    target: PolicyEditTarget;
    onClose: () => void;
}) {
    const mutation = useUpdateAttendancePolicy();
    const [notice, setNotice] = useState('');
    const { register, control, handleSubmit } = useForm<PolicyFormValues>({
        defaultValues:
            target.kind === 'daily'
                ? {
                      rewardTicketCount: target.policy.rewardTicketCount,
                      milestones: [],
                  }
                : {
                      rewardTicketCount: 0,
                      milestones: target.policy.milestones.map(
                          ({ milestoneDays, rewardTicketCount }) => ({
                              milestoneDays,
                              rewardTicketCount,
                          }),
                      ),
                  },
    });
    const fieldArray = useFieldArray({ control, name: 'milestones' });
    const options = {
        onSuccess: () => onClose(),
        onError: (error: Error) =>
            setNotice(
                error instanceof ApiError && error.code === 'ATTENDANCE-007'
                    ? '이미 적용이 시작된 정책이라 수정할 수 없습니다. 목록을 새로 확인해 주세요.'
                    : `${getErrorMessage(error)} 처리 여부가 불확실하면 목록을 먼저 확인해 주세요.`,
            ),
    };
    const submit = handleSubmit((values) => {
        setNotice('');
        if (target.kind === 'daily') {
            const parsed = dailyPolicyWriteSchema.safeParse(values);
            if (!parsed.success) {
                setNotice(parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.');
                return;
            }
            mutation.mutate({ kind: 'daily', id: target.policy.id, body: parsed.data }, options);
        } else {
            const parsed = streakPolicyWriteSchema.safeParse(values);
            if (!parsed.success) {
                setNotice(parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.');
                return;
            }
            mutation.mutate({ kind: 'streak', id: target.policy.id, body: parsed.data }, options);
        }
    });
    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next && !mutation.isPending) onClose();
            }}
        >
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>예약 정책 수정</DialogTitle>
                    <DialogDescription>
                        {target.kind === 'daily'
                            ? `적용 시작 ${formatKst(target.policy.effectiveFrom)} KST — 적용 시점은 바뀌지 않습니다.`
                            : `적용 기준월 ${target.policy.effectiveMonth} (KST) — 적용 시점은 바뀌지 않습니다.`}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(event) => void submit(event)}
                    className="flex min-w-0 flex-col gap-4"
                >
                    <fieldset disabled={mutation.isPending} className="flex min-w-0 flex-col gap-3">
                        <PolicyFields
                            kind={target.kind}
                            register={register}
                            fieldArray={fieldArray}
                        />
                        <Button className="min-h-11" type="submit">
                            {mutation.isPending ? '수정 중…' : '정책 수정'}
                        </Button>
                    </fieldset>
                    {notice && <p role={mutation.isError ? 'alert' : 'status'}>{notice}</p>}
                </form>
            </DialogContent>
        </Dialog>
    );
}
