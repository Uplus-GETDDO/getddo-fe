import { isAxiosError } from 'axios';
import { ZodError } from 'zod';

import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { RefreshStatus } from '@shared/ui/refresh-status';

import type { useMyTickets } from '../api/queries';

interface TicketBalanceStatusProps {
    query: Pick<
        ReturnType<typeof useMyTickets>,
        'data' | 'isPending' | 'isError' | 'isFetching' | 'isFetched' | 'error' | 'refetch'
    >;
}

/** 사용자가 할 수 있는 일로 실패를 알린다 — 응답 형식(계약) 오류 같은 개발자용 원인은 화면에 적지 않는다 */
function failureHint(error: unknown) {
    if (error instanceof ZodError) return '잠시 후 다시 시도해 주세요.';
    if (isAxiosError(error) && !error.response)
        return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
    return getErrorMessage(error, '잠시 후 다시 시도해 주세요.');
}

/**
 * 응모권 잔액 조회 상태 — 실패·0장·로딩을 나누고(GD-242) 다시 받을 수 있게 한다.
 * 받아 둔 잔액이 있으면 그 값을 그대로 두고 작은 '잔액 갱신 실패 · 다시 시도'만 보인다 — 다른 화면의 갱신 실패 표시와 같은 규칙.
 * 빨간 문단과 큰 버튼은 잔액이 하나도 없을 때만 — 이전 잔액이 보이는데 크게 경고하면 지금 못 쓰는 것처럼 읽혔다.
 * 다시 받는 중에는 아무것도 띄우지 않는다 — 받아 둔 잔액이 그대로라 매번 안내 줄이 생겼다 사라지면 화면만 흔들린다
 */
export function TicketBalanceStatus({ query }: TicketBalanceStatusProps) {
    const retry = () => void query.refetch();

    if (query.isError && query.data) {
        return (
            <RefreshStatus
                fetching={query.isFetching}
                error
                errorLabel="잔액 갱신 실패"
                onRefresh={retry}
                className="self-start"
            />
        );
    }

    if (query.isError) {
        return (
            <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-body-sm text-fg-secondary">
                    응모권 잔액을 불러오지 못했어요. {failureHint(query.error)}
                </p>
                <Button variant="secondary" size="sm" disabled={query.isFetching} onClick={retry}>
                    {query.isFetching ? '다시 불러오는 중…' : '다시 시도'}
                </Button>
            </div>
        );
    }

    // 처음 실패 뒤 다시 받는 중 — 실패 칸 자리에 잠긴 버튼을 남겨 두 번 누르지 않게 한다
    if (query.isPending && query.isFetched) {
        return (
            <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-body-sm text-fg-secondary">응모권 잔액을 불러오는 중이에요.</p>
                <Button variant="secondary" size="sm" disabled>
                    다시 불러오는 중…
                </Button>
            </div>
        );
    }

    if (query.isPending) {
        return (
            <p role="status" className="sr-only">
                응모권 잔액을 불러오는 중이에요.
            </p>
        );
    }

    return null;
}
