import type { ReactNode } from 'react';

import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

import { AttendancePolicyForm } from '@features/manageAttendancePolicy';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';

/** 섹션이 실제로 쓰는 쿼리 상태만 받는다 — useQuery 결과를 그대로 넘기면 된다 */
interface PolicyQueryState {
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    error: unknown;
    data: unknown;
    refetch: () => Promise<unknown>;
}

/**
 * 일일·연속 출석 정책 섹션 — 현재 정책 카드, 예약된 변경(없으면 새 예약 폼),
 * 수동 새로 조회로만 구성한다. 데이터가 없으면(로딩·오류) 상태 표시만 보인다.
 */
export function AttendancePolicySection<T extends DailyAttendancePolicy | StreakPolicySet>({
    kind,
    title,
    current,
    scheduled,
    query,
    onEdit,
    renderPolicy,
}: {
    kind: 'daily' | 'streak';
    title: string;
    current: T | null;
    scheduled: T | null;
    query: PolicyQueryState;
    onEdit: (policy: T) => void;
    renderPolicy: (policy: T) => ReactNode;
}) {
    const { isPending, isError, isFetching, error, data, refetch } = query;
    // 재조회 실패라도 이전 성공값이 남아 있으면 판정 가능 — 카드를 유지하고 alert만 띄운다
    const hasData = data != null;
    // 429 대기 중에는 수동 재조회도 서버가 정한 대기 시간을 우회하지 않는다
    const retry = () => {
        if (!getPollingRetryDelay(error)) void refetch();
    };
    return (
        <section
            className="bg-surface-elevated flex min-w-0 flex-col gap-5 rounded-xl p-4"
            aria-labelledby={`${kind}-title`}
        >
            <h2 id={`${kind}-title`} className="text-title-3">
                {title}
            </h2>
            {isPending && (
                <LoadingBlock>
                    <SkeletonRows rows={4} />
                </LoadingBlock>
            )}
            {isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">
                        {getErrorMessage(
                            error,
                            hasData
                                ? '정책을 조회하지 못했습니다. 이전 성공값을 유지합니다.'
                                : '정책을 조회하지 못했습니다.',
                        )}
                    </p>
                    <Button size="sm" variant="secondary" disabled={isFetching} onClick={retry}>
                        다시 시도
                    </Button>
                </div>
            )}
            {!isPending && (!isError || hasData) && (
                <>
                    <article
                        className="border-border-default flex min-w-0 flex-col gap-2 rounded-lg border p-4"
                        aria-labelledby={`${kind}-current-title`}
                    >
                        <h3 id={`${kind}-current-title`} className="text-body-bold">
                            현재 정책
                        </h3>
                        {current ? (
                            renderPolicy(current)
                        ) : (
                            <p className="text-fg-secondary text-body-sm">
                                적용 중인 정책이 없습니다.
                            </p>
                        )}
                    </article>
                    <article
                        className="border-border-default flex min-w-0 flex-col gap-3 rounded-lg border p-4"
                        aria-labelledby={`${kind}-scheduled-title`}
                    >
                        <h3 id={`${kind}-scheduled-title`} className="text-body-bold">
                            예약된 변경
                        </h3>
                        {scheduled ? (
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                                {renderPolicy(scheduled)}
                                <Button
                                    variant="secondary"
                                    aria-label={
                                        kind === 'daily'
                                            ? '일일 예약 정책 수정'
                                            : '연속 예약 정책 수정'
                                    }
                                    onClick={() => onEdit(scheduled)}
                                >
                                    수정
                                </Button>
                            </div>
                        ) : (
                            <>
                                <p className="text-fg-secondary text-body-sm">
                                    예약된 변경이 없습니다. 예약하지 않으면 기존 정책이 유지됩니다.
                                </p>
                                <AttendancePolicyForm kind={kind} />
                            </>
                        )}
                    </article>
                    <Button
                        className="min-h-11"
                        variant="secondary"
                        disabled={isFetching}
                        onClick={retry}
                    >
                        {kind === 'daily' ? '일일 정책 새로 조회' : '연속 정책 새로 조회'}
                    </Button>
                </>
            )}
        </section>
    );
}
