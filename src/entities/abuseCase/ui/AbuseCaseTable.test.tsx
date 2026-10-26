import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AbuseCase } from '../model/types';

import { AbuseCaseTable } from './AbuseCaseTable';

const CASE: AbuseCase = {
    id: '30100000-0000-4000-8000-000000000001',
    userId: '01a143a8-b6de-7432-8644-5a4d52c94241',
    userNickname: '테스트사용자10',
    eventId: null,
    eventTitle: null,
    sourceType: 'ENTRY',
    detectionType: 'REPEATED_RATE_LIMIT_EXCEEDED',
    detectionReason: '응모 요청 한도 초과가 반복되어 일시 차단되었습니다.',
    blockedAt: '2026-10-21T12:10:38.084714Z',
    blockedUntil: '2026-10-21T12:20:38.084714Z',
};

describe('AbuseCaseTable', () => {
    it('좁은 화면의 표 가로 스크롤 영역은 키보드로 진입할 수 있다', () => {
        render(<AbuseCaseTable cases={[CASE]} />);
        expect(screen.getByRole('region', { name: '차단 내역 표 가로 스크롤' })).toHaveAttribute(
            'tabindex',
            '0',
        );
    });

    it('차단 이력을 행으로 표시하고 관련 이벤트가 없으면 -를 둔다', () => {
        render(<AbuseCaseTable cases={[CASE]} />);
        expect(screen.getByText('이벤트 응모')).toBeInTheDocument();
        expect(screen.getByText('테스트사용자10')).toBeInTheDocument();
        expect(screen.getByText(CASE.detectionReason)).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
    });
});
