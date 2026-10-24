import type { ReactNode } from 'react';

import { cn } from 'cn';

/**
 * 관리자 상세(드로어·패널) 공통 틀 — 글만 세로로 늘어서면 무엇이 중요한지 읽히지 않아 세 단계로 나눈다.
 * 1) DetailSummary: 맨 위 회색 상자, 이 기록을 한 줄로 말하는 핵심(상태 배지·제목·기간)
 * 2) DetailSection: 주제별 묶음 — 작은 제목 아래 DetailList
 * 3) DetailList/DetailItem: 왼쪽 이름표(흐린 글)·오른쪽 값(진한 글) 두 칸 표
 * 글자 크기 토큰은 cn에 넣지 않는다 — 공용 cn이 글자색과 같은 묶음으로 보고 크기를 지운다
 */
function DetailSummary({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('bg-surface-canvas flex flex-col gap-3 rounded-xl p-4', className)}>
            {children}
        </div>
    );
}

function DetailSection({
    title,
    action,
    children,
}: {
    title: string;
    /** 제목 오른쪽 보조 동작 */
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-body-sm-bold text-fg-primary">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

function DetailList({ children }: { children: ReactNode }) {
    return <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5">{children}</dl>;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt className="text-body-sm text-fg-tertiary">{label}</dt>
            <dd className="text-body-sm text-fg-primary min-w-0 break-words">{children}</dd>
        </>
    );
}

/** 숫자 칸 — 한도·횟수처럼 비교해 봐야 하는 값을 나란히 크게 보인다 */
function DetailStats({
    items,
}: {
    items: readonly { label: string; value: ReactNode; emphasis?: boolean }[];
}) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
                <div
                    key={item.label}
                    className={cn(
                        'flex flex-col gap-1 rounded-lg border px-3 py-2.5',
                        item.emphasis
                            ? 'border-semantic-error-strong/30 bg-semantic-error/5'
                            : 'border-border-default',
                    )}
                >
                    <span className="text-caption text-fg-tertiary">{item.label}</span>
                    <span
                        className={
                            item.emphasis
                                ? 'text-subhead text-semantic-error-strong tabular-nums'
                                : 'text-subhead text-fg-primary tabular-nums'
                        }
                    >
                        {item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** 사람이 읽지 않는 식별자 — 맨 아래 작은 글로 둔다 */
function DetailMeta({ children }: { children: ReactNode }) {
    return (
        <p className="text-caption text-fg-tertiary border-border-default border-t pt-4 break-all">
            {children}
        </p>
    );
}

export { DetailItem, DetailList, DetailMeta, DetailSection, DetailStats, DetailSummary };
