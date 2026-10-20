import type { Notification } from '@entities/notification';

import { groupNotifications } from './groupNotifications';

const item = (id: string, createdAt: string): Notification => ({
    id,
    title: id,
    body: '',
    createdAt,
    isRead: false,
    eventId: null,
    linkUrl: null,
});

describe('groupNotifications', () => {
    // 2026-10-06 10:00 KST
    const now = new Date('2026-10-06T01:00:00Z');

    it('KST 날짜별로 오늘·어제·날짜로 묶는다', () => {
        const groups = groupNotifications(
            [
                // 2026-10-06 00:30 KST — UTC로는 전날이지만 KST로는 오늘
                item('a', '2026-10-05T15:30:00Z'),
                // 2026-10-05 23:59 KST
                item('b', '2026-10-05T14:59:00Z'),
                // 2026-10-03 09:00 KST (토)
                item('c', '2026-10-03T00:00:00Z'),
            ],
            now,
        );
        expect(groups).toEqual([
            { label: '오늘', items: [expect.objectContaining({ id: 'a' })] },
            { label: '어제', items: [expect.objectContaining({ id: 'b' })] },
            { label: '10월 3일 (토)', items: [expect.objectContaining({ id: 'c' })] },
        ]);
    });

    it('빈 묶음은 만들지 않고, 같은 날짜 안에서는 받은 순서를 유지한다', () => {
        const groups = groupNotifications(
            [item('b', '2026-10-01T03:00:00Z'), item('c', '2026-10-01T01:00:00Z')],
            now,
        );
        expect(groups.map((g) => g.label)).toEqual(['10월 1일 (목)']);
        expect(groups[0]?.items.map((n) => n.id)).toEqual(['b', 'c']);
    });
});
