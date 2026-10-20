import { z } from 'zod';

import { env } from '@shared/config/env';

import type { VirtualUser } from './types';

import { virtualUserSchema } from './types';

// 시연 계정 설정 오류 — 미설정(missing)과 형식 오류(invalid)를 구분해 안내한다
export class VirtualUsersConfigError extends Error {
    readonly reason: 'missing' | 'invalid';

    constructor(reason: 'missing' | 'invalid', detail?: unknown) {
        super(
            reason === 'missing'
                ? 'VITE_VIRTUAL_USERS_JSON이 설정되지 않았습니다.'
                : 'VITE_VIRTUAL_USERS_JSON의 형식이 올바르지 않습니다.',
        );
        this.name = 'VirtualUsersConfigError';
        this.reason = reason;
        if (reason === 'invalid') {
            console.error('시연 계정 설정(VITE_VIRTUAL_USERS_JSON) 해석 실패:', detail);
        }
    }
}

// 시연 계정 목록은 서버 API가 아니라 배포 설정이 공급한다 — 미설정이나 잘못된 값을
// 샘플 계정으로 조용히 대체하지 않는다. id는 실서버 DB에 등록된 UUID여야 한다
export function getVirtualUsers(): VirtualUser[] {
    const raw = env.virtualUsersJson;
    if (!raw) throw new VirtualUsersConfigError('missing');
    try {
        return z.array(virtualUserSchema).min(1).parse(JSON.parse(raw));
    } catch (error) {
        throw new VirtualUsersConfigError('invalid', error);
    }
}
