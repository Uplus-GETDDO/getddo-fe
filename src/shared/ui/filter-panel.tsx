import type { ReactNode } from 'react';

import { cn } from 'cn';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/*
 * 관리자 목록 필터 — Stripe·Linear·GitHub 대시보드의 '필터 알약' 방식.
 * 한 줄에 검색창과 조건 알약을 늘어놓고, 알약을 누르면 작은 창에서 고른다.
 * 고른 알약은 '상태: 진행 중'처럼 값을 품고 진해져, 지금 걸린 조건이 표 위 한 줄에서 바로 읽힌다.
 * 조건마다 이름표 줄을 두던 예전 상자는 셀렉트·칩이 오른쪽으로 밀려 보였고, 접힌 '상세 조건'은 눌러 볼 곳인지 몰랐다
 */

const PanelContext = createContext<{ submit?: () => void }>({});
const RowContext = createContext<{ close: () => void } | null>(null);

/** 알약 창 안에 놓였는지 — 창 안에서는 목록을 겹쳐 띄우지 않고 그 자리에 펼친다 */
function useInFilterRow() {
    return useContext(RowContext) !== null;
}

/** 알약 창 안에서 고른 뒤 창을 닫는다 — 창 밖(알약이 아닌 곳)에서는 아무 일도 하지 않는다 */
function useFilterRowClose() {
    return useContext(RowContext)?.close ?? (() => {});
}

function FilterPanel({
    search,
    onSubmit,
    onReset,
    activeCount = 0,
    error,
    submitLabel = '검색',
    children,
    className,
}: {
    /** 맨 앞 검색 칸 — 있으면 검색 버튼과 함께 둔다 */
    search?: ReactNode;
    /** 검색 버튼·엔터, 알약 창의 '적용' — 글자·날짜처럼 다 쓴 뒤 거는 조건을 확정한다 */
    onSubmit?: () => void;
    onReset?: () => void;
    /** 기본값과 다른 조건 수 — 1개 이상일 때만 '필터 초기화'를 보인다 */
    activeCount?: number;
    /** 검색 조건 오류 — 줄 아래에 띄운다 */
    error?: string | null;
    submitLabel?: string;
    /** FilterRow(알약)들 */
    children?: ReactNode;
    className?: string;
}) {
    return (
        <PanelContext.Provider value={{ submit: onSubmit }}>
            <form
                role="search"
                className={cn('flex flex-col gap-2', className)}
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit?.();
                }}
            >
                <div className="flex flex-wrap items-center gap-2">
                    {search && (
                        <div className="flex w-full items-center gap-2 sm:w-auto">
                            <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">{search}</div>
                            {onSubmit && <Button type="submit">{submitLabel}</Button>}
                        </div>
                    )}
                    {search && children && (
                        <span
                            aria-hidden
                            className="bg-border-default mx-1 hidden h-6 w-px sm:block"
                        />
                    )}
                    {children}
                    {onReset && activeCount > 0 && (
                        <Button
                            type="button"
                            variant="link"
                            size="text"
                            onClick={onReset}
                            className="ml-1"
                        >
                            필터 초기화
                        </Button>
                    )}
                </div>
                {error && (
                    <p role="alert" className="text-semantic-error-strong text-caption">
                        {error}
                    </p>
                )}
            </form>
        </PanelContext.Provider>
    );
}

/**
 * 조건 알약 — 비었으면 점선 테두리에 '+ 이름', 걸리면 진한 테두리에 '이름: 값'과 지우기(×).
 * 누르면 아래로 작은 창이 열린다. apply를 주면 창 아래 '적용' 버튼이 검색처럼 조건을 확정한다(날짜·글자)
 */
