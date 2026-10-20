import type { Membership } from '@entities/user';

/*
 * 관리자 목업이 함께 쓰는 생성 사용자 — 사용자 조회(AO01)와 응모권 지급 추이가 같은 사람을 보게 한다.
 * 대시보드 참여율이 의미 있는 크기로 나오도록 시연용 가상 사용자 외에 고정 규칙으로 만든다
 */
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const GIVEN_NAMES = [
    '민서',
    '지호',
    '서윤',
    '도현',
    '하은',
    '예준',
    '수아',
    '시우',
    '지아',
    '준서',
];
const MEMBERSHIPS: Membership[] = ['excellent', 'vip', 'vvip'];
const COUNT = 240;

export interface MockGeneratedUser {
    id: string;
    name: string;
    membership: Membership;
    /** 열 명 중 한 명은 비활성 — 활성 일반 사용자 수가 전체 수와 달라지게 한다 */
    active: boolean;
}

export const MOCK_GENERATED_USERS: readonly MockGeneratedUser[] = Array.from(
    { length: COUNT },
    (_, index) => ({
        id: `mu-${String(index + 1).padStart(4, '0')}`,
        name: `${SURNAMES[index % SURNAMES.length]}${GIVEN_NAMES[Math.floor(index / SURNAMES.length) % GIVEN_NAMES.length]}`,
        membership: MEMBERSHIPS[index % MEMBERSHIPS.length] ?? 'excellent',
        active: index % 10 !== 9,
    }),
);
