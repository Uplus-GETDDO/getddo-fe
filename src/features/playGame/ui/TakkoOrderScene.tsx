import { motion } from 'framer-motion';

import { TAKKO_ORDER_PROPS, TAKKO_ORDER_SCENE, TAKKO_ORDER_WALL } from '../model/takkoOrderAssets';

/**
 * 타코야끼 가게 장면 — 노렌·문어 장식·선반·창문·나무 카운터·소품과 카운터 뒤 손님.
 * 그림이라 다크에서도 라이트 색이다
 */
export function TakkoOrderScene({
    showCustomer,
    customer,
    customerSrc,
}: {
    /** 게임 중·끝난 뒤 손님을 보여 준다 — 게임이 끝나도 마지막 손님은 그대로 남긴다 */
    showCustomer: boolean;
    customer: number;
    customerSrc: string;
}) {
    return (
        <>
            {/* 문어 장식(image 248) — 노렌 양옆 들보에 매달아 둔다 */}
            {(['left-[30%]', 'right-[30%]'] as const).map((side) => (
                <img
                    key={side}
                    src={TAKKO_ORDER_WALL.octopus}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className={`pointer-events-none absolute top-[5%] ${side} w-[4.5%] [image-rendering:pixelated]`}
                />
            ))}
            {/* 노렌(image 245) — 위 가운데 */}
            <img
                src={TAKKO_ORDER_SCENE.noren}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute top-[7%] left-1/2 w-[30%] -translate-x-1/2 [image-rendering:pixelated]"
            />
            {/* 선반(image 245) — 오른쪽 벽, 작게 */}
            <img
                src={TAKKO_ORDER_SCENE.shelf}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute top-[28%] right-[3%] w-[24%] [image-rendering:pixelated]"
            />

            {/* 창문(image 251) — 손님 뒤 벽. 말풍선에 가려지지 않게 손님 오른쪽 어깨 뒤로 비켜 둔다 */}
            <img
                src={TAKKO_ORDER_WALL.window}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute top-[28%] left-[23%] w-[19%] [image-rendering:pixelated]"
            />

            {/* 손님 — 왼쪽, 카운터 뒤. 모든 손님을 같은 키로 맞춰 발이 늘 카운터에 가린다 (키가 작아도 떠 보이지 않게) */}
            {showCustomer && (
                <motion.img
                    key={`customer-${customer}`}
                    src={customerSrc}
                    alt=""
                    aria-hidden
                    draggable={false}
                    initial={{ y: '20%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="pointer-events-none absolute bottom-[13%] left-[11%] w-[21%] [image-rendering:pixelated]"
                />
            )}

            {/* 나무 카운터(image 246) — 양끝이 마감된 한 장이라 판보다 넓게 깔아 끝을 판 밖으로 뺀다. 손님 아래쪽을 가린다 */}
            <img
                src={TAKKO_ORDER_SCENE.counter}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute -bottom-[1%] left-[-12%] w-[124%] max-w-none [image-rendering:pixelated]"
            />

            {/* 카운터 위 소품 — 꼬치 통(image 250)은 손님 앞 왼쪽 끝, 소스 받침과 포장 상자는 오른쪽 끝에 겹쳐 모은다.
                윗면 안쪽(뒤)은 조금 위에, 바깥쪽(앞)은 조금 아래에 두어 깊이를 준다. 접시는 피한다 */}
            <img
                src={TAKKO_ORDER_PROPS.sticks}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute bottom-[21%] left-[3.5%] h-[10%] w-auto [image-rendering:pixelated]"
            />
            <img
                src={TAKKO_ORDER_PROPS.sauces}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute right-[9%] bottom-[23.5%] h-[8.5%] w-auto [image-rendering:pixelated]"
            />
            <img
                src={TAKKO_ORDER_PROPS.boxes}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute right-[3%] bottom-[21%] h-[9.5%] w-auto [image-rendering:pixelated]"
            />
        </>
    );
}
