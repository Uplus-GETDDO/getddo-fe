import type { Ref } from 'react';

import { motion } from 'framer-motion';

import type { TakkoOrderPhase } from '../hooks/useTakkoOrderGame';
import type { TakkoOrderItemId } from '../model/takkoOrder';

import { PIXEL_FONT } from '../model/pixelFont';
import { takkoOrderCustomerLabel } from '../model/takkoOrder';
import { TAKKO_ORDER_IMAGES } from '../model/takkoOrderAssets';

/**
 * 주문 말풍선 — 손님 머리 위, 다른 게임 말풍선과 같은 도트 그림체(바탕은 가게 나무색과 어울리는 연한 브론즈).
 * 틀리면 흔들리며 정답 주문을 보여 준다. 게임 중에만 뜬다
 */
export function TakkoOrderBubble({
    boardScope,
    phase,
    ok,
    customer,
    lives,
    line,
    order,
    picked,
    showOrder,
    showMs,
    showTotal,
    slotSize,
    visible,
}: {
    /** 틀리면 이 말풍선이 좌우로 흔들린다 — 훅이 애니메이션을 걸 ref */
    boardScope: Ref<HTMLDivElement>;
    phase: TakkoOrderPhase;
    ok: boolean;
    customer: number;
    lives: number;
    line: string;
    order: TakkoOrderItemId[];
    picked: TakkoOrderItemId[];
    showOrder: boolean;
    showMs: number;
    showTotal: number;
    slotSize: string;
    visible: boolean;
}) {
    if (!visible) return null;
    return (
        <div
            ref={boardScope}
            className="border-fg-primary bg-grade-bronze-soft absolute bottom-[58%] left-[21.5%] flex -translate-x-1/2 flex-col items-center gap-1 rounded-md border-[3px] px-2 py-1.5 shadow-[3px_3px_0_0_var(--color-fg-primary)] sm:px-3 sm:py-2"
        >
            <p
                className={`text-fg-secondary text-[0.625rem] whitespace-nowrap sm:text-xs ${PIXEL_FONT}`}
            >
                {takkoOrderCustomerLabel(customer)}
            </p>
            <p className={`text-fg-primary text-xs whitespace-nowrap sm:text-sm ${PIXEL_FONT}`}>
                {line}
            </p>
            <div className="flex gap-1">
                {order.map((id, index) => (
                    <div
                        key={index}
                        style={{ width: slotSize }}
                        // 타코야끼 모양에 맞춰 둥근 칸. 틀렸을 때는 정답 주문을 보여 주며 내가 다르게 낸 칸에 빨간 테두리를 두른다
                        className={`bg-grade-bronze/20 flex aspect-square items-center justify-center rounded-full ${phase === 'reveal' && !ok && picked[index] !== id ? 'ring-semantic-error ring-2' : ''}`}
                    >
                        {showOrder ? (
                            <motion.img
                                key={`order-${customer}-${lives}-${index}`}
                                src={TAKKO_ORDER_IMAGES[id]}
                                alt=""
                                draggable={false}
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                // 보여 줄 때는 왼쪽부터 차례로 톡톡 나타난다
                                transition={{
                                    duration: 0.18,
                                    delay: phase === 'showing' ? index * 0.12 : 0,
                                }}
                                className="size-[90%] [image-rendering:pixelated]"
                            />
                        ) : (
                            <span
                                className={`text-grade-bronze text-[min(1rem,3cqw)] ${PIXEL_FONT}`}
                            >
                                ?
                            </span>
                        )}
                    </div>
                ))}
            </div>
            {/* 주문을 보여 주는 남은 시간 — 막대가 줄어들고 옆에 남은 초를 적는다 */}
            {phase === 'showing' && (
                <div className="flex w-full items-center gap-1.5" aria-hidden>
                    <div className="bg-grade-bronze/20 h-1.5 flex-1 overflow-hidden rounded-full">
                        <div
                            className="bg-grade-bronze h-full rounded-full"
                            style={{ width: `${(showMs / showTotal) * 100}%` }}
                        />
                    </div>
                    <span className={`text-fg-secondary text-[0.625rem] sm:text-xs ${PIXEL_FONT}`}>
                        {Math.ceil(showMs / 1000)}초
                    </span>
                </div>
            )}
            {/* 꼬리 — 테두리색 삼각형 위에 바탕색 삼각형을 겹쳐 도트 테두리처럼 (GameSpeechBubble과 같은 방식) */}
            <span className="bg-fg-primary absolute top-full left-1/2 size-3 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
            <span className="bg-grade-bronze-soft absolute top-full left-1/2 -mt-[3px] size-2 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        </div>
    );
}
