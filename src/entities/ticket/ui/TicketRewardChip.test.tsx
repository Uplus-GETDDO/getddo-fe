import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TicketRewardChip } from './TicketRewardChip';

describe('TicketRewardChip', () => {
    it('받기 전에는 보상 바탕에 "응모권 N장"을 적는다', () => {
        render(<TicketRewardChip count={1} />);
        expect(screen.getByText('응모권 1장')).toHaveClass('bg-ticket-primary');
    });

    it('받은 뒤에는 아웃라인에 "받았어요"를 붙인다', () => {
        render(<TicketRewardChip count={2} received />);
        expect(screen.getByText('응모권 2장 받았어요')).toHaveClass('border-border-default');
    });
});
