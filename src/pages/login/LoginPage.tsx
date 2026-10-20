import { CircleUserRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { VirtualUser } from '@entities/user';

import { useSessionStore, useVirtualUsers } from '@entities/user';
import { SkeletonList } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';

export function LoginPage() {
    const navigate = useNavigate();
    const selectUser = useSessionStore((state) => state.selectUser);
    const { data: users, isPending, isError } = useVirtualUsers();

    const handleSelect = (user: VirtualUser) => {
        selectUser(user);
        // 관리자 포함 모두 사용자 홈으로 진입한다 — 관리자 화면 이동은 헤더의 관리자 버튼으로만 한다
        void navigate('/', { replace: true });
    };

    return (
        <main className="bg-surface-page flex min-h-screen items-center justify-center px-6">
            <section className="flex w-full max-w-120 flex-col gap-8">
                <div className="flex flex-col gap-2 text-center">
                    <h1 className="text-title-1 text-fg-primary">
                        U<span className="text-fg-brand">+</span> GETDDO
                    </h1>
                    <p className="text-body-sm text-fg-tertiary">
                        시연용 가상 사용자를 선택해 시작해요
                    </p>
                </div>

                {isPending && (
                    <div role="status">
                        <span className="sr-only">사용자 목록을 불러오는 중이에요</span>
                        <SkeletonList
                            count={5}
                            rowClassName="h-16"
                            thumbnailClassName="size-10 rounded-full"
                        />
                    </div>
                )}
                {isError && (
                    <p className="text-destructive text-body-sm text-center">
                        가상 사용자 목록을 불러오지 못했습니다.
                    </p>
                )}

                <ul className="flex flex-col gap-3">
                    {users?.map((user) => (
                        <li key={user.id}>
                            <button
                                type="button"
                                onClick={() => handleSelect(user)}
                                className={cn(
                                    'bg-surface-page border-border-default flex w-full items-center gap-4 rounded-2xl border p-5 text-left',
                                    'hover:border-fg-brand focus-visible:ring-border-focus focus-visible:ring-offset-surface-page transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                                )}
                            >
                                {user.role === 'ADMIN' ? (
                                    <ShieldCheck className="text-fg-brand size-6 shrink-0" />
                                ) : (
                                    <CircleUserRound className="text-fg-primary size-6 shrink-0" />
                                )}
                                <div className="flex flex-1 flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-subhead text-fg-primary">
                                            {user.name}
                                        </span>
                                        {user.role === 'ADMIN' && (
                                            <span className="bg-brand-primary text-fg-on-brand rounded-md px-2 py-0.5 text-xs font-medium">
                                                관리자
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-body-sm text-fg-tertiary">
                                        {user.personaLabel ?? '시스템 관리 계정'} · {user.id}
                                    </span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
}
