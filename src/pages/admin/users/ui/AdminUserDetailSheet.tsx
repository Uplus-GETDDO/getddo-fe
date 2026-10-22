import { Link } from 'react-router-dom';

import type { AdminUser } from '@entities/user';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/ui/sheet';
import { formatKstDot } from '@shared/utils/date';

import { USER_ROLE_LABEL, USER_STATUS_LABEL } from '../model/labels';

// AO02 상세 서랍 — 조회 전용. 연락처·정지/해제·역할 변경 등 스펙에 없는 수정 동작은 두지 않는다
export function AdminUserDetailSheet({
    userId,
    user,
    isPending,
    error,
    onClose,
}: {
    userId: string | null;
    user: AdminUser | undefined;
    isPending: boolean;
    error: unknown;
    onClose: () => void;
}) {
    const open = userId !== null;
    const uid = user?.id ?? userId ?? '';

    return (
        <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{user?.name ?? '사용자 상세'}</SheetTitle>
                    <SheetDescription className="break-all">{uid}</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-4 pb-4">
                    {isPending && <p className="text-body-sm text-fg-secondary">불러오는 중…</p>}
                    {error != null && (
                        <p role="alert" className="text-semantic-error-strong text-body-sm">
                            {getErrorMessage(error)}
                        </p>
                    )}
                    {user && (
                        <dl className="text-body-sm grid grid-cols-[6rem_1fr] gap-y-2">
                            <dt className="text-fg-secondary">역할</dt>
                            <dd>{USER_ROLE_LABEL[user.role]}</dd>
                            <dt className="text-fg-secondary">상태</dt>
                            <dd>{USER_STATUS_LABEL[user.status]}</dd>
                            <dt className="text-fg-secondary">멤버십</dt>
                            <dd>
                                {user.membership ? MEMBERSHIP_LABEL[user.membership] : '미설정'}
                            </dd>
                            <dt className="text-fg-secondary">가입일</dt>
                            <dd>{formatKstDot(user.createdAt, true)}</dd>
                            <dt className="text-fg-secondary">최종 수정</dt>
                            <dd>{formatKstDot(user.updatedAt, true)}</dd>
                        </dl>
                    )}
                    {user && (
                        <nav
                            aria-label="사용자 운영 조회"
                            className="flex flex-col gap-2 border-t pt-4"
                        >
                            <Link
                                className="text-fg-brand text-body-sm hover:underline"
                                to={`/admin/entries?userId=${uid}`}
                            >
                                응모 이력 조회
                            </Link>
                            <Link
                                className="text-fg-brand text-body-sm hover:underline"
                                to={`/admin/tickets?userId=${uid}`}
                            >
                                응모권 이력 조회
                            </Link>
                        </nav>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
