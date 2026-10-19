import { groupTicketHistories, useMyTickets, useTicketHistories } from '@entities/ticket';
import { useSessionStore } from '@entities/user';
import { AppearanceSettings } from '@features/appearanceSettings';
import { useVirtualClock } from '@shared/model/virtualClock';
import { formatKstDot, isSameKstDate } from '@shared/utils/date';
import { latestWonAt, useMyEntryRows } from '@widgets/myEntryRows';

import { AccountInfoCard } from './ui/AccountInfoCard';
import { ProfileCard } from './ui/ProfileCard';
import { RecentEntriesCard } from './ui/RecentEntriesCard';
import { RecentTicketsCard } from './ui/RecentTicketsCard';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 마이페이지 — 프로필·요약 칸이 머리, 왼쪽에 응모 내역·응모권 내역 미리보기, 오른쪽에 화면 설정·계정 정보.
 * 미리보기의 "전체 보기"는 /my-entries·/my-tickets로 이어진다 (피그마 "마이 페이지 · 개선안").
 * 글자 크기는 홈·미션과 같은 단계: 카드 제목 title-3(20), 줄 제목 body-bold(16), 요약 숫자 title-2(24)
 */
export function MyPage() {
    const user = useSessionStore((state) => state.user);
    const clock = useVirtualClock();
    const now = clock.now();
    const ticketsQuery = useMyTickets();
    const historiesQuery = useTicketHistories();
    const entries = useMyEntryRows();

    const groups = groupTicketHistories(historiesQuery.data ?? []);
    const recentHistories = [...(historiesQuery.data ?? [])]
        .filter((item) => now.getTime() - new Date(item.createdAt).getTime() <= WEEK_MS)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const todayGranted = groups
        .filter((group) => group.operationType === 'GRANT' && isSameKstDate(group.createdAt, now))
        .reduce((sum, group) => sum + group.count, 0);
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
                        todayGranted,
                        entriesLoading: entries.isPending,
                        historiesLoading: historiesQuery.isPending,
                    }}
                />
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24.5rem]">
                <div className="flex flex-col gap-6">
                    <RecentEntriesCard
                        rows={entries.rows}
                        isPending={entries.isPending}
                        isError={entries.isError}
                        isResultError={entries.isResultError}
                    />
                    <RecentTicketsCard
                        histories={recentHistories}
                        isPending={historiesQuery.isPending}
                        isError={historiesQuery.isError}
                    />
                </div>
                {/* 화면 설정·계정 정보는 스크롤해도 헤더(76) 아래 20 자리에 붙어 따라온다 — 넓은 화면(두 칸)에서만 */}
                <div className="flex flex-col gap-6 lg:sticky lg:top-24">
                    <AppearanceSettings />
                    {user && <AccountInfoCard user={user} />}
                </div>
            </div>
        </main>
    );
}
