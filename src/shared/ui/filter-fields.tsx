import { cn } from 'cn';
import { CalendarDays, Search } from 'lucide-react';
import { useId, useRef } from 'react';

import { Input } from '@shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';

/** 글자 검색·거르기 칸 — 앞머리 돋보기로 검색 칸임을 알린다 */
function TextFilter({
    value,
    onChange,
    placeholder,
    label,
    className = 'w-48',
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label: string;
    /** 칸 너비 */
    className?: string;
}) {
    return (
        <div className={cn('relative', className)}>
            <Search
                aria-hidden
                className="text-fg-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="pl-9"
                aria-label={label}
            />
        </div>
    );
}

/**
 * 칸 안 날짜 입력 — 테두리는 바깥 상자가 그린다. 연·월·일은 키보드로 바로 입력하고, 달력은 오른쪽 단추로 연다
 * (브라우저 기본 달력 단추는 위치가 제각각이라 숨긴다). 연도는 max로 4자리까지만 받는다
 */
const DATE_INPUT =
    'text-fg-primary md:text-body-sm h-full w-[6.25rem] min-w-0 bg-transparent text-base tabular-nums outline-none [&::-webkit-calendar-picker-indicator]:hidden';
const DATE_MAX = '9999-12-31';

function DateField({
    value,
    onChange,
    label,
    invalid,
    describedBy,
}: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    invalid: boolean;
    describedBy?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const openPicker = () => {
        const input = inputRef.current;
        if (!input) return;
        try {
            input.showPicker();
        } catch {
            // 지원하지 않는 브라우저는 키보드 입력으로 둔다
            input.focus();
        }
    };
    return (
        <span className="flex h-full items-center gap-1">
            <input
                ref={inputRef}
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                max={DATE_MAX}
                className={DATE_INPUT}
                aria-label={label}
                aria-invalid={invalid}
                aria-describedby={describedBy}
            />
            <button
                type="button"
                onClick={openPicker}
                aria-label={`${label} 달력 열기`}
                className="text-fg-tertiary hover:text-fg-primary hover:bg-surface-sunken focus-visible:ring-border-focus flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                <CalendarDays aria-hidden className="size-4" />
            </button>
        </span>
    );
}

/**
 * 기간 필터 — 시작·종료 날짜를 테두리 하나로 묶은 높이 40 상자. 날짜는 모두 한국 시간이다. 기준(예: 응모 시작일)은 상자 안 앞머리에 둬서
 * 아래 줄이 생기지 않게 한다 — 옆의 검색창·버튼과 윗선이 맞는다. 순서 오류 문구도 상자 아래에 띄워 줄을 밀지 않는다.
 * 좁은 화면에서는 상자 안쪽으로 줄바꿈해 페이지가 가로로 넘치지 않게 한다
 */
function DateRangeFilter({
    from,
    to,
    onFromChange,
    onToChange,
    basis,
    name,
    error,
}: {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    /** 이 기간 필터가 거는 시각의 의미 — "응모 시작일"·"생성일" 등 */
    basis?: string;
    /** 화면에 기준 글을 띄우지 않을 때(바깥에 이름표가 있을 때) 화면 낭독기용 이름 — 예: "처리일" */
    name?: string;
    /** 시작일이 종료일보다 늦은 등 순서 오류 문구 */
    error?: string | null;
}) {
    const errorId = useId();
    const describedBy = error ? errorId : undefined;
    return (
        <div className="relative">
            <div
                className={cn(
                    'border-border-input bg-surface-page hover:border-border-input-hover focus-within:border-border-focus flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border py-1 pr-1.5 pl-3 transition-colors',
                    // 오류 중에는 테두리색이 이미 빨강이라 포커스가 안 보였다 — 번짐 없이 테두리만 두 겹으로 굵힌다
                    error &&
                        'border-semantic-error-strong hover:border-semantic-error-strong focus-within:border-semantic-error-strong focus-within:ring-semantic-error-strong focus-within:ring-1',
                )}
            >
                {basis && (
                    <span className="text-caption text-fg-tertiary border-border-default shrink-0 border-r pr-2 whitespace-nowrap">
                        {basis}
                    </span>
                )}
                <DateField
                    value={from}
                    onChange={onFromChange}
                    label={(basis ?? name) ? `${basis ?? name} 시작일` : '시작일 필터'}
                    invalid={Boolean(error)}
                    describedBy={describedBy}
                />
                <span aria-hidden className="text-fg-tertiary">
                    ~
                </span>
                <DateField
                    value={to}
                    onChange={onToChange}
                    label={(basis ?? name) ? `${basis ?? name} 종료일` : '종료일 필터'}
                    invalid={Boolean(error)}
                    describedBy={describedBy}
                />
            </div>
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-semantic-error-strong text-caption absolute top-full left-0 mt-1 whitespace-nowrap"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

function OptionFilter({
    value,
    onChange,
    options,
    label,
    className = 'w-36',
}: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    label: string;
    className?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={className} aria-label={label}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export { DateRangeFilter, OptionFilter, TextFilter };
