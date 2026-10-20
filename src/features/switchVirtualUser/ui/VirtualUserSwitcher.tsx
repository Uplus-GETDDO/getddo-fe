import { Check, CircleUserRound, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useSessionStore, useVirtualUsers } from '@entities/user';
import profileAvatar from '@shared/assets/ui/profile-avatar-head.png';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import { SkeletonList } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';

interface VirtualUserSwitcherProps {
    /** 트리거를 바꾸고 싶을 때 넘긴다 (기본: 프로필 아이콘 버튼) */
    trigger?: ReactNode;
}

// 헤더 프로필 아이콘 등에서 가상 사용자를 즉시 전환하는 팝오버 — 최초 진입만 /login, 이후 전환은 이 컴포넌트로 처리한다
export function VirtualUserSwitcher({ trigger }: VirtualUserSwitcherProps) {
    const [open, setOpen] = useState(false);
    const current = useSessionStore((state) => state.user);
    const selectUser = useSessionStore((state) => state.selectUser);
    const { data: users, isPending, isError } = useVirtualUsers();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                asChild={!!trigger}
                aria-label={
                    current ? `가상 사용자 전환, 현재 사용자 ${current.name}` : '가상 사용자 전환'
                }
                className={
                    trigger
                        ? undefined
                        : 'text-fg-primary focus-visible:ring-border-focus focus-visible:ring-offset-surface-page relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                }
            >
                {trigger ?? <CircleUserRound className="size-6" />}
            </PopoverTrigger>
            <PopoverContent
                align="end"
                collisionPadding={16}
                className="w-80 max-w-[calc(100vw-2rem)]"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-sm-bold text-fg-primary">가상 사용자 전환</p>
                    {current && (
                        <p className="text-fg-tertiary text-caption min-w-0 break-all">
                            현재: {current.name}
                        </p>
                    )}
                </div>
                <div className="border-border-default border-t" />
                <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                    {isPending && (
                        <div role="status">
                            <span className="sr-only">사용자 목록을 불러오는 중이에요</span>
                            <SkeletonList
                                count={5}
                                rowClassName="h-12 px-2.5"
                                thumbnailClassName="size-7 rounded-full"
                            />
                        </div>
                    )}
                    {isError && (
                        <p className="text-semantic-error-strong text-body-sm py-4 text-center">
                            시연 계정 설정이 없거나 올바르지 않습니다.
                        </p>
                    )}
                    {users?.map((user) => {
                        const isCurrent = user.id === current?.id;
                        return (
                            <button
                                key={user.id}
                                type="button"
                                disabled={isCurrent}
                                onClick={() => {
                                    selectUser(user);
                                    setOpen(false);
                                    // 관리자 전환도 현재 화면에 머문다 — 관리자 화면 이동은 헤더 버튼으로만 한다
                                }}
                                className={cn(
                                    'hover:bg-surface-pressed focus-visible:bg-surface-pressed focus-visible:ring-border-focus flex items-center gap-3 rounded-lg p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                                    isCurrent && 'cursor-default',
                                )}
                            >
                                {user.role === 'ADMIN' ? (
                                    // 타코야키 얼굴(28)과 이름 줄이 맞도록 같은 칸에 가운데 둔다
                                    <span className="flex size-7 shrink-0 items-center justify-center">
                                        <ShieldCheck className="text-fg-brand size-5" />
                                    </span>
                                ) : (
                                    // 일반 사용자는 헤더 프로필과 같은 타코야키 얼굴 — 관리자만 방패 아이콘으로 구분한다
                                    <img
                                        src={profileAvatar}
                                        alt=""
                                        className="size-7 shrink-0 rounded-full"
                                    />
                                )}
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-body-sm-bold text-fg-primary flex flex-wrap items-center gap-1.5">
                                        <span className="min-w-0 break-all">{user.name}</span>
                                        {user.role === 'ADMIN' && (
                                            <span className="bg-brand-primary text-fg-on-brand rounded px-1.5 py-0.5 text-xs font-medium">
                                                관리자
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-fg-secondary text-caption break-all">
                                        {user.personaLabel ?? '시스템 관리 계정'}
                                    </span>
                                </div>
                                {isCurrent && <Check className="text-fg-brand size-4 shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
