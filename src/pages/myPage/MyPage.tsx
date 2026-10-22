import { useState } from 'react';

import {
    ticketDayRange,
    useTicketHistoryCounts,
    useMyTickets,
    useTicketHistories,
} from '@entities/ticket';
import { useSessionStore } from '@entities/user';
import { AppearanceSettings } from '@features/appearanceSettings';
import { useVirtualClock } from '@shared/model/virtualClock';
import { formatKstDot } from '@shared/utils/date';
import { latestWonAt, MyEntryRefreshStatus, useMyEntryRows } from '@widgets/myEntryRows';

import { AccountInfoCard } from './ui/AccountInfoCard';
import { ProfileCard } from './ui/ProfileCard';
import { RECENT_ENTRY_COUNT, RecentEntriesCard } from './ui/RecentEntriesCard';
import { RecentNotificationsCard } from './ui/RecentNotificationsCard';
import { RecentTicketsCard } from './ui/RecentTicketsCard';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 마이페이지 — 프로필·요약 칸이 머리, 왼쪽에 응모 내역·응모권 내역·알림 미리보기, 오른쪽에 화면 설정·계정 정보.
 * 미리보기의 "전체 보기"는 /my-entries·/my-tickets로 이어진다 (피그마 "마이 페이지 · 개선안").
 * 글자 크기는 홈·미션과 같은 단계: 카드 제목 title-3(20), 줄 제목 body-bold(16), 요약 숫자 title-2(24)
 */
export function MyPage() {
    const user = useSessionStore((state) => state.user);
    const clock = useVirtualClock();
    const now = clock.now();
    const ticketsQuery = useMyTickets();
    const anchorKey = `${clock.override?.toISOString() ?? 'real'}:${ticketDayRange(now).from}`;
    const [anchor, setAnchor] = useState({ key: anchorKey, time: now.getTime() });
    const time = anchor.key === anchorKey ? anchor.time : now.getTime();
    if (anchor.key !== anchorKey) setAnchor({ key: anchorKey, time });
    const historiesQuery = useTicketHistories({
        from: new Date(time - WEEK_MS).toISOString(),
        to: new Date(time).toISOString(),
    });
    const daily = useTicketHistoryCounts([{ operationType: 'GRANT', ...ticketDayRange(now) }]);
    // 보이는 줄의 결과만 폴링한다
    const entries = useMyEntryRows({
        selectVisibleRows: (rows) => rows.slice(0, RECENT_ENTRY_COUNT),
    });

    const won = entries.rows.filter((row) => row.result === 'WON');
    const lastWonAt = latestWonAt(won);

    return (
        <main className="mx-auto flex w-full max-w-312 flex-col gap-6 px-6 pb-28">
            {user && (
                <ProfileCard
                    user={user}
                    ticketsQuery={ticketsQuery}
                    stats={{
                        pendingCount: entries.rows.filter((row) => row.result === 'PENDING').length,
                        wonCount: won.length,
                        lastWonLabel: lastWonAt ? formatKstDot(lastWonAt) : null,
                        todayGranted: daily.counts[0],
                        historiesError: daily.isError,
                        historiesFetching: daily.isFetching,
                        onRetryHistories: daily.refetch,
                        entriesLoading: entries.isPending || entries.isResultPending,
                        entriesFailed: entries.isError,
                        entriesUnavailable: entries.isResultInitialError,
                        historiesLoading: daily.isPending,
                    }}
                />
            )}

            {/* 좁은 화면도 칸 너비를 화면에 묶는다 — 칸을 정하지 않으면 가장 긴 줄(응모 내역·사용자 ID)만큼 넓어져 오른쪽이 잘렸다 */}
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24.5rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <RecentEntriesCard
                        rows={entries.rows}
                        isPending={entries.isPending}
                        isError={entries.isError}
                        onRetry={() => void entries.refetch()}
                        retrying={entries.isFetching}
                        status={
                            !entries.isPending &&
                            !entries.isError && <MyEntryRefreshStatus query={entries} />
                        }
                    />
                    <RecentTicketsCard
                        histories={historiesQuery.items}
                        isPending={historiesQuery.isPending}
                        isError={historiesQuery.isError || historiesQuery.cursorError}
                        isFetching={historiesQuery.isFetching}
                        onRetry={() => void historiesQuery.refetch()}
                    />
                    <RecentNotificationsCard now={now} />
                </div>
                {/* 화면 설정·계정 정보는 스크롤해도 헤더(76) 아래 20 자리에 붙어 따라온다 — 넓은 화면(두 칸)에서만 */}
                <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
                    <AppearanceSettings />
                    {/* 계정을 바꾸면 ID 보기 상태를 처음(가림)으로 */}
                    {user && <AccountInfoCard key={user.id} user={user} />}
                </div>
            </div>
        </main>
    );
}
