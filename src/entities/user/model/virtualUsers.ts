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

// 페르소나가 없는 계정의 보조 라벨 — '시스템 관리 계정'은 관리자 전용 문구라
// 라벨이 비어 있는 USER 계정에 붙으면 관리자로 오인된다
export function virtualUserLabel(user: Pick<VirtualUser, 'personaLabel' | 'role'>): string {
    const personaLabel = user.personaLabel?.trim();
    return personaLabel || (user.role === 'ADMIN' ? '시스템 관리 계정' : '시연 계정');
}
