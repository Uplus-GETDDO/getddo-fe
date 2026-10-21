import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AdminBanner } from '../model/types';

import { AdminBannerTable } from './AdminBannerTable';

const banner = (id: string, displayOrder: number): AdminBanner => ({
    id,
    eventId: `evt-${id}`,
    imageKey: `${id}.png`,
    imageUrl: `/${id}.png`,
    displayOrder,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
});

// 저장된 순서값이 띄엄띄엄한 목록 — 화면 번호와 저장값을 가려내려고 일부러 벌려 둔다
const banners = [banner('a', 10), banner('b', 20), banner('c', 35)];

function renderTable() {
    return render(
        <AdminBannerTable
            banners={banners}
            eventTitleOf={(eventId) => `${eventId ?? '없음'} 이벤트`}
            onMove={vi.fn()}
            onReorder={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
        />,
    );
}

describe('AdminBannerTable', () => {
    it('행 전체를 끌 수 있다고 알린다', () => {
        renderTable();

        for (const row of screen.getAllByRole('row').slice(1)) {
            expect(row).toHaveAttribute('aria-label', expect.stringContaining('끌어서 순서'));
        }
    });

    /* 마우스를 못 쓰는 경우의 유일한 길이라 방향키를 받는다 */
    it('순서 변경 칸의 버튼은 방향키로 위아래 이동을 부른다', async () => {
        const onMove = vi.fn();
        render(
            <AdminBannerTable
                banners={banners}
                eventTitleOf={(eventId) => `${eventId ?? '없음'} 이벤트`}
                onMove={onMove}
                onReorder={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
            />,
        );

        const handle = screen.getByRole('button', { name: /^evt-b 이벤트 배너 순서 바꾸기/ });
        handle.focus();
        await userEvent.keyboard('{ArrowUp}');
        expect(onMove).toHaveBeenCalledWith(banners[1], 'up');

        await userEvent.keyboard('{ArrowDown}');
        expect(onMove).toHaveBeenLastCalledWith(banners[1], 'down');
    });

    /*
     * 끄는 동안 숫자가 따라오게 하려면 저장값이 아니라 자리를 세야 한다.
     * 저장값(10·20·35)을 그대로 쓰면 놓은 자리와 숫자가 어긋나 보인다.
     */
    it('순서 칸은 저장된 값이 아니라 목록 안의 자리를 보여 준다', () => {
        renderTable();

        const rows = screen.getAllByRole('row').slice(1);
        expect(rows).toHaveLength(3);
        rows.forEach((row, index) => {
            expect(within(row).getByText(String(index + 1))).toBeInTheDocument();
        });
        expect(screen.queryByText('35')).not.toBeInTheDocument();
    });

    it('순서 변경 중에는 끌기 버튼을 잠근다', () => {
        render(
            <AdminBannerTable
                banners={banners}
                eventTitleOf={() => '테스트'}
                onMove={vi.fn()}
                onReorder={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                disabled
            />,
        );

        for (const handle of screen.getAllByRole('button', { name: /순서 바꾸기/ })) {
            expect(handle).toBeDisabled();
        }
    });
});