function FilterRow({
    label,
    value,
    onClear,
    apply = false,
    children,
}: {
    label: string;
    /** 걸린 값 요약 — 없으면 빈 알약 */
    value?: ReactNode;
    /** 알약의 × — 이 조건만 지운다 */
    onClear?: () => void;
    /** 창 아래 '적용' 버튼을 둔다 — 다 쓴 뒤 거는 날짜·글자 조건 */
    apply?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const { submit } = useContext(PanelContext);
    const active = value !== undefined && value !== null && value !== '';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div
                className={cn(
                    'flex h-9 items-center rounded-full border text-sm transition-colors',
                    active
                        ? 'border-fg-primary bg-surface-page text-fg-primary'
                        : 'border-border-strong text-fg-secondary hover:border-fg-tertiary hover:text-fg-primary border-dashed',
                )}
            >
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'focus-visible:ring-border-focus flex h-full cursor-pointer items-center gap-1.5 rounded-full pl-3 focus-visible:ring-2 focus-visible:outline-none',
                            active && onClear ? 'pr-1' : 'pr-3',
                        )}
                    >
                        {active ? (
                            <>
                                <span className="text-fg-secondary">{label}</span>
                                <span className="max-w-48 truncate font-semibold">{value}</span>
                                <ChevronDown aria-hidden className="text-fg-tertiary size-3.5" />
                            </>
                        ) : (
                            <>
                                <Plus aria-hidden className="size-3.5" />
                                {label}
                            </>
                        )}
                    </button>
                </PopoverTrigger>
                {active && onClear && (
                    <button
                        type="button"
                        aria-label={`${label} 조건 지우기`}
                        onClick={onClear}
                        className="text-fg-tertiary hover:text-fg-primary hover:bg-surface-sunken focus-visible:ring-border-focus mr-1 flex size-6 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <X aria-hidden className="size-3.5" />
                    </button>
                )}
            </div>
            <PopoverContent
                align="start"
                // 열자마자 첫 입력창·항목에 포커스가 꽂히면 누르지도 않았는데 선택된 듯 보였다 — 창에만 두고 탭·클릭으로 들어가게 한다
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.currentTarget as HTMLElement).focus();
                }}
                className="bg-surface-page border-border-default w-auto min-w-60 gap-3 rounded-xl border p-3 shadow-lg ring-0"
            >
                <p className="text-body-sm-bold text-fg-primary">{label}</p>
                <RowContext.Provider value={{ close: () => setOpen(false) }}>
                    {children}
                </RowContext.Provider>
                {apply && submit && (
                    <div className="border-border-default -mx-3 -mb-3 flex justify-end gap-2 border-t px-3 py-2.5">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            닫기
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                submit();
                                setOpen(false);
                            }}
                        >
                            적용
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

/**
 * 하나만 고르는 목록 — 알약 창 안에 세로로 늘어놓고, 고른 줄에 체크를 단다. 고르면 바로 걸리고 창이 닫힌다
 */
function FilterChips<T extends string>({
    value,
    onChange,
    options,
    label,
}: {
    value: T;
    onChange: (value: T) => void;
    options: readonly { value: T; label: string }[];
    /** 묶음 이름 — 화면 낭독기에 읽힌다 */
    label: string;
}) {
    const close = useFilterRowClose();
    return (
        <div role="radiogroup" aria-label={label} className="-mx-1 flex flex-col">
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                            onChange(option.value);
                            close();
                        }}
                        className={cn(
                            'hover:bg-surface-sunken focus-visible:bg-surface-sunken flex h-9 cursor-pointer items-center justify-between gap-6 rounded-lg px-2 text-left text-sm whitespace-nowrap focus-visible:outline-none',
                            selected ? 'text-fg-primary font-semibold' : 'text-fg-secondary',
                        )}
                    >
                        {option.label}
                        {selected && <Check aria-hidden className="size-4" />}
                    </button>
                );
            })}
        </div>
    );
}

/** 알약에 띄울 선택 이름 — '전체'(첫 값)면 비운다 */
function chipValue<T extends string>(
    options: readonly { value: T; label: string }[],
    value: T,
    allValue = 'all',
) {
    return value === allValue ? undefined : options.find((option) => option.value === value)?.label;
}

/** 알약에 띄울 기간 — 'MM.DD ~ MM.DD', 한쪽만 있으면 '~부터'·'~까지' */
function rangeValue(from: string, to: string) {
    const short = (ymd: string) => ymd.slice(5).replace('-', '.');
    if (from && to) return from === to ? short(from) : `${short(from)} ~ ${short(to)}`;
    if (from) return `${short(from)}부터`;
    if (to) return `${short(to)}까지`;
    return undefined;
}

export {
    chipValue,
    FilterChips,
    FilterPanel,
    FilterRow,
    rangeValue,
    useFilterRowClose,
    useInFilterRow,
};
