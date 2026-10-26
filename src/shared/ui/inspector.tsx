import type { ReactNode } from 'react';

import { XIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useRef } from 'react';

import { useRevealWhenStacked } from '@shared/hooks/useRevealWhenStacked';
import { cn } from '@shared/utils/cn';

import { Button } from './button';

/**
 * 관리자 목록 + 상세(인스펙터) — 줄을 고르면 오른쪽 칸에 상세가 열린다. 이벤트·추첨 관리와 같은 꼴로 모든 관리자 목록을 맞춘다.
 * 상세 칸은 화면 높이에 붙어 스크롤을 따라오고 안쪽만 스크롤한다. 두 칸은 세로선 하나로 나눈다.
 * 좁은 폭에서는 상세가 목록 아래 카드로 열리고, 새로 열 때 그 자리로 스크롤한다
 */
function ListDetailLayout({
    open,
    detailKey,
    label,
    list,
    detail,
    detailSize = 'narrow',
}: {
    open: boolean;
    /** 열린 항목 id — 바뀔 때마다 좁은 폭에서 상세로 스크롤한다 */
    detailKey?: string | null;
    /** 상세 칸 이름(보조 기술) — 예: '사용자 상세' */
    label: string;
    list: ReactNode;
    detail: ReactNode;
    /** narrow: 목록 3 : 상세 2, wide: 1 : 1 (문항·집계처럼 상세가 넓은 화면) */
    detailSize?: 'narrow' | 'wide';
}) {
    const ref = useRevealWhenStacked<HTMLElement>(open ? detailKey : null, '(min-width: 1024px)');
    return (
        <div
            className={cn(
                'flex flex-col gap-6 lg:grid lg:items-start',
                !open
                    ? 'lg:grid-cols-1'
                    : detailSize === 'wide'
                      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-0'
                      : 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-x-0',
            )}
        >
            <div className={cn('min-w-0', open && 'lg:pr-6')}>{list}</div>
            {open && (
                <aside
                    ref={ref}
                    aria-label={label}
                    className="border-border-default motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 min-w-0 scroll-mt-4 overflow-hidden rounded-2xl border motion-safe:duration-200 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:rounded-none lg:border-0 lg:border-l"
                >
                    {detail}
                </aside>
            )}
        </div>
    );
}

const InspectorContext = createContext<{ close: () => void; titleId: string } | null>(null);

/**
 * 상세 칸 한 장 — 모달(Dialog)과 같은 open·onOpenChange를 받아 바꿔 끼우기 쉽게 했다.
 * 모달이 아니므로 화면 나머지는 그대로 쓸 수 있다(비모달 dialog). 열리면 포커스를 칸으로 옮겨 Esc로 바로 닫히게 하고,
 * 화면 낭독기가 열린 상세를 읽기 시작하게 한다
 */
function InspectorPanel({
    open,
    onOpenChange,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}) {
    const titleId = useId();
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        if (open) ref.current?.focus({ preventScroll: true });
    }, [open]);
    if (!open) return null;
    const close = () => onOpenChange(false);
    return (
        <InspectorContext.Provider value={{ close, titleId }}>
            <section
                ref={ref}
                tabIndex={-1}
                role="dialog"
                aria-labelledby={titleId}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        close();
                    }
                }}
                className="bg-surface-page flex h-full min-h-0 flex-col focus:outline-none"
            >
                {children}
            </section>
        </InspectorContext.Provider>
    );
}

/** 머리 아래 내용 — 머리는 고정, 이 칸 안쪽이 스크롤한다 */
function InspectorBody({ children }: { children: ReactNode }) {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

/** 머리 — 제목·설명과 닫기(X). 닫기는 공용 모달 X와 같은 모양(fg-secondary→primary, 바탕 없음) */
function InspectorHeader({ children, className }: { children: ReactNode; className?: string }) {
    const context = useContext(InspectorContext);
    return (
        <div
            className={cn(
                'border-border-default relative flex shrink-0 flex-col gap-1 border-b px-6 pt-5 pr-14 pb-4',
                className,
            )}
        >
            {children}
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="상세 닫기"
                onClick={context?.close}
                className="text-fg-secondary hover:text-fg-primary absolute top-3 right-3 size-9 cursor-pointer hover:bg-transparent dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-5"
            >
                <XIcon aria-hidden />
            </Button>
        </div>
    );
}

function InspectorTitle({ children, className }: { children: ReactNode; className?: string }) {
    const context = useContext(InspectorContext);
    return (
        <h2
            id={context?.titleId}
            className={cn('text-fg-primary text-xl leading-7 font-semibold break-words', className)}
        >
            {children}
        </h2>
    );
}

function InspectorDescription({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <p className={cn('text-fg-secondary text-sm', className)}>{children}</p>;
}

export {
    InspectorBody,
    InspectorDescription,
    InspectorHeader,
    InspectorPanel,
    InspectorTitle,
    ListDetailLayout,
};
