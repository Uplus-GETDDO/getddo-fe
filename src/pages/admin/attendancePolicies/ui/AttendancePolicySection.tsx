import type { ReactNode } from 'react';

import { RotateCw } from 'lucide-react';

import type { DailyAttendancePolicy, StreakPolicySet } from '@entities/attendance';

import { AttendancePolicyForm } from '@features/manageAttendancePolicy';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

/** 섹션이 실제로 쓰는 쿼리 상태만 받는다 — useQuery 결과를 그대로 넘기면 된다 */
interface PolicyQueryState {
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    error: unknown;
    data: unknown;
    dataUpdatedAt?: number;
    refetch: () => Promise<unknown>;
}

const CARD =
    'border-border-default bg-surface-page flex min-w-0 flex-col gap-4 rounded-2xl border p-5';

/**
 * 일일·연속 출석 정책 섹션 — '지금 적용 중'과 '다음 예약'을 왼쪽·오른쪽 카드로 나란히 둬
 * 무엇이 언제 바뀌는지 한 줄에서 비교되게 한다. 예약이 없으면 오른쪽 카드가 곧 새 예약 폼이다.
 * 데이터가 없으면(로딩·오류) 상태 표시만 보인다
 */
export function AttendancePolicySection<T extends DailyAttendancePolicy | StreakPolicySet>({
    kind,
    title,
    description,
    current,
    scheduled,
    query,
    onEdit,
    renderPolicy,
}: {
    kind: 'daily' | 'streak';
    title: string;
    /** 제목 옆 한 줄 — 이 정책이 언제 무엇을 주는지 */
    description: string;
    current: T | null;
    scheduled: T | null;
    query: PolicyQueryState;
    onEdit: (policy: T) => void;
    renderPolicy: (policy: T) => ReactNode;
}) {
    const { isPending, isError, isFetching, error, data, dataUpdatedAt, refetch } = query;
    // 재조회 실패라도 이전 성공값이 남아 있으면 판정 가능 — 카드를 유지하고 alert만 띄운다
    const hasData = data != null;
    // 429 대기 중에는 수동 재조회도 서버가 정한 대기 시간을 우회하지 않는다
    const retry = () => {
        if (!getPollingRetryDelay(error)) void refetch();
    };
    const label = kind === 'daily' ? '일일' : '연속';
    return (
        <section className="flex min-w-0 flex-col gap-4" aria-labelledby={`${kind}-title`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                    <h2 id={`${kind}-title`} className="text-title-3 text-fg-primary">
                        {title}
                    </h2>
                    <p className="text-body-sm text-fg-secondary">{description}</p>
                </div>
                {!isPending && (!isError || hasData) && (
                    <span className="text-caption text-fg-tertiary flex items-center gap-1 tabular-nums">
                        {dataUpdatedAt
                            ? `${formatKst(new Date(dataUpdatedAt), {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false,
                              })} 기준`
                            : null}
                        <button
                            type="button"
                            aria-label={`${label} 정책 새로 조회`}
                            disabled={isFetching}
                            onClick={retry}
                            className="text-fg-tertiary hover:text-fg-primary hover:bg-surface-sunken focus-visible:ring-border-focus flex size-6 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <RotateCw aria-hidden className="size-3.5" />
                        </button>
                    </span>
                )}
            </div>
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
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    <article className={CARD} aria-labelledby={`${kind}-current-title`}>
                        <div className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="bg-brand-primary size-1.5 shrink-0 rounded-full"
                            />
                            <h3
                                id={`${kind}-current-title`}
                                className="text-body-sm-bold text-fg-primary"
                            >
                                현재 정책
                            </h3>
                        </div>
                        {current ? (
                            renderPolicy(current)
                        ) : (
                            <p className="text-fg-secondary text-body-sm">
                                적용 중인 정책이 없습니다.
                            </p>
                        )}
                    </article>
                    <article
                        className={scheduled ? CARD : `${CARD} border-dashed`}
                        aria-labelledby={`${kind}-scheduled-title`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h3
                                id={`${kind}-scheduled-title`}
                                className="text-body-sm-bold text-fg-primary"
                            >
                                예약된 변경
                            </h3>
                            {scheduled && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    aria-label={`${label} 예약 정책 수정`}
                                    onClick={() => onEdit(scheduled)}
                                >
                                    수정
                                </Button>
                            )}
                        </div>
                        {scheduled ? (
                            renderPolicy(scheduled)
                        ) : (
                            <>
                                <p className="text-fg-secondary text-body-sm">
                                    예약된 변경이 없습니다. 예약하지 않으면 현재 정책이 계속
                                    적용돼요.
                                </p>
                                <AttendancePolicyForm kind={kind} />
                            </>
                        )}
                        {/* 운영 규칙은 바꾸는 자리 바로 아래에 — 화면 맨 위 설명으로 두면 지나쳤다 */}
                        <p className="text-caption text-fg-tertiary border-border-default border-t pt-3">
                            이미 받은 보상·달성 기록은 바뀌지 않아요.{' '}
                            {kind === 'daily' ? '같은 적용일' : '같은 기준월'}에는 하나만 예약할 수
                            있어요.
                        </p>
                    </article>
                </div>
            )}
        </section>
    );
}
