import { Fragment, useState } from 'react';

import { TicketHistoryRow, type TicketHistory } from '@entities/ticket';
import { LoadError } from '@shared/ui/load-error';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { SkeletonList } from '@shared/ui/skeleton';

import { SectionCard } from './SectionCard';

/** 미리보기 줄 수 */
const PREVIEW_COUNT = 5;

/**
 * 마이페이지 "응모권 내역" — 최근 7일 동안 받고 쓴 응모권.
 * 미션 페이지 응모권 내역과 같은 줄(누르면 상세가 펼쳐지는 아코디언)을 쓰고, 상세는 한 번에 하나만 펼친다.
 * 최근 5줄만 보이고 나머지와 쪽 넘김은 "전체 보기"(/my-tickets)에서
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
    const items = histories.slice(0, PREVIEW_COUNT);
    return (
        <SectionCard
            title="응모권 내역"
            description={`최근 7일 동안 받고 쓴 응모권 중 ${PREVIEW_COUNT}건이에요.`}
            moreTo="/my-tickets"
            moreLabel="응모권 내역 전체 보기"
            status={
                // 받아 둔 내역이 있으면 목록을 그대로 두고 제목 옆 작은 갱신 실패 표시만 — 비어 있을 때만 실패 칸으로 바꾼다
                isError &&
                histories.length > 0 && (
                    <RefreshStatus fetching={isFetching} error onRefresh={onRetry} />
                )
            }
        >
            {isPending && (
                <p role="status" className="sr-only">
                    응모권 내역을 불러오는 중
                </p>
            )}
            {isPending && <SkeletonList count={PREVIEW_COUNT} />}
            {isError && histories.length === 0 && (
                <LoadError
                    title="응모권 내역을 불러오지 못했어요"
                    onRetry={onRetry}
                    retrying={isFetching}
                />
            )}
            {!isPending && !isError && histories.length === 0 && (
                <p role="status" className="text-body-sm text-fg-tertiary py-6 text-center">
                    최근 7일 동안 받거나 쓴 응모권이 없어요.
                </p>
            )}
            {histories.length > 0 && (
                <ul className="-mx-4">
                    {items.map((item, index) => (
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
