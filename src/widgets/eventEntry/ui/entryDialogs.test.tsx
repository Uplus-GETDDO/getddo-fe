import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EntryConfirmDialog } from './EntryConfirmDialog';
import { InsufficientTicketsDialog } from './InsufficientTicketsDialog';

const NOOP = () => {};

// 부족 안내가 미션 링크를 포함해 라우터가 필요하다
const renderDialog = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('EntryConfirmDialog', () => {
    it('쓰는 등급마다 응모 후 남는 장수를 보여주고 총합은 작게 유지한다', () => {
        render(
            <EntryConfirmDialog
                open
                onOpenChange={NOOP}
                title="테스트 래플"
                tickets={{ GOLD: 2, SILVER: 1 }}
                balanceByGrade={{ BRONZE: 4, SILVER: 9, GOLD: 7, PLATINUM: 0 }}
                onConfirm={NOOP}
            />,
        );

        expect(screen.getByText('테스트 래플에 응모할까요?')).toBeInTheDocument();
        expect(screen.getByText('3장')).toBeInTheDocument();
        // 쓰는 등급만 등급 칸으로 보인다
        const tiles = within(screen.getByRole('list', { name: '이번에 쓸 응모권' }));
        expect(tiles.getByText('실버')).toBeInTheDocument();
        expect(tiles.getByText('1장')).toBeInTheDocument();
        expect(tiles.getByText('골드')).toBeInTheDocument();
        expect(tiles.getByText('2장')).toBeInTheDocument();
        expect(screen.queryByText('브론즈')).not.toBeInTheDocument();
        // 쓰는 등급만 '보유 → 잔여' 줄로 보인다 — 실버 9→8, 골드 7→5, 합계 16→13
        const rows = within(screen.getByRole('group', { name: '응모 후 남는 응모권' }));
        expect(rows.getByText('실버')).toBeInTheDocument();
        expect(rows.getByText('9장')).toBeInTheDocument();
        expect(rows.getByText('8장')).toBeInTheDocument();
        expect(rows.getByText('골드')).toBeInTheDocument();
        expect(rows.getByText('7장')).toBeInTheDocument();
        expect(rows.getByText('5장')).toBeInTheDocument();
        expect(rows.getByText('합계')).toBeInTheDocument();
        expect(rows.getByText('16장')).toBeInTheDocument();
        expect(rows.getByText('13장')).toBeInTheDocument();
        expect(screen.getByText('응모 후에는 취소할 수 없어요.')).toBeInTheDocument();
    });

    it('balanceByGrade가 null이면 잔여를 -로 표시한다', () => {
        render(
            <EntryConfirmDialog
                open
                onOpenChange={NOOP}
                title="테스트 래플"
                tickets={{ BRONZE: 1 }}
                balanceByGrade={null}
                onConfirm={NOOP}
            />,
        );
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('빈 tickets 맵이면 응모권 없이 참여한다고 안내한다', () => {
        render(
            <EntryConfirmDialog
                open
                onOpenChange={NOOP}
                title="무료 이벤트"
                tickets={{}}
                balanceByGrade={null}
                onConfirm={NOOP}
            />,
        );

        expect(screen.getByText('응모권 없이 참여하는 이벤트예요.')).toBeInTheDocument();
    });
});

describe('InsufficientTicketsDialog', () => {
    it('브론즈 전용 이벤트면 브론즈 필요 안내를 보여준다', () => {
        renderDialog(<InsufficientTicketsDialog open onOpenChange={NOOP} bronzeRequired />);

        expect(screen.getByText('브론즈 응모권이 필요해요')).toBeInTheDocument();
        expect(screen.getByText(/브론즈 응모권으로만 응모할 수 있어요/)).toBeInTheDocument();
    });

    it('일반 부족 안내를 보여준다', () => {
        renderDialog(<InsufficientTicketsDialog open onOpenChange={NOOP} />);

        expect(screen.getByText('응모권이 부족해요')).toBeInTheDocument();
    });
});
