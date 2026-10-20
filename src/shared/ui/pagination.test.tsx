import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './pagination';

describe('Pagination 쪽 번호 입력', () => {
    it('jump를 켜면 입력한 쪽으로 이동하고 범위를 넘으면 마지막 쪽으로 맞춘다', async () => {
        const user = userEvent.setup();
        const onPageChange = vi.fn();
        render(<Pagination page={1} totalPages={40} onPageChange={onPageChange} jump />);
        const input = screen.getByRole('textbox', { name: '이동할 페이지 (1~40)' });
        await user.type(input, '12');
        await user.click(screen.getByRole('button', { name: '이동' }));
        expect(onPageChange).toHaveBeenLastCalledWith(12);
        await user.clear(input);
        await user.type(input, '999{Enter}');
        expect(onPageChange).toHaveBeenLastCalledWith(40);
    });

    it('숫자가 아닌 글자는 받지 않고, jump를 끄면 입력칸이 없다', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <Pagination page={2} totalPages={5} onPageChange={() => {}} jump />,
        );
        const input = screen.getByRole('textbox', { name: '이동할 페이지 (1~5)' });
        await user.type(input, '3a');
        expect(input).toHaveValue('3');
        rerender(<Pagination page={2} totalPages={5} onPageChange={() => {}} />);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
});
