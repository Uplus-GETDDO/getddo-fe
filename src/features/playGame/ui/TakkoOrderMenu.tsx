import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';

import type { TakkoOrderPhase } from '../hooks/useTakkoOrderGame';
import type { TakkoOrderItemId } from '../model/takkoOrder';

import { PIXEL_FONT } from '../model/pixelFont';
import { TAKKO_ORDER_MENU } from '../model/takkoOrder';
import { TAKKO_ORDER_IMAGES, TAKKO_ORDER_WRONG_IMAGE } from '../model/takkoOrderAssets';

/**
 * 아래 메뉴 버튼 4개와 지우기 — 그림과 키보드 번호만 두고 이름은 화면 낭독기로 읽는다 (도트 그림체)
 */
export function TakkoOrderMenu({
    phase,
    ok,
    lives,
    pickedEmpty,
    onPick,
    onUndo,
}: {
    phase: TakkoOrderPhase;
    ok: boolean;
    lives: number;
    pickedEmpty: boolean;
    onPick: (id: TakkoOrderItemId) => void;
    onUndo: () => void;
}) {
    return (
        <div className="absolute inset-x-0 bottom-[3%] flex justify-center gap-[2.5%] px-4">
            {TAKKO_ORDER_MENU.map((item, index) => (
                <button
                    key={item.id}
                    type="button"
                    disabled={phase !== 'input'}
                    onClick={() => onPick(item.id)}
                    // 마우스로 눌러도 초점이 남지 않게 — 남으면 다음 키 입력이 이 버튼을 누른다
                    onMouseDown={(event) => event.preventDefault()}
                    aria-label={`${index + 1}번 ${item.name} 내주기`}
                    className="border-fg-primary bg-ticket-accent focus-visible:ring-border-focus relative flex aspect-square w-[clamp(2rem,7.9cqw,4.75rem)] cursor-pointer items-center justify-center rounded-md border-[3px] shadow-[3px_3px_0_0_var(--color-fg-primary)] transition-transform focus-visible:ring-2 focus-visible:outline-none enabled:hover:-translate-y-0.5 enabled:active:translate-x-0.75 enabled:active:translate-y-0.75 enabled:active:shadow-none disabled:cursor-default"
                >
                    {/* 틀리면 메뉴가 잠깐 어지러운 타코야끼(image 235)로 바뀐다 */}
                    <motion.img
                        key={phase === 'reveal' && !ok ? `dizzy-${lives}` : item.id}
                        src={
                            phase === 'reveal' && !ok
                                ? TAKKO_ORDER_WRONG_IMAGE
                                : TAKKO_ORDER_IMAGES[item.id]
                        }
                        alt=""
                        draggable={false}
                        initial={phase === 'reveal' && !ok ? { rotate: -20, scale: 0.7 } : false}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                        className="size-[82%] [image-rendering:pixelated]"
                    />
                    <span
                        aria-hidden
                        className={`border-fg-primary bg-surface-page text-fg-primary absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-sm border-2 text-[0.625rem] sm:size-6 sm:text-xs ${PIXEL_FONT}`}
                    >
                        {index + 1}
                    </span>
                </button>
            ))}
            {/* 지우기 — 마지막으로 낸 메뉴 하나를 되돌린다 (Backspace). 메뉴 버튼과 구분되게 흰 바탕, 조금 떨어뜨려 둔다 */}
            <button
                type="button"
                disabled={phase !== 'input' || pickedEmpty}
                onClick={onUndo}
                onMouseDown={(event) => event.preventDefault()}
                aria-label="마지막으로 낸 메뉴 지우기"
                className="border-fg-primary bg-surface-page text-fg-primary focus-visible:ring-border-focus relative ml-[2%] flex aspect-square w-[clamp(2rem,7.9cqw,4.75rem)] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border-[3px] shadow-[3px_3px_0_0_var(--color-fg-primary)] transition-transform focus-visible:ring-2 focus-visible:outline-none enabled:hover:-translate-y-0.5 enabled:active:translate-x-0.75 enabled:active:translate-y-0.75 enabled:active:shadow-none disabled:cursor-default disabled:opacity-50"
            >
                <Delete aria-hidden className="size-[40%]" />
                <span className={`text-[0.625rem] leading-none @lg:text-xs ${PIXEL_FONT}`}>
                    지우기
                </span>
            </button>
        </div>
    );
}
