import { afterEach, describe, expect, it, vi } from 'vitest';

const VALID_USERS = JSON.stringify([
    {
        id: '0199abcd-1234-7000-8000-000000000001',
        name: '시연사용자',
        role: 'USER',
        membership: 'vip',
        personaLabel: '데일리 루틴러',
    },
    {
        id: '0199abcd-1234-7000-8000-000000000002',
        name: '관리자',
        role: 'ADMIN',
        membership: 'excellent',
        personaLabel: null,
    },
]);

// env.ts는 모듈 로드 시 값을 읽으므로 stub 후 다시 불러와야 한다
async function loadModule() {
    vi.resetModules();
    return import('./virtualUsers');
}

describe('getVirtualUsers', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('설정된 JSON을 파싱해 계정 목록을 반환한다', async () => {
        vi.stubEnv('VITE_VIRTUAL_USERS_JSON', VALID_USERS);
        const { getVirtualUsers } = await loadModule();

        const users = getVirtualUsers();
        expect(users).toHaveLength(2);
        expect(users[0]?.id).toBe('0199abcd-1234-7000-8000-000000000001');
    });

    it('미설정이면 missing 오류를 던진다 — 샘플 계정으로 대체하지 않는다', async () => {
        vi.stubEnv('VITE_VIRTUAL_USERS_JSON', '');
        const { getVirtualUsers, VirtualUsersConfigError } = await loadModule();

        expect(() => getVirtualUsers()).toThrowError(VirtualUsersConfigError);
        try {
            getVirtualUsers();
        } catch (error) {
            expect(error).toBeInstanceOf(VirtualUsersConfigError);
            expect((error as InstanceType<typeof VirtualUsersConfigError>).reason).toBe('missing');
        }
    });

    it('JSON 해석이 실패하면 invalid 오류를 던진다', async () => {
        vi.stubEnv('VITE_VIRTUAL_USERS_JSON', '{not-json');
        const { getVirtualUsers, VirtualUsersConfigError } = await loadModule();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            getVirtualUsers();
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(VirtualUsersConfigError);
            expect((error as InstanceType<typeof VirtualUsersConfigError>).reason).toBe('invalid');
        }
        consoleSpy.mockRestore();
    });

    it('스키마와 맞지 않는 항목은 invalid 오류를 던진다', async () => {
        vi.stubEnv(
            'VITE_VIRTUAL_USERS_JSON',
            JSON.stringify([{ id: 'x', name: 'n', role: 'GUEST' }]),
        );
        const { getVirtualUsers, VirtualUsersConfigError } = await loadModule();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => getVirtualUsers()).toThrowError(VirtualUsersConfigError);
        consoleSpy.mockRestore();
    });

    it('빈 배열은 invalid 오류를 던진다', async () => {
        vi.stubEnv('VITE_VIRTUAL_USERS_JSON', '[]');
        const { getVirtualUsers } = await loadModule();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => getVirtualUsers()).toThrowError();
        consoleSpy.mockRestore();
    });
});

describe('virtualUserLabel', () => {
    it('페르소나가 없는 USER는 중립 라벨을, ADMIN은 시스템 관리 계정을 보인다', async () => {
        const { virtualUserLabel } = await loadModule();

        expect(virtualUserLabel({ personaLabel: '데일리 루틴러', role: 'USER' })).toBe(
            '데일리 루틴러',
        );
        expect(virtualUserLabel({ personaLabel: null, role: 'USER' })).toBe('시연 계정');
        expect(virtualUserLabel({ personaLabel: null, role: 'ADMIN' })).toBe('시스템 관리 계정');
    });
});
