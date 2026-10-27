import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';

import { TicketHistoryRow, useTicketHistories } from '@entities/ticket';
import { Button } from '@shared/ui/button';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadError } from '@shared/ui/load-error';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { SkeletonList } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';

import { useFreshIds } from '../hooks/useFreshIds';
import { SectionHeader } from './SectionHeader';

/** 미션 페이지에서 미리 보여 주는 최근 내역 수 — 나머지는 마이페이지 응모권 내역(/my-tickets)에서 본다 */
const PREVIEW_SIZE = 10;
const TITLE = '응모권 적립 · 사용 내역';

/**
 * 최근 지급·차감 이력(누르면 상세가 펼쳐지는 아코디언). 사용 가능·이번 달 요약은 페이지 머리의 응모권 지갑이 보여 준다.
 * 최근 10건만 보이고, 더 있으면 '전체보기'로 마이페이지 응모권 내역에 넘긴다 — 여기서 이어 받지 않는다.
 * 제목 옆 갱신 표시는 다시 받는 중이면 아이콘이 돌고, 실패하면 받아 둔 내역을 둔 채 다시 시도를 연다.
 * 높이는 옆 출석 카드를 따라가도록 내용을 absolute로 띄운다.
 */
export function TicketHistoryCard({
    className,
    narrow = false,
}: {
    className?: string;
    /**
     * 출석판을 펼쳐 넓은 화면에서 이 칸이 좁아졌는가 — 그때는 제목을 '응모권 내역'으로 줄이고 갱신 표시는 아이콘만 남겨
     * 제목·갱신·전체보기를 한 줄에 둔다 (두 줄로 접히면 전체보기만 따로 떨어져 보였다). 한 칸으로 쌓이는 좁은 화면은 그대로
     */
    narrow?: boolean;
}) {
    const query = useTicketHistories({ size: PREVIEW_SIZE });
    const { items: history, isPending, isError } = query;
    const failed = isError || query.cursorError;
    // 새 내역이 위에서 들어오며 잠깐 강조된다 — 받기 전에는 목록이 빈 배열이라 그걸 첫 목록으로 기억하면
    // 처음 받은 내역이 전부 새 항목으로 강조된다. 첫 응답이 온 뒤의 목록부터 비교한다
    const freshIds = useFreshIds(isPending ? undefined : history.map((item) => item.id));
    // 상세는 한 번에 하나만 펼친다
    const [openId, setOpenId] = useState<string | null>(null);
    const retry = () => void query.refetch();

    return (
        <>
            <SectionHeader
                title={
                    narrow ? (
                        <>
                            <span className="lg:hidden">{TITLE}</span>
                            <span className="hidden lg:inline">응모권 내역</span>
                        </>
                    ) : (
                        TITLE
                    )
                }
                // 처음 받는 중과 비어 있는 실패는 카드 안 뼈대·실패 칸이 알린다
                refresh={
                    !isPending &&
                    !(failed && history.length === 0) && (
                        <RefreshStatus
                            fetching={query.isFetching}
                            updatedAt={query.dataUpdatedAt}
                            error={failed}
                            onRefresh={retry}
                            labelClassName={narrow ? 'lg:sr-only' : undefined}
                        />
                    )
                }
                // 10건 뒤에도 내역이 있으면 마이페이지 응모권 내역으로 — 카드 아래에 두면 스크롤 끝이라 잘 보이지 않았다
                action={
                    query.hasNextPage && (
                        <Button asChild variant="link" size="text">
                            <Link to="/my-tickets">
                                전체보기
                                <ChevronRight />
                            </Link>
                        </Button>
                    )
                }
            />
            <div
                className={cn(
                    'bg-surface-page border-border-default relative min-h-75 overflow-hidden rounded-2xl border shadow-md',
                    className,
                )}
            >
                {/* 카드 여백 8 + 줄 여백 16 = 24 — 옆 출석 카드와 같은 여백 (DESIGN-SYSTEM 5절) */}
                <div className="absolute inset-0 flex flex-col gap-2 p-2">
                    {/*
                  항상 보이는 얇은 border/strong 색 스크롤바(4px, 손잡이 최소 64px).
                  크롬·사파리는 ::-webkit-scrollbar로 그리면 macOS에서도 숨겨지지 않는다 — 표준 scrollbar-* 속성을 함께 주면 이 설정이 무시되므로 파이어폭스에만 준다.
                  마지막 항목이 페이드에 가리지 않게 아래 여백을 둔다
                */}
                    <div className="[&::-webkit-scrollbar-thumb]:bg-border-strong min-h-0 flex-1 overflow-y-auto pr-1 pb-6 supports-[-moz-appearance:none]:[scrollbar-width:thin] supports-[-moz-appearance:none]:[scrollbar-color:var(--color-border-strong)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:min-h-16 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        {isPending && (
                            <p role="status" className="sr-only">
                                응모권 내역을 불러오는 중
                            </p>
                        )}
                        {isPending && <SkeletonList count={4} className="p-4" />}
                        {/* 받아 둔 내역이 있으면 제목 옆 갱신 표시로만 알리고, 비어 있을 때만 실패 칸을 띄운다 */}
                        {failed && history.length === 0 && (
                            <LoadError
                                title="응모권 내역을 불러오지 못했어요"
                                onRetry={retry}
                                retrying={query.isFetching}
                            />
                        )}
                        {!isPending && !failed && history.length === 0 && (
                            // 빈 칸에 글 한 줄만 있으면 고장 난 것처럼 허전했다 — 빈 상태 타코야끼를 카드 가운데에 둔다
                            <div role="status" className="flex h-full items-center justify-center">
                                <EmptyState
                                    title="아직 응모권 내역이 없어요"
                                    description="출석하거나 미션·게임을 하면 여기에 쌓여요."
                                />
                            </div>
                        )}
                        {history && history.length > 0 && (
                            <ul>
                                {history.map((item, index) => (
                                    <Fragment key={item.id}>
                                        {index > 0 && (
                                            <li aria-hidden className="bg-border-default h-px" />
                                        )}
                                        <TicketHistoryRow
                                            item={item}
                                            open={openId === item.id}
                                            onToggle={() =>
                                                setOpenId((prev) =>
                                                    prev === item.id ? null : item.id,
                                                )
                                            }
                                            fresh={freshIds.has(item.id)}
                                        />
                                    </Fragment>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* 아래로 내역이 더 있음을 암시하는 페이드 */}
                <div
                    aria-hidden
                    className="to-surface-page pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl bg-linear-to-b from-transparent to-80%"
                />
            </div>
        </>
    );
}
