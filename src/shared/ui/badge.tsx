import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import * as React from 'react';

/**
 * 배지 — 상태·분류·수치를 짧게 보여주는 둥근 알약 (피그마 홈 기준).
 * variant: brand(핑크 채움 — 드물게, "지금" 신호는 칩보다 ● 점을 권장) · info(카테고리, 파란 테두리) ·
 * neutral(분류·상태, 회색) · accent(연노랑 — 보상 결과 바탕에만, 정보 칩에는 쓰지 않는다) · outline(흰 바탕+테두리 — 시간·참여 수 같은 정보) ·
 * surface(흰 바탕) · inverse(검정 — D-day·오늘 마감·등수). 색 역할은 docs/DESIGN-SYSTEM.md 13).
 * size (피그마 칩 SM·MD·LG, 패딩은 모두 짝수): sm 22 (좌우 8·위아래 2, 글자 12 Medium — 개수·"나") ·
 * md 26 (좌우 12·위아래 4, 글자 12 Medium — 기본: 태그·D-day·상태) · lg 28 (좌우 12·위아래 6, 글자 14 SemiBold — 등수·배너 위 칩).
 * 아이콘은 children으로 넣는다.
 * 글자 크기는 text-xs/text-sm으로 둔다 — 커스텀 타이포 토큰은 공용 cn이 글자색과 같은 묶음으로 보고 색을 지운다
 */
const badgeVariants = cva(
    "inline-flex text-xs leading-[1.125rem] font-medium shrink-0 items-center gap-1 rounded-full border border-transparent whitespace-nowrap [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                brand: 'bg-brand-primary text-fg-on-brand',
                info: 'bg-status-active text-status-active-text border-status-active-text',
                neutral: 'bg-surface-sunken text-fg-secondary',
                accent: 'bg-ticket-accent text-fg-primary',
                // 진한 노랑 알약 — D-day처럼 눈에 먼저 들어와야 하는 표시에만 (버튼 accent와 같은 색)
                highlight: 'bg-ticket-primary text-ticket-on',
                outline: 'bg-surface-page text-fg-secondary border-border-default',
                // 흰 바탕 알약 — 배너 위 마감 시간처럼 색 배경 위에 띄울 때
                surface: 'bg-surface-page text-fg-primary',
                // 검정 알약 — 이벤트 카드 D-day처럼 무채색 위계에서 가장 진하게
                inverse: 'bg-action-neutral text-fg-on-brand',
            },
            size: {
                sm: 'h-5.5 px-2 py-0.5',
                md: 'h-6.5 px-3 py-1',
                // 등수·배너 위 칩 — 글자 14 SemiBold (피그마 Label SM, 줄 높이 16)
                lg: 'h-7 px-3 py-1.5 text-sm leading-4 font-semibold',
                // 이전 이름 — lg와 같다 (배너 마감 시간에서 쓰던 34 알약을 lg로 합쳤다)
                xl: 'h-7 px-3 py-1.5 text-sm leading-4 font-semibold',
            },
        },
        defaultVariants: {
            variant: 'neutral',
            size: 'md',
        },
    },
);

function Badge({
    className,
    variant,
    size,
    ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
    return (
        <span
            data-slot="badge"
            className={cn(badgeVariants({ variant, size }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
