import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as UserModule from '@entities/user';

import { useSessionStore } from '@entities/user';

import { VirtualUserSwitcher } from './VirtualUserSwitcher';

const users = [
    {
        id: 'first',
        name: '아주긴사용자이름ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        role: 'USER' as const,
        membership: 'excellent' as const,
        personaLabel: '데일리 루틴러',
    },
    {
        id: 'second',
        name: '전환할 사용자',
        role: 'USER' as const,
        membership: 'vip' as const,
        personaLabel: null,
    },
] as const;

vi.mock('@entities/user', async (importOriginal) => ({
    ...(await importOriginal<typeof UserModule>()),
    useVirtualUsers: () => ({ data: users, isPending: false, isError: false }),
}));

describe('가상 사용자 전환', () => {
    beforeEach(() => useSessionStore.getState().selectUser(users[0]));
    afterEach(() => {
        cleanup();
        useSessionStore.getState().signOut();
    });

    it('축약된 트리거도 전체 사용자명을 접근성 이름으로 제공한다', () => {
        render(<VirtualUserSwitcher trigger={<button type="button">프로필</button>} />);
        expect(
            screen.getByRole('button', { name: `가상 사용자 전환, 현재 사용자 ${users[0].name}` }),
        ).toBeInTheDocument();
    });

    it('키보드로 열고 Escape로 닫으면 트리거로 포커스가 돌아온다', async () => {
        const keyboard = userEvent.setup();
        render(<VirtualUserSwitcher />);
        const trigger = screen.getByRole('button', { name: /가상 사용자 전환/ });
        trigger.focus();
        await keyboard.keyboard('{Enter}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await keyboard.keyboard('{Escape}');
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('다른 사용자를 선택하면 닫히고 새 이름을 가진 트리거로 포커스가 돌아온다', async () => {
        const keyboard = userEvent.setup();
        render(<VirtualUserSwitcher />);
        const trigger = screen.getByRole('button', { name: /가상 사용자 전환/ });
        trigger.focus();
        await keyboard.keyboard(' ');
        const next = screen.getByRole('button', { name: /전환할 사용자/ });
        next.focus();
        await keyboard.keyboard('{Enter}');
        await waitFor(() => expect(trigger).toHaveFocus());
        expect(useSessionStore.getState().user?.id).toBe('second');
        expect(trigger).toHaveAccessibleName(`가상 사용자 전환, 현재 사용자 ${users[1].name}`);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
