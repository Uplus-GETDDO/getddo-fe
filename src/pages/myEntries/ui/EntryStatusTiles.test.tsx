import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EntryStatusTiles } from './EntryStatusTiles';

const tiles = [
    { value: 'ALL' as const, label: '전체', count: 25, note: '전체 기간' },
    { value: 'WON' as const, label: '당첨', count: 0, note: '아직 당첨이 없어요' },
];

describe('응모 집계 최초 실패', () => {
    it('응모 목록 자체가 실패하면 전체도 0건으로 확정하지 않는다', () => {
        render(
            <EntryStatusTiles
                tiles={tiles.map((tile) => ({ ...tile, count: 0 }))}
                value="ALL"
                onChange={vi.fn()}
                isEntriesError
            />,
        );
        expect(
            within(screen.getByRole('button', { name: /전체/ })).getByText('조회 실패'),
        ).toBeInTheDocument();
        expect(screen.queryByText('0건')).not.toBeInTheDocument();
    });
    it('결과 일부만 실패하면 정확한 전체 응모 수를 보존한다', () => {
        render(<EntryStatusTiles tiles={tiles} value="ALL" onChange={vi.fn()} isUnavailable />);
        expect(
            within(screen.getByRole('button', { name: /전체/ })).getByText('25건'),
        ).toBeInTheDocument();
        expect(screen.getByText('일부 결과 미조회')).toBeInTheDocument();
    });
});
