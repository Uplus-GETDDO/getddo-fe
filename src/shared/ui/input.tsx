import { cn } from 'cn';
import * as React from 'react';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                // 입력창 공통 — 높이 40(버튼 Medium과 같은 줄에 서도록), 올리면 테두리가 진해지고 포커스는 진한 테두리 + 옅은 링
                'border-border-input bg-surface-page text-fg-primary placeholder:text-fg-tertiary hover:border-border-input-hover focus-visible:border-border-focus focus-visible:ring-border-focus/10 aria-invalid:border-semantic-error-strong aria-invalid:ring-semantic-error-strong/10 disabled:bg-surface-disabled disabled:text-fg-disabled file:text-fg-primary md:text-body-sm h-10 w-full min-w-0 rounded-lg border px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-3 disabled:cursor-not-allowed',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
