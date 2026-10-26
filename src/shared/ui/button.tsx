import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';
import * as React from 'react';

/**
 * 버튼 — 피그마 01 Design System > 04 Button 기준.
 * 이름은 색이 아니라 역할로 붙인다 (색이 바뀌어도 쓰는 곳은 그대로):
 * primary(화면의 주된 행동 — action/neutral 검정) · secondary(보조 행동·취소 — 흰 바탕+border/strong 테두리)
 * · ghost(아이콘·닫기) · destructive(삭제 등 위험한 행동) · link(텍스트 이동) 5종이다.
 * 마젠타는 버튼 바탕에 쓰지 않고(emphasis 제거), 노랑 버튼은 쓸 곳이 생길 때 따로 정한다 (DESIGN-SYSTEM 13절).
 * 크기: sm 36(글자 14) · default 40(글자 16) · lg 48(글자 16), 모두 SemiBold·모서리 8·좌우 12.
 * 각 색은 기본·호버·누름 토큰을 쓰고, 비활성은 surface/disabled 바탕에 fg/disabled 글자다.
 * 바탕은 투명 테두리 밑까지 칠한다 — 테두리 안쪽만 칠하면 채운 버튼이 테두리 버튼보다 1px씩 작아 보인다
 * 글자 크기는 text-sm/text-base(14/16px)로 둔다 — 커스텀 타이포 토큰(text-body-bold 등)은 공용 cn이 글자색과 같은 묶음으로 보고 색을 지운다
 */
const buttonVariants = cva(
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:text-fg-disabled aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                // 주된 행동 — action/neutral (피그마 Button/*/active)
                primary:
                    'bg-action-neutral text-fg-on-brand hover:bg-action-neutral-hover active:bg-action-neutral-pressed',
                // 악센트 — 응모권 노랑 바탕에 잉크 글씨. 검정이 많아 보이지 않게 응모 진입처럼 가장 중요한 행동에만 아껴 쓴다.
                // 노랑은 hover·pressed 토큰이 없어 밝기만 한 단계씩 낮춘다
                accent: 'bg-ticket-primary text-ticket-on hover:brightness-95 active:brightness-90',
                // 보조 행동 — outline (피그마 Button/*/outline). 취소 버튼도 여기라 노랑으로 채우지 않는다.
                // 마우스를 올리면 연회색 바탕에 테두리를 한 단계 진하게 — 비활성(테두리 없음·연한 글씨)과 테두리·글자로 구분된다
                secondary:
                    'bg-surface-elevated border-border-strong text-fg-primary hover:bg-surface-canvas hover:border-fg-disabled active:bg-surface-pressed active:border-fg-disabled',
                ghost: 'text-fg-secondary hover:bg-surface-canvas hover:text-fg-primary active:bg-surface-pressed aria-expanded:bg-surface-canvas',
                destructive:
                    'bg-semantic-error-strong text-fg-on-brand hover:bg-semantic-error-pressed active:bg-semantic-error-pressed dark:bg-semantic-error/15 dark:text-semantic-error-strong dark:hover:bg-semantic-error/25 dark:active:bg-semantic-error/35',
                // 텍스트 버튼(전체보기·더보기 등) — 보조 글씨였다가 올리면 잉크로 진해지기만 한다. 밑줄은 긋지 않는다 (마이페이지 전체보기와 같은 규칙).
                // size='text'와 함께 쓴다
                link: 'text-fg-secondary transition-colors hover:text-fg-primary active:text-fg-primary disabled:bg-transparent',
            },
            size: {
                sm: 'h-9 px-3 text-sm font-semibold',
                default: 'h-10 px-3 text-base font-semibold',
                lg: 'h-12 px-3 text-base font-semibold',
                // 아이콘만 있는 버튼 (정사각형)
                icon: 'size-10',
                'icon-sm': 'size-7 rounded-md',
                'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
                'icon-lg': 'size-12',
                // 텍스트 버튼 — 높이·여백 없이 글자 14 Regular, 아이콘 20 (피그마 홈 전체보기·더보기).
                // 누름 칸은 위아래 패딩으로 24px(WCAG 2.5.8)까지 넓히고 음수 마진으로 되돌려 줄높이를 지킨다
                text: "-my-0.5 h-auto gap-0.5 px-0 py-0.5 text-sm font-normal [&_svg:not([class*='size-'])]:size-5",
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'default',
        },
    },
);

function Button({
    className,
    variant = 'primary',
    size = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : 'button';

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
