import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DateRangeFilter } from './filter-fields';

describe('DateRangeFilter', () => {
    it('좁은 화면에서 상자 안쪽으로 줄바꿈하도록 flex-wrap을 둔다', () => {
        const { container } = render(
            <DateRangeFilter
                from=""
                to=""
                onFromChange={() => {}}
                onToChange={() => {}}
                basis="차단 시작일"
            />,
        );
        // 상자가 고정 폭으로 페이지를 밀어내지 않고 내부가 줄바꿈하는지는
        // flex-wrap 클래스로 단정한다 (jsdom은 실제 레이아웃을 재지 않는다)
        expect(container.querySelector('.flex-wrap')).toBeInTheDocument();
    });

    it('기준 라벨과 두 날짜 입력을 함께 표시한다', () => {
        render(
            <DateRangeFilter
                from="2026-10-01"
                to="2026-10-23"
                onFromChange={() => {}}
                onToChange={() => {}}
                basis="차단 시작일"
            />,
        );
        expect(screen.getByText('차단 시작일')).toBeInTheDocument();
        expect(screen.getByLabelText('차단 시작일 시작일')).toHaveValue('2026-10-01');
        expect(screen.getByLabelText('차단 시작일 종료일')).toHaveValue('2026-10-23');
    });
});
