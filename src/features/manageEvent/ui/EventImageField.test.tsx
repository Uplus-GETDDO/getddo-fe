import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@mocks/server';

import { EventImageField } from './EventImageField';

function Harness({ onChange }: { onChange?: (key: string) => void }) {
    const [value, setValue] = useState('');
    return (
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
        >
            <EventImageField
                label="대표 이미지"
                target="EVENT"
                value={value}
                onChange={(key) => {
                    setValue(key);
                    onChange?.(key);
                }}
            />
        </QueryClientProvider>
    );
}

const png = (size = 10) => new File([new Uint8Array(size)], 'a.png', { type: 'image/png' });

describe('EventImageField', () => {
    it('올린 뒤 받은 키를 폼 값으로 넘긴다 — 사람이 키를 알 수 없다', async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);

        await userEvent.upload(screen.getByLabelText('대표 이미지'), png());

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange.mock.calls[0]![0]).toMatch(/^events\/.+\.png$/);
    });

    it('PNG·JPG가 아니면 보내지 않고 바로 알린다', async () => {
        const onChange = vi.fn();
        const sent = vi.fn();
        server.use(http.post('*/v1/admin/events/images', () => (sent(), HttpResponse.json({}))));
        render(<Harness onChange={onChange} />);

        // 브라우저는 accept에 안 맞는 파일도 끌어다 놓으면 그대로 전달한다 — 그 경우를 흉내 낸다
        await userEvent.upload(
            screen.getByLabelText('대표 이미지'),
            new File(['x'], 'a.gif', { type: 'image/gif' }),
            { applyAccept: false },
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('PNG 또는 JPG');
        expect(sent).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('서버가 거절하면 그 문구를 보여 준다 — 최종 판정은 서버다', async () => {
        server.use(
            http.post('*/v1/admin/events/images', () =>
                HttpResponse.json(
                    {
                        success: false,
                        code: 'EVENT-009',
                        message: '손상된 이미지입니다',
                        data: null,
                    },
                    { status: 400 },
                ),
            ),
        );
        render(<Harness />);

        await userEvent.upload(screen.getByLabelText('대표 이미지'), png());

        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
});
