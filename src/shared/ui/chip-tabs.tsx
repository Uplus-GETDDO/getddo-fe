import type { KeyboardEvent } from 'react';

import { cn } from 'cn';

/** 탭·패널 id 규칙 — 패널은 `${idPrefix}-panel-${value}`, aria-labelledby는 `${idPrefix}-tab-${value}` */
function chipTabIds(idPrefix: string, value: string) {
    return { tabId: `${idPrefix}-tab-${value}`, panelId: `${idPrefix}-panel-${value}` };
}

/**
 * 칩 탭 — 한 화면 안 목록을 바꾸는 알약 모양 탭(높이 36). 고른 칩은 진한 바탕, 나머지도 테두리 칩으로 보여
 * 누를 수 있는 탭임이 드러난다. APG 탭 패턴 — 비선택 탭은 tabIndex=-1, 좌우 방향키로 옮긴다
 */
function ChipTabs<T extends string>({
    tabs,
    value,
    onValueChange,
    label,
    idPrefix,
    className,
}: {
    tabs: readonly { value: T; label: string }[];
    value: T;
    onValueChange: (value: T) => void;
    /** 탭 묶음 이름 — 화면 낭독기에 읽힌다 */
    label: string;
    idPrefix: string;
    className?: string;
}) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const index = tabs.findIndex((tab) => tab.value === value);
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(index + step + tabs.length) % tabs.length];
        if (!next) return;
        onValueChange(next.value);
        document.getElementById(chipTabIds(idPrefix, next.value).tabId)?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            data-slot="chip-tabs"
            className={cn('flex flex-wrap gap-2', className)}
            onKeyDown={handleKeyDown}
        >
            {tabs.map((tab) => {
                const selected = tab.value === value;
                const { tabId, panelId } = chipTabIds(idPrefix, tab.value);
                return (
                    <button
                        key={tab.value}
                        id={tabId}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={panelId}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onValueChange(tab.value)}
                        className={cn(
                            'focus-visible:ring-border-focus focus-visible:ring-offset-surface-canvas h-9 cursor-pointer rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            selected
                                ? 'bg-surface-inverse border-surface-inverse text-fg-inverse'
                                : 'bg-surface-page border-border-default text-fg-secondary hover:border-border-strong hover:text-fg-primary',
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export { ChipTabs, chipTabIds };
