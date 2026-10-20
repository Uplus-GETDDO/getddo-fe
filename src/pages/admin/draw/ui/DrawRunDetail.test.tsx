import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { server } from '@mocks/server';
import { env } from '@shared/config/env';

import { DrawRunDetail } from './DrawRunDetail';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

// 미공개·확정된 최초 실행 — mocks/handlers/draw.ts의 사전 공개 시나리오 이벤트
const PRE_PUBLICATION_RUN_ID = 'drw-20000000-0000-4000-8000-000000000905-r1';

function renderDetail(drawId: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <DrawRunDetail
                    drawId={drawId}
                    eventCanceled={false}
                    eventReady={true}
                    onRunCreated={() => {}}
                />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

const NOW = '2026-10-20T01:00:00+00:00';

const MANY_EVENT_ID = 'evt-many-runs';

const runListItem = (n: number) => ({
    id: `run-${n}`,
    eventId: MANY_EVENT_ID,
    runNumber: n,
    drawType: n === 1 ? 'INITIAL' : 'REPLACEMENT',
    status: 'CONFIRMED',
    originalDrawId: 'run-1',
    startedAt: NOW,
    confirmedAt: NOW,
    createdAt: NOW,
});

// 취소 원본 결과는 1번(INITIAL) 실행에만 있다 — 목록 2페이지에서 나온다
const CANCELED_RESULT = {
    id: 'res-old-1',
    prizeId: 'prize-1',
    prizeRank: 1,
    slotNumber: 1,
    selectionOrder: 1,
    resultType: 'SELECTED',
    candidateId: 'cand-old',
    userId: 'vu-user-old',
    wasPublished: true,
    isCanceled: true,
};

const runDetail = (n: number, overrides: Record<string, unknown> = {}) => ({
    ...runListItem(n),
    algorithmVersion: null,
    rulesSnapshot: null,
    snapshotFixedAt: NOW,
    results: [],
    execution: {
        failureCount: 0,
        latestFailure: null,
        retryAt: null,
        waitingForOperator: false,
        cancellations: [],
    },
    ...overrides,
});

function setupManyRuns() {
    server.use(
        // AD01 — 101개 실행: 1페이지에 runNumber 101~2, 2페이지에 run 1
        http.get(api(`/v1/admin/events/${MANY_EVENT_ID}/draws`), ({ request }) => {
            const url = new URL(request.url);
            const page = Number(url.searchParams.get('page') ?? '1');
            const size = Number(url.searchParams.get('size') ?? '100');
            const all = Array.from({ length: 101 }, (_, i) => runListItem(101 - i));
            const items = all.slice((page - 1) * size, page * size);
            return HttpResponse.json({
                success: true,
                code: 'SUCCESS',
                message: '성공했습니다.',
                data: { items, page, size, totalElements: all.length },
            });
        }),
        http.get(api('/v1/admin/draws/:drawId'), ({ params }) => {
            const id = String(params.drawId);
            const n = Number(id.replace('run-', ''));
            if (n === 1) {
                return HttpResponse.json({
                    success: true,
                    code: 'SUCCESS',
                    message: '성공했습니다.',
                    data: runDetail(1, { results: [CANCELED_RESULT] }),
                });
            }
            if (n === 101) {
                return HttpResponse.json({
                    success: true,
                    code: 'SUCCESS',
                    message: '성공했습니다.',
                    data: runDetail(101, {
                        results: [
                            {
                                id: 'res-new-1',
                                prizeId: 'prize-1',
                                prizeRank: 1,
                                slotNumber: 1,
                                selectionOrder: 1,
                                resultType: 'SELECTED',
                                candidateId: 'cand-new',
                                userId: 'vu-user-new',
                                wasPublished: false,
                                isCanceled: false,
                            },
                        ],
                        execution: {
                            failureCount: 0,
                            latestFailure: null,
                            retryAt: null,
                            waitingForOperator: false,
                            cancellations: [
                                {
                                    id: 'cnl-1',
                                    resultId: 'res-old-1',
                                    replacementRunId: 'run-101',
                                    canceledBy: 'vu-admin',
                                    reason: '당첨자 정보 오류',
                                    canceledAt: NOW,
                                },
                            ],
                        },
                    }),
                });
            }
            return HttpResponse.json({
                success: true,
                code: 'SUCCESS',
                message: '성공했습니다.',
                data: runDetail(n),
            });
        }),
        http.get(api(`/v1/admin/events/${MANY_EVENT_ID}/result-changes`), () =>
            HttpResponse.json({
                success: true,
                code: 'SUCCESS',
                message: '성공했습니다.',
                data: {
                    items: [
                        {
                            id: 'chg-1',
                            publicationId: 'pub-1',
                            revision: 1,
                            drawRunId: 'run-1',
                            reason: null,
                            confirmedBy: 'vu-admin',
                            // 공개 변경 이력 계약은 오프셋 없는 UTC(Z) 표기만 받는다
                            confirmedAt: '2026-10-20T01:00:00Z',
                            updatedAt: '2026-10-20T01:00:00Z',
                            changes: [],
                            executions: [],
                        },
                    ],
                    page: 1,
                    size: 1,
                    totalElements: 1,
                },
            }),
        ),
    );
}

describe('DrawRunDetail', () => {
    it('공개 이력 조회가 실패하면 최초 발표를 미공개로 오판하지 않고 오류·재시도를 보여준다', async () => {
        server.use(
            http.get(api('/v1/admin/events/:eventId/result-changes'), () =>
                HttpResponse.json(
                    {
                        success: false,
                        code: 'HTTP-500',
                        message: '서버 오류',
                        data: null,
                    },
                    { status: 500 },
                ),
            ),
        );
        renderDetail(PRE_PUBLICATION_RUN_ID);
        expect(
            await screen.findByText(
                '공개 명단 변경 이력을 불러오지 못해 발표 여부를 확인할 수 없습니다.',
            ),
        ).toBeInTheDocument();
        // 실패를 미공개로 보면 발표 버튼이 열리고 이미 공개된 이벤트에 재발표 요청이 나간다
        expect(screen.queryByRole('button', { name: '최초 발표' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    });

    it('실행이 첫 페이지를 넘으면 이전 페이지를 조회해 취소 원본의 공개 이력을 찾는다', async () => {
        setupManyRuns();
        renderDetail('run-101');
        // 취소 원본이 2페이지의 run-1에 있다 — 찾으면 공개 후 취소로 판정하고 반영 버튼이 열린다
        expect(await screen.findByText('최초 발표 후 취소한 당첨입니다.')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: '공개 명단 반영' })).toBeEnabled();
        });
    });
});
