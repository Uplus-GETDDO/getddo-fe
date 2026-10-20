import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MyResultCard } from './MyResultCard';

describe('MyResultCard', () => {
    it('공개 전에는 발표 대기 상태를 보여 주고 예정 시각은 표시하지 않는다', () => {
        render(<MyResultCard entered />);

        expect(screen.getByText('응모 마감 · 결과 발표 대기')).toBeInTheDocument();
        expect(screen.getByText('아직 발표 전이에요')).toBeInTheDocument();
        // 카운트다운·예정 시각은 계약에서 제외됐다 (ADR-022)
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('응모한 사람에게는 결과 자리 안내를 보여 준다', () => {
        render(<MyResultCard entered />);
        expect(
            screen.getByText('결과가 공개되면 이 자리에서 바로 확인할 수 있어요.'),
        ).toBeInTheDocument();
    });
});
