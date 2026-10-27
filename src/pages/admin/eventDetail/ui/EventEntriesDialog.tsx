import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';

import { useAdminUser } from '@entities/user';
import { Button } from '@shared/ui/button';
import { ChipTabs } from '@shared/ui/chip-tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { AdminUserDetailSheet } from '@widgets/adminUserDetail';
import { EventEntryHistoryTable, EventParticipantsTable } from '@widgets/eventEntryTables';

export type EventEntriesView = 'participants' | 'history';

const TABS: { value: EventEntriesView; label: string }[] = [
    { value: 'participants', label: '참여자' },
    { value: 'history', label: '응모 이력' },
];

/**
 * 이벤트 상세에서 여는 참여자·응모 이력 — 응모 조회 화면으로 통째로 옮겨 가면 보던 이벤트 상세가 사라져
 * 어색했다. 모달 안에서 두 목록을 탭으로 오가고, 참여자를 누르면 같은 자리에서 사용자 상세로 바뀐다
 * (닫기·Esc·'참여자 목록으로'로 목록에 돌아온다)
 */
export function EventEntriesDialog({
    eventId,
    eventTitle,
    view,
    onViewChange,
    onClose,
}: {
    eventId: string;
    eventTitle: string;
    /** 열린 탭 — null이면 닫힘 */
    view: EventEntriesView | null;
    onViewChange: (view: EventEntriesView) => void;
    onClose: () => void;
}) {
    const [userId, setUserId] = useState<string | null>(null);
    const userQuery = useAdminUser(userId);

    return (
        <Dialog
            open={view !== null}
            onOpenChange={(open) => {
                if (open) return;
                setUserId(null);
                onClose();
            }}
        >
            <DialogContent
                className="flex h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
                // 사용자 상세를 보는 중이면 Esc는 한 단계만 — 모달을 닫지 않고 참여자 목록으로 돌아간다
                onEscapeKeyDown={(event) => {
                    if (!userId) return;
                    event.preventDefault();
                    setUserId(null);
                }}
            >
                <DialogHeader className="border-border-default gap-3 border-b px-6 pt-6 pb-4">
                    <DialogTitle className="text-fg-primary pr-8 text-xl leading-7 font-semibold break-words">
                        {eventTitle}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        이 이벤트의 참여자와 응모 이력을 봅니다.
                    </DialogDescription>
                    {view && (
                        <ChipTabs
                            tabs={TABS}
                            value={view}
                            onValueChange={(next) => {
                                setUserId(null);
                                onViewChange(next);
                            }}
                            label="참여자·응모 이력 구분"
                            idPrefix="event-entries"
                        />
                    )}
                </DialogHeader>

                {view === 'participants' && userId && (
                    // 사용자 상세 — 사용자 조회와 같은 칸을 모달 안에 그대로 둔다
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="px-4 pt-3">
                            <Button variant="ghost" size="sm" onClick={() => setUserId(null)}>
                                <ChevronLeft aria-hidden />
                                참여자 목록으로
                            </Button>
                        </div>
                        <AdminUserDetailSheet
                            userId={userId}
                            user={userQuery.data}
                            isPending={userQuery.isPending}
                            error={userQuery.error}
                            onClose={() => setUserId(null)}
                            returnLabel={`이벤트 관리 · ${eventTitle}`}
                        />
                    </div>
                )}

                {view && !(view === 'participants' && userId) && (
                    <div
                        role="tabpanel"
                        id={`event-entries-panel-${view}`}
                        aria-labelledby={`event-entries-tab-${view}`}
                        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                    >
                        {view === 'participants' ? (
                            <EventParticipantsTable eventId={eventId} onSelectUser={setUserId} />
                        ) : (
                            <EventEntryHistoryTable eventId={eventId} />
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
