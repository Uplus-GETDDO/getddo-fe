import { cn } from 'cn';
import * as React from 'react';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                // 입력창과 같은 테두리·포커스 규칙
                'border-border-input bg-surface-page text-fg-primary placeholder:text-fg-tertiary hover:border-border-input-hover focus-visible:border-border-focus focus-visible:ring-border-focus/10 aria-invalid:border-semantic-error-strong aria-invalid:ring-semantic-error-strong/10 disabled:bg-surface-disabled disabled:text-fg-disabled md:text-body-sm flex field-sizing-content min-h-16 w-full rounded-lg border px-3 py-2.5 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed',
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
