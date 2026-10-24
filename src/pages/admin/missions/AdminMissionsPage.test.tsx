import type { AxiosRequestConfig } from 'axios';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';

import { AdminMissionsPage } from './AdminMissionsPage';

afterEach(() => vi.restoreAllMocks());
describe('관리자 미션', () => {
    it('빈 목록과 등록 폼의 즉시 활성·1장 정책을 표시한다', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue({
            data: { success: true, data: { items: [], page: 1, size: 20, totalElements: 0 } },
        });
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AdminMissionsPage />
            </QueryClientProvider>,
        );
        expect(await screen.findByText('등록된 미션이 없습니다.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '미션 등록' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/등록 즉시 ACTIVE/)).toBeInTheDocument();
        expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
    });
    it('상세를 열면 모달이 열리고 기본 기간으로 자동 집계한다', async () => {
        const summary = {
            id: 'm-1',
            title: '설문 미션',
            description: '',
            missionType: 'SURVEY',
            startsAt: '2026-10-01T00:00:00+09:00',
            endsAt: '2026-11-15T00:00:00+09:00',
            rewardTicketCount: 1,
            status: 'ACTIVE',
            rewardPolicyId: 'rp-1',
            createdBy: 'admin',
            createdByName: '박운영',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
        };
        vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
            if (url === '/v1/admin/missions') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: { items: [summary], page: 1, size: 20, totalElements: 1 },
                    },
                });
            }
            if (url === '/v1/admin/missions/m-1') {
                return Promise.resolve({
                    data: { success: true, data: { ...summary, questions: [] } },
                });
            }
            if (url === '/v1/admin/missions/m-1/survey-summary') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            dailyResponses: [{ date: '2026-10-05', count: 2 }],
                            questions: [],
                        },
                    },
                });
            }
            return Promise.reject(new Error(`unexpected ${url}`));
        });
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AdminMissionsPage />
            </QueryClientProvider>,
        );
        // ADR-028 — 목록의 작성자는 ID 대신 현재 이름으로 보인다
        expect(await screen.findByRole('cell', { name: '박운영' })).toBeInTheDocument();
        // 상태·유형은 영어 원문 대신 한글 라벨로 표시한다
        expect(screen.getByRole('cell', { name: /진행 중/ })).toBeInTheDocument();
        expect(screen.getByText('설문')).toBeInTheDocument();
        expect(screen.queryByText(/SURVEY/)).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /상태/ }));
        expect(screen.getByRole('radio', { name: '진행 중' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: '종료' })).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        await userEvent.click(await screen.findByRole('button', { name: '설문 미션 상세' }));
        const dialog = await screen.findByRole('dialog');
        // 다이얼로그는 마운트 즉시 뜨고 상세는 useAdminMission 응답 뒤에 온다 — 첫 의존 요소는 findBy로 기다린다
        expect(
            await within(dialog).findByRole('heading', { name: '설문 미션' }),
        ).toBeInTheDocument();
        expect(within(dialog).getByText('진행 중')).toBeInTheDocument();
        expect(within(dialog).getByText('응모권 1장')).toBeInTheDocument();
        expect(within(dialog).getByText('박운영')).toBeInTheDocument();
        // 기본 기간은 미션 시작~종료 — 31일을 넘으면 시작일부터 31일로 자르고 안내한다
        expect(within(dialog).getByLabelText('집계 시작일')).toHaveValue('2026-10-01');
        expect(within(dialog).getByLabelText('집계 종료일')).toHaveValue('2026-10-31');
        expect(within(dialog).getByText(/31일만 잘랐습니다/)).toBeInTheDocument();
        // 모달 오픈과 함께 기본 기간으로 자동 집계한다 — '집계 조회'를 누르지 않아도 결과가 보인다
        const daily = await within(dialog).findByRole('list', { name: '날짜별 완료 응답' });
        expect(within(daily).getByText('10.05')).toBeInTheDocument();
        expect(within(daily).getAllByText('2건').length).toBeGreaterThan(0);
    });
    it('집계 기간으로 자유 서술 답변을 조회해 텍스트로만 표시한다', async () => {
        const summary = {
            id: 'm-1',
            title: '설문 미션',
            description: '',
            missionType: 'SURVEY',
            startsAt: '2026-10-01T00:00:00+09:00',
            endsAt: '2026-10-20T00:00:00+09:00',
            rewardTicketCount: 1,
            status: 'ACTIVE',
            rewardPolicyId: 'rp-1',
            createdBy: 'admin',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
        };
        const get = vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
            if (url === '/v1/admin/missions') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: { items: [summary], page: 1, size: 20, totalElements: 1 },
                    },
                });
            }
            if (url === '/v1/admin/missions/m-1') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            ...summary,
                            questions: [
                                {
                                    id: 'q1',
                                    questionType: 'FREE_TEXT',
                                    questionText: '자유 의견',
                                    displayOrder: 1,
                                    required: false,
                                },
                            ],
                        },
                    },
                });
            }
            if (url === '/v1/admin/missions/m-1/survey-summary') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            dailyResponses: [{ date: '2026-10-10', count: 1 }],
                            questions: [],
                        },
                    },
                });
            }
            if (url === '/v1/admin/missions/m-1/survey-answers') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            items: [
                                {
                                    answerText: '<b>굵게</b> 좋아요',
                                    submittedAt: '2026-10-10T05:00:00Z',
                                },
                            ],
                            page: 1,
                            size: 20,
                            totalElements: 1,
                        },
                    },
                });
            }
            return Promise.reject(new Error(`unexpected ${url}`));
        });
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AdminMissionsPage />
            </QueryClientProvider>,
        );
        await userEvent.click(await screen.findByRole('button', { name: '설문 미션 상세' }));
        // 답변 원문은 HTML로 해석하지 않고 텍스트로만 보인다 (AM05 계약)
        expect(await screen.findByText('<b>굵게</b> 좋아요')).toBeInTheDocument();
        const answersCall = get.mock.calls.find(([url]) => url.includes('survey-answers'));
        // 모달 오픈 시 미션 기간으로 자동 조회한다
        expect(answersCall?.[1]?.params).toMatchObject({
            questionId: 'q1',
            page: 1,
            from: '2026-10-01',
            to: '2026-10-20',
        });
    });
    it('집계 기간을 바꾸면 서술 답변 페이지를 1로 되돌린다', async () => {
        const summary = {
            id: 'm-1',
            title: '설문 미션',
            description: '',
            missionType: 'SURVEY',
            startsAt: '2026-10-01T00:00:00+09:00',
            endsAt: '2026-10-20T00:00:00+09:00',
            rewardTicketCount: 1,
            status: 'ACTIVE',
            rewardPolicyId: 'rp-1',
            createdBy: 'admin',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
        };
        const get = vi
            .spyOn(apiClient, 'get')
            .mockImplementation((url: string, config?: AxiosRequestConfig) => {
                if (url === '/v1/admin/missions') {
                    return Promise.resolve({
                        data: {
                            success: true,
                            data: { items: [summary], page: 1, size: 20, totalElements: 1 },
                        },
                    });
                }
                if (url === '/v1/admin/missions/m-1') {
                    return Promise.resolve({
                        data: {
                            success: true,
                            data: {
                                ...summary,
                                questions: [
                                    {
                                        id: 'q1',
                                        questionType: 'FREE_TEXT',
                                        questionText: '자유 의견',
                                        displayOrder: 1,
                                        required: false,
                                    },
                                ],
                            },
                        },
                    });
                }
                if (url === '/v1/admin/missions/m-1/survey-summary') {
                    return Promise.resolve({
                        data: {
                            success: true,
                            data: { dailyResponses: [], questions: [] },
                        },
                    });
                }
                if (url === '/v1/admin/missions/m-1/survey-answers') {
                    const params = config?.params as { page?: number } | undefined;
                    const page = Number(params?.page ?? 1);
                    return Promise.resolve({
                        data: {
                            success: true,
                            data: {
                                items: [
                                    {
                                        answerText: `답변 ${page}페이지`,
                                        submittedAt: '2026-10-10T05:00:00Z',
                                    },
                                ],
                                page,
                                size: 20,
                                totalElements: 21,
                            },
                        },
                    });
                }
                return Promise.reject(new Error(`unexpected ${url}`));
            });
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AdminMissionsPage />
            </QueryClientProvider>,
        );
        await userEvent.click(await screen.findByRole('button', { name: '설문 미션 상세' }));
        await screen.findByText('답변 1페이지');
        // 미션 목록 페이저의 비활성 버튼과 구분해 서술 답변 페이저를 누른다
        const nextButtons = screen.getAllByRole('button', { name: '다음 페이지' });
        await userEvent.click(nextButtons.find((b) => !b.hasAttribute('disabled'))!);
        await screen.findByText('답변 2페이지');
        expect(
            get.mock.calls.filter(([url]) => url.includes('survey-answers')).at(-1)?.[1]?.params,
        ).toMatchObject({ page: 2 });
        // 기간을 바꿔 다시 조회하면 새 기간의 첫 페이지부터 요청한다
        await userEvent.clear(screen.getByLabelText('집계 종료일'));
        await userEvent.type(screen.getByLabelText('집계 종료일'), '2026-10-15');
        await userEvent.click(screen.getByRole('button', { name: '집계 조회' }));
        await screen.findByText('답변 1페이지');
        expect(
            get.mock.calls.filter(([url]) => url.includes('survey-answers')).at(-1)?.[1]?.params,
        ).toMatchObject({ questionId: 'q1', page: 1, to: '2026-10-15' });
    });
    it('ESC로 상세 모달을 닫는다', async () => {
        const summary = {
            id: 'm-1',
            title: '퀴즈 미션',
            description: '',
            missionType: 'QUIZ',
            startsAt: '2026-10-01T00:00:00+09:00',
            endsAt: '2026-10-20T00:00:00+09:00',
            rewardTicketCount: 1,
            status: 'ENDED',
            rewardPolicyId: 'rp-1',
            createdBy: 'admin',
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z',
        };
        vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
            if (url === '/v1/admin/missions') {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: { items: [summary], page: 1, size: 20, totalElements: 1 },
                    },
                });
            }
            if (url === '/v1/admin/missions/m-1') {
                return Promise.resolve({
                    data: { success: true, data: { ...summary, questions: [] } },
                });
            }
            return Promise.reject(new Error(`unexpected ${url}`));
        });
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AdminMissionsPage />
            </QueryClientProvider>,
        );
        await userEvent.click(await screen.findByRole('button', { name: '퀴즈 미션 상세' }));
        const dialog = await screen.findByRole('dialog');
        // 종료된 미션은 '종료' 라벨로 표시된다 — 상세 응답 대기를 위해 findBy로 확인한다
        expect(await within(dialog).findByText('응모권 1장')).toBeInTheDocument();
        expect(within(dialog).getByText('종료')).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // 트리거 없이 열린 모달은 Radix 복귀 대상이 없으므로 상세 버튼으로 포커스를 돌려준다
        await vi.waitFor(() =>
            expect(screen.getByRole('button', { name: '퀴즈 미션 상세' })).toHaveFocus(),
        );
    });
});
