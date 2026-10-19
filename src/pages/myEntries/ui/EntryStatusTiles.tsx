import { ArrowDown } from 'lucide-react';

import type { EntryStatusFilter } from '../utils/filterEntries';

/** 결과 칸 하나의 표시 값 */
export interface StatusTile {
    value: EntryStatusFilter;
    label: string;
    count: number;
    note: string;
}

/**
 * 결과 칸 4개(전체·발표 대기·당첨·미당첨) — 요약이자 거르기 버튼이다.
 * 고른 칸은 잉크색 2px 테두리로 표시하고 aria-pressed로 알린다.
 * 누를 수 있다는 걸 알리도록 미션 "오늘의 적립" 칸처럼 오른쪽 위에 아래 화살표(아래 목록이 바뀐다)를 늘 두고,
 * 마우스를 올리면 화살표가 진해지고 그림자가 깊어진다. 고른 칸은 화살표도 진하게 둔다
 */
export function EntryStatusTiles({
    tiles,
    value,
    onChange,
    isPending = false,
    isUnavailable = false,
}: {
    tiles: StatusTile[];
    isPending?: boolean;
    isUnavailable?: boolean;
    value: EntryStatusFilter;
    onChange: (value: EntryStatusFilter) => void;
}) {
    return (
        <div
            role="group"
            aria-label="결과로 거르기"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
            {tiles.map((tile) => {
                const selected = tile.value === value;
                return (
                    <button
                        key={tile.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(tile.value)}
                        className={`group/tile bg-surface-page focus-visible:ring-border-focus relative flex min-h-29 cursor-pointer flex-col items-start gap-1 rounded-2xl p-5 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                            selected
                                ? 'border-fg-primary border-2 p-[calc(1.25rem-1px)]'
                                : 'border-border-default border'
                        }`}
                    >
                        <ArrowDown
                            aria-hidden
                            className={`absolute top-4 right-4 size-4 transition-colors ${selected ? 'text-fg-primary' : 'text-fg-disabled group-hover/tile:text-fg-primary'}`}
                        />
                        <span className="text-body-sm text-fg-secondary">{tile.label}</span>
                        <span className="text-title-2 text-fg-primary">
                            {isPending
                                ? '조회 중'
                                : isUnavailable && tile.value !== 'ALL'
                                  ? '일부 결과 미조회'
                                  : `${tile.count}건`}
                        </span>
                        <span className="text-caption text-fg-tertiary">
                            {isPending
                                ? '결과를 불러오고 있어요'
                                : isUnavailable
                                  ? '마지막 조회 기준이에요'
                                  : tile.note}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
