import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AdminEventFormPage } from './AdminEventFormPage';

// 이미지는 파일 선택으로 바뀌어 name을 들고 있지 않다 — 라벨 연결만 따로 본다 (GD-253)
const PRIZE_FIELDS = [
    ['등수', 'rank'],
    ['경품명', 'name'],
    ['당첨 인원', 'winnerCount'],
    ['설명 (선택)', 'description'],
] as const;

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/events/new']}>
                <AdminEventFormPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

function getPrizeSection() {
    return within(
        screen.getByRole('heading', { name: /^경품 \(/ }).closest('section') as HTMLElement,
    );
}

describe('AdminEventFormPage', () => {
    it('초기 경품의 라벨 5종이 각각 해당 입력과 연결된다', () => {
        renderPage();
        const prizes = getPrizeSection();

        for (const [label, field] of PRIZE_FIELDS) {
            const input = prizes.getByLabelText(label);
            expect(input.tagName).toBe('INPUT');
            expect(input).toHaveAttribute('name', `prizes.0.${field}`);
        }
    });

    it('경품 이미지 라벨이 파일 선택 입력과 연결된다', () => {
        renderPage();
        const input = getPrizeSection().getByLabelText('경품 이미지 (선택)');
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('type', 'file');
        expect(input).toHaveAttribute('accept', 'image/png,image/jpeg');
    });

    it('경품을 추가하면 이미지 라벨도 서로 다른 입력을 가리킨다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(screen.getByRole('button', { name: '경품 추가' }));

        const images = getPrizeSection().getAllByLabelText('경품 이미지 (선택)');
        expect(images).toHaveLength(2);
        expect(images[0]!.id).not.toBe(images[1]!.id);
    });

    it('경품을 추가하면 경품명 라벨들이 서로 다른 id의 입력을 가리킨다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(screen.getByRole('button', { name: '경품 추가' }));

        const inputs = getPrizeSection().getAllByLabelText('경품명');
        expect(inputs).toHaveLength(2);
        expect(inputs[0]).toHaveAttribute('name', 'prizes.0.name');
        expect(inputs[1]).toHaveAttribute('name', 'prizes.1.name');
        expect(inputs[0]!.id).not.toBe('');
        expect(inputs[1]!.id).not.toBe('');
        expect(inputs[0]!.id).not.toBe(inputs[1]!.id);
    });

    it('첫 경품을 제거해도 남은 경품의 라벨 연결과 id가 유지된다', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(screen.getByRole('button', { name: '경품 추가' }));
        const prizes = getPrizeSection();
        const remainingIds = PRIZE_FIELDS.map(([label]) => prizes.getAllByLabelText(label)[1]!.id);
        await user.type(prizes.getAllByLabelText('경품명')[1]!, '남은 경품');
        await user.click(prizes.getAllByRole('button', { name: '제거' })[0]!);

        expect(prizes.getAllByLabelText('경품명')).toHaveLength(1);
        PRIZE_FIELDS.forEach(([label, field], index) => {
            const input = prizes.getByLabelText(label);
            expect(input.tagName).toBe('INPUT');
            expect(input).toHaveAttribute('name', `prizes.0.${field}`);
            expect(input).toHaveAttribute('id', remainingIds[index]);
        });
        expect(prizes.getByLabelText('경품명')).toHaveValue('남은 경품');
    });
});
