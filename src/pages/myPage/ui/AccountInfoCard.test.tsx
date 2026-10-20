import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AccountInfoCard } from './AccountInfoCard';

const user = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    name: '테스트 사용자',
    role: 'USER' as const,
    membership: 'vip' as const,
    personaLabel: '20대 직장인',
};

describe('계정 정보 카드', () => {
    it('사용자 ID는 가려 두고 보기를 눌러야 전체가 보인다', () => {
        render(<AccountInfoCard user={user} />);
        expect(screen.queryByText(user.id)).not.toBeInTheDocument();
        expect(screen.getByText('a1b2••••6789')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '보기' }));
        expect(screen.getByText(user.id)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '숨기기' }));
        expect(screen.queryByText(user.id)).not.toBeInTheDocument();
    });

    it('멤버십 등급 순서 안에 내 등급을 표시한다', () => {
        render(<AccountInfoCard user={user} />);
        const tiers = screen.getByRole('list', { name: '멤버십 등급 순서' });
        expect(tiers).toHaveTextContent('우수');
        expect(tiers).toHaveTextContent('VIP (내 등급)');
        expect(tiers).toHaveTextContent('VVIP');
    });
});
