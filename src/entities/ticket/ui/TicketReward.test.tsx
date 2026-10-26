import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { TicketRewardDialog } from './TicketReward';

describe('TicketRewardDialog', () => {
    it('미션 보상도 게임처럼 캡슐 뽑기로 시작한다', () => {
        render(
            <MemoryRouter>
                <TicketRewardDialog
                    open
                    onOpenChange={() => {}}
                    tickets={1}
                    grade="GOLD"
                    source="미션"
                />
            </MemoryRouter>,
        );
        expect(
            screen.getByRole('dialog', { name: '오늘의 미션 보상이 도착했어요' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '보상 뽑기' })).toBeInTheDocument();
    });
});
