import { Link } from 'react-router-dom';

import type { AdminUser } from '@entities/user';

import { getErrorMessage } from '@shared/api/errorMessage';
import { useReturnState } from '@shared/model/returnTo';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { DetailItem, DetailList, DetailSection, DetailSummary } from '@shared/ui/detail-list';
import {
    InspectorBody,
    InspectorDescription,
    InspectorHeader,
    InspectorPanel,
    InspectorTitle,
} from '@shared/ui/inspector';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKstFullDot } from '@shared/utils/date';

import { USER_ROLE_LABEL } from '../model/labels';
import { MembershipBadge, UserStatus } from './UserBadges';

// AO02 상세(목록 옆 칸) — 조회 전용. 연락처·정지/해제·역할 변경 등 스펙에 없는 수정 동작은 두지 않는다
export function AdminUserDetailSheet({
    userId,
    user,
    isPending,
    error,
    onClose,
    returnLabel = '사용자 조회',
}: {
    userId: string | null;
    user: AdminUser | undefined;
    isPending: boolean;
    error: unknown;
    onClose: () => void;
    /** 이력 화면으로 건너갔을 때 머리의 '← ○○로 돌아가기'에 쓸 이 화면 이름 */
    returnLabel?: string;
}) {
    const open = userId !== null;
    const uid = user?.id ?? userId ?? '';
    // 응모·응모권 화면으로 건너가면 머리에 '← (이 화면)로 돌아가기'가 떠 이 사용자 상세로 돌아온다
    const back = useReturnState(`${returnLabel} · ${user?.name ?? '사용자'}`);

    return (
        <InspectorPanel open={open} onOpenChange={(next) => !next && onClose()}>
            <InspectorBody>
                <InspectorHeader>
                    <InspectorTitle>{user?.name ?? '사용자 상세'}</InspectorTitle>
                    <InspectorDescription className="break-all">{uid}</InspectorDescription>
                </InspectorHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                    {isPending && (
                        <LoadingBlock label="사용자 정보를 불러오는 중…">
                            <SkeletonRows rows={3} />
                        </LoadingBlock>
                    )}
                    {error != null && (
                        <p role="alert" className="text-semantic-error-strong text-body-sm">
                            {getErrorMessage(error)}
                        </p>
                    )}
                    {user && (
                        <>
                            <DetailSummary>
                                <div className="flex flex-wrap items-center gap-2">
                                    <MembershipBadge membership={user.membership} />
                                    <Badge variant={user.role === 'ADMIN' ? 'info' : 'outline'}>
                                        {USER_ROLE_LABEL[user.role]}
                                    </Badge>
                                    <UserStatus status={user.status} />
                                </div>
                            </DetailSummary>
                            <DetailSection title="계정">
                                <DetailList>
                                    <DetailItem label="가입일">
                                        {formatKstFullDot(user.createdAt, true)}
                                    </DetailItem>
                                    <DetailItem label="최종 수정">
                                        {formatKstFullDot(user.updatedAt, true)}
                                    </DetailItem>
                                </DetailList>
                            </DetailSection>
                            {/* 이 사용자의 운영 기록으로 바로 간다 — 글자 링크보다 눌러 볼 곳임이 잘 보이게 버튼으로 */}
                            <DetailSection title="이력 보기">
                                <nav
                                    aria-label="사용자 운영 조회"
                                    className="grid grid-cols-2 gap-2"
                                >
                                    <Button variant="secondary" asChild>
                                        <Link to={`/admin/entries?userId=${uid}`} state={back}>
                                            응모 이력 조회
                                        </Link>
                                    </Button>
                                    <Button variant="secondary" asChild>
                                        <Link to={`/admin/tickets?userId=${uid}`} state={back}>
                                            응모권 이력 조회
                                        </Link>
                                    </Button>
                                </nav>
                            </DetailSection>
                        </>
                    )}
                </div>
            </InspectorBody>
        </InspectorPanel>
    );
}
