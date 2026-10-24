import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { VirtualUser } from '../model/types';

import { VirtualUserTable } from './VirtualUserTable';

const USERS: VirtualUser[] = [
    {
        id: '0199abcd-1234-7000-8000-000000000001',
        name: '시연사용자',
        role: 'USER',
        membership: 'vip',
        personaLabel: '데일리 루틴러',
    },
];

describe('VirtualUserTable', () => {
    it('좁은 화면의 표 가로 스크롤 영역은 키보드로 진입할 수 있다', () => {
        render(<VirtualUserTable users={USERS} currentUserId={USERS[0]?.id} />);
        expect(screen.getByRole('region', { name: '가상 사용자 표 가로 스크롤' })).toHaveAttribute(
            'tabindex',
            '0',
        );
    });
});
