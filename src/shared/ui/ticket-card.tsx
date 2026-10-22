import { cn } from 'cn';
import * as React from 'react';

import { Card } from '@shared/ui/card';

/** 펀칭 구멍 반지름 — 피그마 Group 633903의 지름 26.8 원 */
const PUNCH_RADIUS = 13.4;

/** 도려낸 카드 모양을 따라 상하좌우로 1px씩 border/default 색을 번지게 해 윤곽선을 만든다 */
const CARD_OUTLINE = ['1px 0', '-1px 0', '0 1px', '0 -1px']
    .map((offset) => `drop-shadow(${offset} 0 var(--color-border-default))`)
    .join(' ');

/** 카드 그림자 — shadow/md와 같은 값. 도려낸 모양을 따라가도록 box-shadow 대신 filter로 건다 */
const CARD_SHADOW =
    'drop-shadow(0 4px 6px rgb(from var(--color-ink) r g b / 0.08)) drop-shadow(0 2px 4px rgb(from var(--color-ink) r g b / 0.06))';

const punchMask = (y: string) =>
    [
        `radial-gradient(circle ${PUNCH_RADIUS}px at left ${y}, transparent 98%, black 100%)`,
        `radial-gradient(circle ${PUNCH_RADIUS}px at right ${y}, transparent 98%, black 100%)`,
    ].join(', ');

/**
 * 티켓 카드 — 공용 Card 위에 응모권처럼 좌우 펀칭과 점선 절취선을 더한다 (피그마 Group 633903).
 * children은 절취선 위, stub은 절취선 아래(응모권 수·버튼 등)에 놓인다.
 * 펀칭은 실제로 도려내 어느 배경 위에서도 배경이 비치고, 위치는 절취선 높이를 재서 자동으로 맞춘다
 */
function TicketCard({
    children,
    stub,
    className,
    cardClassName,
}: {
    children: React.ReactNode;
    stub: React.ReactNode;
    /** 바깥 틀 — 크기·호버 이동 등 */
    className?: string;
    /** 카드 안쪽 — 배경색·간격 등 */
    cardClassName?: string;
}) {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const tearRef = React.useRef<HTMLDivElement>(null);
    const [punchY, setPunchY] = React.useState<number | null>(null);

    // 절취선의 카드 안 높이를 재 펀칭 중심으로 쓴다 — 글자 크기 설정·내용 길이가 바뀌어도 따라간다
    React.useLayoutEffect(() => {
        const card = cardRef.current;
        const tear = tearRef.current;
        if (!card || !tear) return;
        const measure = () => {
            const y =
                tear.getBoundingClientRect().top -
                card.getBoundingClientRect().top +
                tear.offsetHeight / 2;
            setPunchY(Math.round(y * 2) / 2);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(card);
        // 카드 높이가 고정돼도 절취선 아래(stub) 내용 높이가 바뀌면 절취선 위치가 움직인다
        if (tear.parentElement) observer.observe(tear.parentElement);
        return () => observer.disconnect();
    }, []);

    const mask = punchY == null ? undefined : punchMask(`${punchY}px`);

    return (
        <div
            data-slot="ticket-card"
            className={cn('shrink-0', className)}
            style={{ filter: CARD_SHADOW }}
        >
            <div className="h-full" style={{ filter: CARD_OUTLINE }}>
                <Card
                    ref={cardRef}
                    // group/ticket — 카드에 마우스를 올리면 TicketCardMedia 그림이 확대된다
                    className={cn(
                        'group/ticket h-full gap-0 border-0 p-4 shadow-none',
                        cardClassName,
                    )}
                    style={{ maskImage: mask, maskComposite: 'intersect' }}
                >
                    {children}
                    <div className="mt-auto flex flex-col">
                        {/* 절취선 — 펀칭 사이를 좌우 12px씩 띄운 점선 */}
                        <div
                            ref={tearRef}
                            aria-hidden
                            className="border-border-default mx-3 border-t border-dashed"
                        />
                        {stub}
                    </div>
                </Card>
            </div>
        </div>
    );
}

/**
 * 티켓 카드 위쪽 그림 칸(높이 120) — 카드에 마우스를 올리거나 카드 안 버튼에 초점이 가면 그림이 칸 안에서 살짝 확대된다.
 * 카드는 움직이지 않고 그림만 움직인다. 동작 줄이기 설정이면 확대하지 않는다. 그림이 없으면 회색 칸에 fallback(아이콘 등)을 둔다
 */
function TicketCardMedia({
    src,
    fallback,
    fit = 'cover',
    position,
}: {
    src?: string | null;
    fallback: React.ReactNode;
    /** cover: 칸을 꽉 채운다(게임 썸네일), contain: 그림 전체를 보인다(바탕 투명한 미션 그림) */
    fit?: 'cover' | 'contain';
    /** cover로 잘릴 때 남길 기준점(object-position) — 예: '50% 20%' */
    position?: string;
}) {
    return (
        <div
            className={cn(
                'flex h-30 shrink-0 items-center justify-center overflow-hidden rounded-lg',
                !src && 'bg-surface-canvas',
            )}
        >
            {src ? (
                <img
                    src={src}
                    alt=""
                    style={position ? { objectPosition: position } : undefined}
                    className={cn(
                        'size-full transition-transform duration-300 ease-out group-focus-within/ticket:scale-105 group-hover/ticket:scale-105 motion-reduce:transition-none motion-reduce:group-focus-within/ticket:scale-100 motion-reduce:group-hover/ticket:scale-100',
                        fit === 'cover' ? 'object-cover' : 'object-contain',
                    )}
                />
            ) : (
                fallback
            )}
        </div>
    );
}

export {
    CARD_OUTLINE as TICKET_OUTLINE_FILTER,
    CARD_SHADOW as TICKET_SHADOW_FILTER,
    TicketCard,
    TicketCardMedia,
};
