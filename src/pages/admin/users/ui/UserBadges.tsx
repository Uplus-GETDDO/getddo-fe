import type { Membership, UserStatus as UserStatusValue } from '@entities/user';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { StatusDot } from '@shared/ui/status-dot';

import { USER_STATUS_LABEL } from '../model/labels';

export function MembershipBadge({ membership }: { membership: Membership | null }) {
    if (!membership) return <span className="text-body-sm text-fg-tertiary">미설정</span>;
    // 등급마다 색을 달리하면 오히려 표가 얼룩져 읽기 어려웠다 — 같은 테두리 배지에 글자만 바꾼다
    return <Badge variant="outline">{MEMBERSHIP_LABEL[membership]}</Badge>;
}

/** 활성은 브랜드 점, 비활성은 흐린 점 — 글자만 있으면 두 상태가 같은 무게로 보였다 */
export function UserStatus({ status }: { status: UserStatusValue }) {
    return (
        <StatusDot tone={status === 'ACTIVE' ? 'brand' : 'muted'}>
            {USER_STATUS_LABEL[status]}
        </StatusDot>
    );
}
