import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DrawOperationsSection } from './DrawOperationsSection';

const ACTOR_ID = '01a14280-f677-7a0a-a066-5553d7344fd2';

vi.mock('@entities/drawResult', () => ({
    DRAW_AUDIT_ACTION_LABEL: { DRAW_EXECUTE: '추첨 실행', DRAW_RESUME: '추첨 재개' },
    useDrawFailures: () => ({
        data: { items: [], page: 1, size: 10, totalElements: 0 },
        isPending: false,
        isError: false,
        refetch: vi.fn(),
    }),
    useDrawExecutionAudits: () => ({
        data: {
            items: [
                {
                    id: 'aud-1',
                    actorId: ACTOR_ID,
                    actorName: '김관리',
                    action: 'DRAW_EXECUTE',
                    reason: null,
                    beforeData: 'status:PREPARING',
                    afterData: 'attemptId:att-drw-1-1',
                    requestId: 'req-1',
                    createdAt: '2026-10-16T07:50:46Z',
                },
                {
                    id: 'aud-2',
                    actorId: null,
                    actorName: null,
                    action: 'DRAW_RESUME',
                    reason: '운영자가 재개했습니다',
                    beforeData: 'status:FAILED',
                    afterData: 'attemptId:att-drw-1-2',
                    requestId: null,
                    createdAt: '2026-10-16T08:10:00Z',
                },
            ],
            page: 1,
            size: 10,
            totalElements: 2,
        },
        isPending: false,
        isError: false,
        refetch: vi.fn(),
    }),
}));

// GD-314 실행 감사 표시 계약 — action은 표시 문자열, 처리자 UUID와 beforeData/afterData는 숨긴다
describe('실행 감사 표시', () => {
    it('실행 감사 표의 가로 스크롤 영역을 키보드로 탐색할 수 있다', () => {
        render(<DrawOperationsSection drawId="drw-1" />);
        expect(screen.getByRole('region', { name: '실행 감사 표 가로 스크롤' })).toHaveAttribute(
            'tabindex',
            '0',
        );
    });

    it('action 코드 대신 확정 표시 문자열을 보여준다', () => {
        render(<DrawOperationsSection drawId="drw-1" />);
        expect(screen.getByText('추첨 실행')).toBeInTheDocument();
        expect(screen.getByText('추첨 재개')).toBeInTheDocument();
        expect(screen.queryByText('DRAW_EXECUTE')).not.toBeInTheDocument();
        expect(screen.queryByText('DRAW_RESUME')).not.toBeInTheDocument();
    });

    it('처리자는 이름만 보여주고 UUID는 숨긴다 — 이름이 없는 시스템 처리는 —다', () => {
        render(<DrawOperationsSection drawId="drw-1" />);
        expect(screen.getByText('김관리')).toBeInTheDocument();
        expect(screen.queryByText(ACTOR_ID)).not.toBeInTheDocument();
        // actorName=null 행의 처리자 칸과 reason=null 행의 사유 칸이 —로 둘 다 있다
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    });

    it('사유는 실제 reason만 보여주고 beforeData/afterData 원문은 숨긴다', () => {
        render(<DrawOperationsSection drawId="drw-1" />);
        expect(screen.getByText('운영자가 재개했습니다')).toBeInTheDocument();
        expect(screen.queryByText(/status:PREPARING/)).not.toBeInTheDocument();
        expect(screen.queryByText(/status:FAILED/)).not.toBeInTheDocument();
        expect(screen.queryByText(/attemptId/)).not.toBeInTheDocument();
    });
});
