import { cn } from 'cn';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import * as React from 'react';

function RadioGroup({
    className,
    ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
    return (
        <RadioGroupPrimitive.Root
            data-slot="radio-group"
            className={cn('grid w-full gap-2', className)}
            {...props}
        />
    );
}

/**
 * 라디오 하나 — 안 고른 원은 흰 바탕 + border/input 테두리라 흰 카드 위에서도 또렷하고,
 * 고르면 잉크(action/neutral)로 채우고 가운데 흰 점을 둔다. 마젠타는 "지금" 신호에만 쓰므로 선택 표시에 쓰지 않는다 (DESIGN-SYSTEM 색 역할)
 */
function RadioGroupItem({
    className,
    ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
    return (
        <RadioGroupPrimitive.Item
            data-slot="radio-group-item"
            className={cn(
                'group/radio-group-item peer bg-surface-page border-border-input focus-visible:ring-border-focus aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-action-neutral data-checked:bg-action-neutral relative flex aspect-square size-5 shrink-0 rounded-full border-[1.5px] transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2',
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="flex size-full items-center justify-center"
            >
                <span className="bg-fg-on-brand absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    );
}

export { RadioGroup, RadioGroupItem };
