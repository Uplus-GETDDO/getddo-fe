import type { ReactNode } from 'react';

/**
 * 폼 한 단계 — 번호·제목·한 줄 설명을 머리에 두고 칸들을 카드 하나로 묶는다.
 * 처음 쓰는 관리자가 위에서부터 차례로 채우면 되도록 번호로 순서를 보인다
 */
export function FormStep({
    step,
    title,
    description,
    action,
    children,
}: {
    step: number;
    title: string;
    description?: string;
    /** 머리 오른쪽 보조 동작 (예: 경품 추가) */
    action?: ReactNode;
    children: ReactNode;
}) {
    const titleId = `event-form-step-${step}`;
    return (
        <section
            aria-labelledby={titleId}
            className="bg-surface-page border-border-default flex flex-col gap-5 rounded-2xl border p-6"
        >
            <div className="flex items-start gap-3">
                <span
                    aria-hidden
                    className="bg-action-neutral text-fg-on-brand flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                >
                    {step}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 id={titleId} className="text-body-bold text-fg-primary">
                        {title}
                    </h3>
                    {description && <p className="text-body-sm text-fg-secondary">{description}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/**
 * 라벨·필수 표시·도움말·오류를 한 칸으로 묶는다.
 * 필수 표시(*)는 라벨 밖에 둬 라벨 이름을 바꾸지 않는다 — 화면 낭독기에는 입력의 aria-required가 알린다.
 * 도움말·오류의 id는 `${id}-hint`·`${id}-error`라 입력의 aria-describedby가 같은 규칙으로 가리킨다
 */
export function FormField({
    id,
    label,
    required = false,
    hint,
    error,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    hint?: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-0.5">
                <label htmlFor={id} className="text-body-sm-bold text-fg-primary">
                    {label}
                </label>
                {required && (
                    <span aria-hidden className="text-semantic-error-strong text-body-sm-bold">
                        *
                    </span>
                )}
            </div>
            {children}
            {error ? (
                <p id={`${id}-error`} className="text-semantic-error-strong text-caption">
                    {error}
                </p>
            ) : (
                hint && (
                    <p id={`${id}-hint`} className="text-caption text-fg-tertiary">
                        {hint}
                    </p>
                )
            )}
        </div>
    );
}
