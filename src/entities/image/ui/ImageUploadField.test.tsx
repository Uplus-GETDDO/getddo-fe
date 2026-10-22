import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@mocks/server';

import type { ImageSlot } from '../model/upload';

import { ImageUploadField } from './ImageUploadField';

function Harness({
    onChange,
    slot = 'EVENT',
}: {
    onChange?: (key: string) => void;
    slot?: ImageSlot;
}) {
    const [value, setValue] = useState('');
    return (
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
        >
            <ImageUploadField
                label="대표 이미지"
                slot={slot}
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

describe('ImageUploadField', () => {
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
                        code: 'EVENT-018',
                        message: '5MB 이하의 JPG·PNG 이미지 파일이 필요합니다.',
                        data: null,
                    },
                    { status: 400 },
                ),
            ),
        );
        render(<Harness />);

        await userEvent.upload(screen.getByLabelText('대표 이미지'), png());

        expect(await screen.findByRole('alert')).toHaveTextContent(
            '5MB 이하의 JPG·PNG 이미지 파일이 필요합니다.',
        );
    });

    /*
     * 배너 자리는 홈 첫 화면을 꽉 채워 작은 그림이 바로 티가 난다 — 아예 올리지 않는다.
     * 쓰지도 못할 그림을 서버에 남기지 않으려는 뜻이기도 하다.
     */
    it('배너 자리는 작은 그림을 보내지 않고 막는다', async () => {
        const sent = vi.fn();
        server.use(http.post('*/v1/admin/events/images', () => (sent(), HttpResponse.json({}))));
        const onChange = vi.fn();
        vi.stubGlobal('createImageBitmap', () =>
            Promise.resolve({ width: 900, height: 900, close() {} }),
        );

        render(<Harness slot="BANNER" onChange={onChange} />);
        await userEvent.upload(screen.getByLabelText('대표 이미지'), png());

        expect(await screen.findByRole('alert')).toHaveTextContent('2400×730 이상만');
        expect(sent).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    /*
     * 이벤트 그림은 16:9 칸과 1:1 칸에 같이 들어가 가장자리가 잘린다.
     * 어디까지 살아남는지 점선으로 보여 주되, 잘릴 일이 없는 자리에는 그리지 않는다.
     */
    it('비율이 엇갈리는 자리에만 안전 영역을 표시한다', async () => {
        const { unmount } = render(<Harness slot="EVENT" />);
        await userEvent.upload(screen.getByLabelText('대표 이미지'), png());
        await waitFor(() => expect(screen.getByText(/밝은 부분은/)).toBeInTheDocument());
        unmount();

        render(<Harness slot="PRIZE" />);
        await userEvent.upload(screen.getByLabelText('대표 이미지'), png());
        await waitFor(() => expect(screen.getByText(/prizes\//)).toBeInTheDocument());
        expect(screen.queryByText(/밝은 부분은/)).toBeNull();
    });
});
