import { isAxiosError } from 'axios';
import { ZodError } from 'zod';

import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';

import type { useMyTickets } from '../api/queries';

interface TicketBalanceStatusProps {
    query: Pick<
        ReturnType<typeof useMyTickets>,
        'data' | 'isPending' | 'isError' | 'isFetching' | 'isFetched' | 'error' | 'refetch'
    >;
}

export function TicketBalanceStatus({ query }: TicketBalanceStatusProps) {
    if (query.isError) {
        const reason =
            query.error instanceof ZodError
                ? '응모권 정보의 형식을 확인하지 못했어요. 다시 조회해 주세요.'
                : isAxiosError(query.error) && !query.error.response
                  ? '서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 조회해 주세요.'
                  : getErrorMessage(query.error, '잠시 후 다시 조회해 주세요.');

        return (
            <div className="flex flex-col items-start gap-2">
                <div role="alert" className="text-semantic-error-strong text-body-sm">
                    <p>
                        {query.data
                            ? '응모권 잔액을 갱신하지 못했어요. 이전 잔액을 표시하고 있어요.'
                            : '응모권 잔액을 불러오지 못했어요.'}
                    </p>
                    <p>{reason}</p>
                </div>
                <Button
                    variant="secondary"
                    className="min-h-11"
                    disabled={query.isFetching}
                    onClick={() => void query.refetch()}
                >
                    {query.isFetching ? '다시 조회 중…' : '다시 조회'}
                </Button>
            </div>
        );
    }

    if (query.isPending || query.isFetching) {
        return (
            <div className="flex flex-col items-start gap-2">
                <p role="status" className="text-body-sm text-fg-secondary">
                    {query.data
                        ? '응모권 잔액을 갱신하는 중이에요.'
                        : '응모권 잔액을 불러오는 중이에요.'}
                </p>
                {query.isFetched && !query.data && (
                    <Button variant="secondary" className="min-h-11" disabled>
                        다시 조회 중…
                    </Button>
                )}
            </div>
        );
    }

    return null;
}
