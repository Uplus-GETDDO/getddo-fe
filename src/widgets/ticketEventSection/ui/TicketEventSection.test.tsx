import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TicketEventSection } from './TicketEventSection';

describe('TicketEventSection 빈 칸', () => {
    it('진행 중·오픈 예정이 모두 없으면 두 칸 모두 "없어요"를 보인다', () => {
        render(
            <MemoryRouter>
                <TicketEventSection events={[]} />
            </MemoryRouter>,
        );
        expect(screen.getByText('진행 중인 겟또타임이 없어요')).toBeInTheDocument();
        expect(screen.getByText('오픈 예정인 겟또타임이 없어요')).toBeInTheDocument();
        expect(screen.getByText('오픈 예정')).toBeInTheDocument();
    });

    it('불러오는 중이거나 실패하면 빈 칸 안내를 띄우지 않는다', () => {
        const { rerender } = render(
            <MemoryRouter>
                <TicketEventSection events={[]} isPending />
            </MemoryRouter>,
        );
        expect(screen.queryByText(/겟또타임이 없어요/)).not.toBeInTheDocument();
        rerender(
            <MemoryRouter>
                <TicketEventSection events={[]} isError />
            </MemoryRouter>,
        );
        expect(screen.queryByText(/겟또타임이 없어요/)).not.toBeInTheDocument();
    });
});
