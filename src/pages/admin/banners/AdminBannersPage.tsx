import { useCallback, useMemo, useRef, useState } from 'react';

import type { AdminBanner } from '@entities/banner';

import { AdminBannerTable, BANNER_MAX_COUNT, useAdminBanners } from '@entities/banner';
import { useAdminEvents } from '@entities/event';
import {
    BannerFormDialog,
    DeleteBannerDialog,
    moveBannerId,
    useReorderBanners,
} from '@features/manageBanner';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { LoadingBlock, TableSkeleton } from '@shared/ui/skeleton';

// 연결 이벤트 선택지·제목 해석용 — 이벤트 수가 한 번에 담기는 시연 규모를 전제로 한 페이지로 받는다
const EVENT_LOOKUP_SIZE = 100;

export function AdminBannersPage() {
    const { data: banners, isPending, isError } = useAdminBanners();
    const {
        data: eventPage,
        isPending: eventsPending,
        isError: eventsError,
        refetch: refetchEvents,
    } = useAdminEvents({ page: 1, size: EVENT_LOOKUP_SIZE });
    const reorder = useReorderBanners();

    // 등록은 'new', 수정은 대상 배너, 닫힘은 null
    const [formTarget, setFormTarget] = useState<AdminBanner | 'new' | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminBanner | null>(null);
    // 삭제로 행 버튼이 사라진 뒤 포커스가 갈 안정된 대상
    const addButtonRef = useRef<HTMLButtonElement>(null);

    const events = useMemo(
        () => (eventPage?.items ?? []).map(({ id, title }) => ({ id, title })),
        [eventPage],
    );
    // 조회 중·실패는 실제 미확인(삭제)과 구분한다 — 조회 실패는 이벤트 ID를 그대로 보여준다
    const eventTitleOf = useCallback(
        (eventId: string | null) => {
            if (eventId === null) return '(미연결 배너)';
            const title = events.find((event) => event.id === eventId)?.title;
            if (title) return title;
            if (eventsPending) return '이벤트 확인 중…';
            if (eventsError) return `(${eventId})`;
            return '(삭제되었거나 알 수 없는 이벤트)';
        },
        [events, eventsPending, eventsError],
    );

    const handleMove = useCallback(
        (banner: AdminBanner, direction: 'up' | 'down') => {
            const next = moveBannerId(
                (banners ?? []).map((item) => item.id),
                banner.id,
                direction,
            );
            if (next) reorder.mutate(next);
        },
        [banners, reorder],
    );
    // 끌어 놓기는 표가 정한 전체 순서를 그대로 보낸다 — 한 칸 이동과 달리 계산할 게 없다
    const handleReorder = useCallback(
        (bannerIds: string[]) => reorder.mutate(bannerIds),
        [reorder],
    );
    const handleEdit = useCallback((banner: AdminBanner) => setFormTarget(banner), []);
    const handleDelete = useCallback((banner: AdminBanner) => setDeleteTarget(banner), []);

    const count = banners?.length ?? 0;
    const full = count >= BANNER_MAX_COUNT;
    const editing = formTarget !== null && formTarget !== 'new' ? formTarget : null;
    // 쓰기 순서는 보존된 이전 값이 아닌 현재 목록의 1기반 위치다.
    const displayOrder = editing
        ? (banners ?? []).findIndex((banner) => banner.id === editing.id) + 1
        : count + 1;

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* 설명을 버튼 높이에 맞춰 가운데로 내리면 다른 화면보다 첫 줄이 아래에서 시작한다 */}
            <div className="flex flex-wrap items-start gap-3">
                <p className="text-body-sm text-fg-secondary">
                    홈 화면 상단에 노출됩니다. 위쪽 배너가 먼저 보이며 최대 {BANNER_MAX_COUNT}개까지
                    등록할 수 있습니다{banners ? ` (현재 ${count}개)` : ''}.
                </p>
                <Button
                    ref={addButtonRef}
                    className="ml-auto"
                    disabled={isPending || isError || full}
                    onClick={() => setFormTarget('new')}
                >
                    배너 등록
                </Button>
            </div>
            {full && (
                <p className="text-fg-secondary text-body-sm">
                    배너가 {BANNER_MAX_COUNT}개라 더 등록할 수 없습니다. 기존 배너를 삭제하면 등록할
                    수 있습니다.
                </p>
            )}

            {isPending && (
                <LoadingBlock>
                    <TableSkeleton />
                </LoadingBlock>
            )}
            {isError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    배너 목록을 불러오지 못했습니다.
                </p>
            )}
            {banners && banners.length === 0 && (
                <p className="text-fg-secondary text-body-sm py-6">등록된 배너가 없습니다.</p>
            )}
            {reorder.isError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    {getErrorMessage(
                        reorder.error,
                        '노출 순서를 바꾸지 못했습니다. 다시 시도해주세요.',
                    )}
                </p>
            )}
            {eventsError && (
                <div className="flex items-center gap-3">
                    <p role="alert" className="text-semantic-error-strong text-body-sm">
                        연결할 이벤트 목록을 불러오지 못했습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void refetchEvents()}>
                        다시 시도
                    </Button>
                </div>
            )}
            {banners && banners.length > 0 && (
                <AdminBannerTable
                    banners={banners}
                    onReorder={handleReorder}
                    eventTitleOf={eventTitleOf}
                    onMove={handleMove}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    disabled={reorder.isPending}
                />
            )}

            <BannerFormDialog
                open={formTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setFormTarget(null);
                }}
                banner={editing}
                events={events}
                eventsPending={eventsPending}
                eventsError={eventsError}
                onEventsRetry={() => void refetchEvents()}
                displayOrder={displayOrder}
            />
            <DeleteBannerDialog
                banner={deleteTarget}
                eventTitle={deleteTarget ? eventTitleOf(deleteTarget.eventId) : ''}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                onDeleted={() => addButtonRef.current?.focus()}
            />
        </div>
    );
}
