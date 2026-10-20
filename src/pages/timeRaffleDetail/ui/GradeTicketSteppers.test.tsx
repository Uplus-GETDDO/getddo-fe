import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { TicketsByGrade } from '@entities/entry';
import type { TicketGrade } from '@entities/ticket';

import { GradeTicketSteppers } from './GradeTicketSteppers';

const OWNED: Record<TicketGrade, number> = { BRONZE: 7, SILVER: 2, GOLD: 1, PLATINUM: 0 };

function setup({
    availableByGrade = OWNED,
    remainingLimit = 5,
}: {
    availableByGrade?: Record<TicketGrade, number> | null;
    remainingLimit?: number | null;
} = {}) {
    function Harness() {
        const [value, setValue] = useState<TicketsByGrade>({
            BRONZE: 0,
            SILVER: 0,
            GOLD: 0,
            PLATINUM: 0,
        });
        return (
            <GradeTicketSteppers
                value={value}
                onChange={setValue}
                availableByGrade={availableByGrade}
                remainingLimit={remainingLimit}
            />
        );
    }
    render(<Harness />);
}

describe('GradeTicketSteppers', () => {
    it('플래티넘도 합계와 10배 가중치에 반영한다', async () => {
        const user = userEvent.setup();
        setup({ availableByGrade: { ...OWNED, PLATINUM: 1 } });
        await user.click(screen.getByRole('button', { name: '플래티넘 응모 수량 늘리기' }));
        expect(screen.getByText('합계 1장')).toBeInTheDocument();
        expect(screen.getByText('추첨에 브론즈 10장만큼 들어가요')).toBeInTheDocument();
    });

    it('등급별 라벨과 보유 장수를 보여준다', () => {
        setup();

        expect(screen.getByText('브론즈')).toBeInTheDocument();
        expect(screen.getByText('실버')).toBeInTheDocument();
        expect(screen.getByText('골드')).toBeInTheDocument();
        expect(screen.getByText('보유 7장')).toBeInTheDocument();
        expect(screen.getByText('보유 2장')).toBeInTheDocument();
        expect(screen.getByText('보유 1장')).toBeInTheDocument();
    });

    it('등급별 스테퍼로 장수를 고르면 합계가 갱신된다', async () => {
        const user = userEvent.setup();
        setup();

        await user.click(screen.getByRole('button', { name: '골드 응모 수량 늘리기' }));
        await user.click(screen.getByRole('button', { name: '실버 응모 수량 늘리기' }));

        expect(screen.getByText('합계 2장')).toBeInTheDocument();
    });

    it('숫자를 직접 입력할 수 있고, 보유 장수를 넘기면 보유 장수로 맞춘다', async () => {
        const user = userEvent.setup();
        setup();

        const bronze = screen.getByRole('textbox', { name: '브론즈 응모 수량' });
        await user.click(bronze);
        await user.keyboard('3');
        expect(bronze).toHaveValue('3');

        // 실버는 2장뿐 — 9를 넣어도 2가 된다
        const silver = screen.getByRole('textbox', { name: '실버 응모 수량' });
        await user.click(silver);
        await user.keyboard('9');
        expect(silver).toHaveValue('2');
        expect(screen.getByText('합계 5장')).toBeInTheDocument();
    });

    it('입력 칸을 비우고 벗어나면 0으로 돌린다', async () => {
        const user = userEvent.setup();
        setup();

        const bronze = screen.getByRole('textbox', { name: '브론즈 응모 수량' });
        await user.click(bronze);
        await user.keyboard('2');
        await user.clear(bronze);
        await user.tab();
        expect(bronze).toHaveValue('0');
    });

    it('보유 장수 이상으로 올리지 못한다', async () => {
        const user = userEvent.setup();
        setup();

        // 골드는 1장뿐 — 한 번 올리면 더 늘리기가 비활성화된다
        const increase = screen.getByRole('button', { name: '골드 응모 수량 늘리기' });
        await user.click(increase);
        expect(increase).toBeDisabled();
    });

    it('합계가 남은 누적 상한을 넘지 못한다', async () => {
        const user = userEvent.setup();
        setup({ remainingLimit: 2 });

        const bronzeIncrease = screen.getByRole('button', { name: '브론즈 응모 수량 늘리기' });
        await user.click(bronzeIncrease);
        await user.click(bronzeIncrease);
        // 상한 2장을 채우면 모든 등급의 늘리기가 잠긴다
        expect(bronzeIncrease).toBeDisabled();
        expect(screen.getByRole('button', { name: '실버 응모 수량 늘리기' })).toBeDisabled();
    });

    it('잔액을 못 불러오면 모든 스테퍼가 0장에서 잠긴다', () => {
        setup({ availableByGrade: null });

        expect(screen.getByRole('button', { name: '브론즈 응모 수량 늘리기' })).toBeDisabled();
    });
});
