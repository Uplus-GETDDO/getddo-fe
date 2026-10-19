import { Fragment, useState } from 'react';

import { TicketHistoryRow, type TicketHistory } from '@entities/ticket';
import { Button } from '@shared/ui/button';
import { SkeletonList } from '@shared/ui/skeleton';

import { SectionCard } from './SectionCard';

/** 미리보기 줄 수 — 나머지는 "전체 보기"(/my-tickets)에서 본다 */
const PREVIEW_COUNT = 5;

/**
 * 마이페이지 "응모권 내역" — 최근 7일 동안 받고 쓴 응모권.
 * 미션 페이지 응모권 내역과 같은 줄(누르면 상세가 펼쳐지는 아코디언)을 쓰고, 상세는 한 번에 하나만 펼친다
 */
export function RecentTicketsCard({
    histories,
    isPending,
    isError,
    onRetry,
    isFetching,
}: {
    /** 최신순으로 정렬된 최근 7일 이력 */
    histories: TicketHistory[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
    isFetching: boolean;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    return (
        <SectionCard
            title="응모권 내역"
            description="최근 7일 동안 받고 쓴 응모권이에요."
            moreTo="/my-tickets"
            moreLabel="응모권 내역 전체 보기"
        >
            {isPending && (
                <p role="status" className="sr-only">
                    응모권 내역을 불러오는 중
                </p>
            )}
            {isPending && <SkeletonList />}
            {isError && (
                <div role="alert" className="text-destructive text-body-sm">
                    응모권 내역을 불러오지 못했습니다.
                    <Button variant="secondary" disabled={isFetching} onClick={onRetry}>
                        다시 시도
                    </Button>
                </div>
            )}
            {!isPending && !isError && histories.length === 0 && (
                <p role="status" className="text-body-sm text-fg-tertiary py-6 text-center">
                    최근 7일 동안 받거나 쓴 응모권이 없어요.
                </p>
            )}
            {histories.length > 0 && (
                <ul className="-mx-4">
                    {histories.slice(0, PREVIEW_COUNT).map((item, index) => (
                        <Fragment key={item.id}>
                            {index > 0 && (
                                <li aria-hidden className="bg-border-default mx-4 h-px" />
                            )}
                            <TicketHistoryRow
                                item={item}
                                open={openId === item.id}
                                onToggle={() =>
                                    setOpenId((prev) => (prev === item.id ? null : item.id))
                                }
                            />
                        </Fragment>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
