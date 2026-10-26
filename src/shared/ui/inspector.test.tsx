import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InspectorBody, InspectorHeader, InspectorPanel, InspectorTitle } from './inspector';

function Panel({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
    return (
        <InspectorPanel open onOpenChange={onOpenChange}>
            <InspectorBody>
                <InspectorHeader>
                    <InspectorTitle>사용자 상세</InspectorTitle>
                </InspectorHeader>
            </InspectorBody>
        </InspectorPanel>
    );
}

describe('InspectorPanel', () => {
    it('열리면 칸에 포커스를 두고 Esc로 닫는다', async () => {
        const onOpenChange = vi.fn();
        render(<Panel onOpenChange={onOpenChange} />);
        const panel = screen.getByRole('dialog', { name: '사용자 상세' });
        expect(panel).toHaveFocus();
        await userEvent.keyboard('{Escape}');
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('머리의 닫기 버튼으로 닫는다', async () => {
        const onOpenChange = vi.fn();
        render(<Panel onOpenChange={onOpenChange} />);
        await userEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
