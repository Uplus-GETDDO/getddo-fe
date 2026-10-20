import type { ReactNode } from 'react';

export function SectionHeader({
    title,
    caption,
    refresh,
}: {
    title: string;
    caption?: string;
    /** 제목 옆 작은 갱신 표시(RefreshStatus) — 다시 받는 중이면 아이콘이 돈다 */
    refresh?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-title-3 text-fg-primary">{title}</h2>
            {caption && <p className="text-body-sm text-fg-tertiary">{caption}</p>}
            {refresh}
        </div>
    );
}
