import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { AdminEventPicker, AdminEventTitle } from '@entities/event';
import { useAdminUser } from '@entities/user';
import { readReturnTo } from '@shared/model/returnTo';
import { Button } from '@shared/ui/button';
import { ListDetailLayout } from '@shared/ui/inspector';
import { AdminUserDetailSheet } from '@widgets/adminUserDetail';
import { EventParticipantsTable } from '@widgets/eventEntryTables';

const asUuid = (value: string | null) => (value && z.uuid().safeParse(value).success ? value : '');

// AO07 — 이벤트 참여자. 이벤트를 고르기 전(또는 URL의 eventId가 UUID가 아니면)에는 안내만 하고 요청하지 않는다.
// 삭제된 이벤트도 계약대로 직접 조회할 수 있게 이벤트 상세 조회 성공에 의존하지 않는다.
export function ParticipantsPanel() {
    const [searchParams, setSearchParams] = useSearchParams();
    // 다른 화면에서 건너왔으면 머리의 '← 돌아가기'가 길을 맡는다 — 여기 링크까지 두면 두 개가 겹친다
    const location = useLocation();
    const cameWithReturn = readReturnTo(location.state as unknown) !== null;
    // 고른 참여자 — 사용자 조회와 같은 ?detail= 로 둬 새로고침·뒤로가기에도 같은 사람이 열려 있다
    const detailId = asUuid(searchParams.get('detail')) || null;
    const detailQuery = useAdminUser(detailId);
    // 상세를 열고 닫는 것은 같은 화면 안의 일이라 보던 이벤트·보기 조건은 두고 스크롤도 올리지 않는다
    const setDetail = (id: string | null) => {
        const next = new URLSearchParams(searchParams);
        if (id) next.set('detail', id);
        else next.delete('detail');
        // 이벤트 관리에서 실려 온 돌아갈 곳(state)도 그대로 넘긴다 — 안 그러면 줄을 누르는 순간 머리의 '← 돌아가기'가 사라졌다
        setSearchParams(next, { preventScrollReset: true, state: location.state as unknown });
    };
    const urlEventId = asUuid(searchParams.get('eventId'));
    const [eventId, setEventId] = useState(urlEventId);

    // URL의 eventId가 바뀌면 입력·조회 상태를 함께 맞춘다
    const [prevUrlEventId, setPrevUrlEventId] = useState(urlEventId);
    if (prevUrlEventId !== urlEventId) {
        setPrevUrlEventId(urlEventId);
        setEventId(urlEventId);
    }

    const select = (next: string) => setEventId(next);

    return (
        <div className="flex flex-col gap-6">
            {/* 탭 없이 링크로만 들어오는 보기라, 어디서 왔는지와 무엇의 참여자인지를 맨 위에 둔다 */}
            <div className="flex flex-col gap-2">
                {!cameWithReturn && (
                    <Button variant="link" size="text" className="w-fit" asChild>
                        <Link to={eventId ? `/admin/events/${eventId}` : '/admin/entries'}>
                            {eventId ? '이벤트 상세로' : '응모 이력으로'}
                        </Link>
                    </Button>
                )}
                <h2 className="text-title-2 text-fg-primary">
                    {eventId ? <AdminEventTitle eventId={eventId} /> : '이벤트'} 참여자
                </h2>
            </div>
            <AdminEventPicker eventId={eventId} onChange={select} label="참여자를 볼 이벤트" />

            {!eventId && (
                <p className="text-body-sm text-fg-secondary py-6">
                    이벤트를 고르면 참여자를 볼 수 있어요.
                </p>
            )}

            {/*
             * 줄을 누르면 사용자 조회와 같은 상세가 옆 칸에 열린다 — 이름·ID를 복사해 사용자 조회에서
             * 다시 검색하지 않아도 된다. 상세의 '응모·응모권 이력 조회'로 이어서 갈 수 있다
             */}
            {eventId && (
                <ListDetailLayout
                    open={detailId !== null}
                    detailKey={detailId}
                    label="참여자 상세"
                    detail={
                        <AdminUserDetailSheet
                            userId={detailId}
                            user={detailQuery.data}
                            isPending={detailQuery.isPending}
                            error={detailQuery.error}
                            onClose={() => setDetail(null)}
                            returnLabel="응모 조회 · 참여자"
                        />
                    }
                    list={
                        <EventParticipantsTable
                            eventId={eventId}
                            selectedUserId={detailId}
                            onSelectUser={setDetail}
                        />
                    }
                />
            )}
        </div>
    );
}
