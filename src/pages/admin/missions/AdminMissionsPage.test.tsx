import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
    it('상세를 열면 패널로 스크롤하고 설문 집계 기본 기간을 미션 기간으로 채운다', async () => {
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;
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
        await userEvent.click(await screen.findByRole('button', { name: '설문 미션 상세' }));
        expect(await screen.findByRole('heading', { name: '설문 미션' })).toBeInTheDocument();
        expect(scrollSpy).toHaveBeenCalled();
        // 기본 기간은 미션 시작~종료 — 31일을 넘으면 시작일부터 31일로 자르고 안내한다
        expect(screen.getByLabelText('집계 시작일')).toHaveValue('2026-10-01');
        expect(screen.getByLabelText('집계 종료일')).toHaveValue('2026-10-31');
        expect(screen.getByText(/31일만 잘랐습니다/)).toBeInTheDocument();
    });
    it('집계 기간으로 자유 서술 답변을 조회해 텍스트로만 표시한다', async () => {
        Element.prototype.scrollIntoView = vi.fn();
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
        await userEvent.click(await screen.findByRole('button', { name: '집계 조회' }));
        // 답변 원문은 HTML로 해석하지 않고 텍스트로만 보인다 (AM05 계약)
        expect(await screen.findByText('<b>굵게</b> 좋아요')).toBeInTheDocument();
        const answersCall = get.mock.calls.find(([url]) => url.includes('survey-answers'));
        expect(answersCall?.[1]?.params).toMatchObject({ questionId: 'q1', page: 1 });
    });
});
