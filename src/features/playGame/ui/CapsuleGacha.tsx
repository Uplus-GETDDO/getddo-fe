import { motion } from 'framer-motion';
import { useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import { TICKET_GRADE_IMAGE } from '@entities/ticket';
import rewardMascot from '@shared/assets/ui/reward-mascot.png';

import ballGreen from '../assets/capsule/ball-green.png';
import ballOrange from '../assets/capsule/ball-orange.png';
import ballPicked from '../assets/capsule/ball-picked.png';
import ballPink from '../assets/capsule/ball-pink.png';
import ballPurple from '../assets/capsule/ball-purple.png';
import capsuleBottom from '../assets/capsule/capsule-bottom.png';
import capsuleTop from '../assets/capsule/capsule-top.png';
import handle from '../assets/capsule/handle.png';
import machine from '../assets/capsule/machine.png';
import sparkle from '../assets/capsule/sparkle.png';

/** 뽑기 진행 — 대기(공이 통통) → 손잡이 회전 → 캡슐이 나옴 → 캡슐 흔들림 → 열려 보상 공개 */
export type GachaPhase = 'idle' | 'spinning' | 'dropping' | 'opening' | 'revealed';

/*
 * 자리 기준 — 무대 248×184, 기계 120×177 (피그마 image 281을 투명 경계로 자른 비율 765:1130).
 * 유리 안쪽(공이 노는 곳)은 기계의 가로 20~80%·세로 29~57%, 손잡이 구멍 중심은 (50%, 76%), 배출구는 (50%, 89%)
 */
const MACHINE_W = 120;
const BALL = 26;
const BALL_FLOOR = 100;
/** 무대 가운데(캡슐이 열리는 자리)에서 배출구까지 거리 */
const CHUTE_OFFSET = 66;

/** 안쪽 공 색 — 피그마 279·280·283·284를 섞어 일곱 개 */
const BALL_SRCS = [ballPink, ballGreen, ballPurple, ballOrange, ballPurple, ballOrange, ballPink];
/** 쉬는 자리 — 바닥에 넷, 그 위에 셋을 쌓아 겹치지 않게 둔다. 어느 공이 어디에 앉을지는 열 때마다 섞는다 */
const SLOTS = [
    { x: 34, y: BALL_FLOOR },
    { x: 52, y: BALL_FLOOR },
    { x: 70, y: BALL_FLOOR },
    { x: 87, y: BALL_FLOOR },
    { x: 43, y: BALL_FLOOR - 19 },
    { x: 61, y: BALL_FLOOR - 20 },
    { x: 79, y: BALL_FLOOR - 19 },
];

interface Spot {
    x: number;
    y: number;
    rotate: number;
}

interface Ball {
    src: string;
    /** 처음 앉아 있는 자리 */
    home: Spot;
    /** 손잡이를 돌린 뒤 떨어져 앉는 자리 — 처음과 다른 자리로 섞는다 */
    settle: Spot;
    seed: number;
}

/** 자리를 섞고 조금씩 비틀어 매번 다른 모습으로 시작한다 */
function shuffledSpots(rand: () => number): Spot[] {
    const order = SLOTS.map((slot) => ({ slot, key: rand() }));
    order.sort((a, b) => a.key - b.key);
    return order.map(({ slot }) => ({
        x: slot.x + (rand() * 2 - 1) * 3,
        y: slot.y,
        rotate: (rand() * 2 - 1) * 70,
    }));
}

function createBalls(seed: number): Ball[] {
    const rand = seeded(seed);
    const homes = shuffledSpots(rand);
    const settles = shuffledSpots(rand);
    return BALL_SRCS.map((src, i) => ({
        src,
        home: homes[i]!,
        settle: settles[i]!,
        seed: seed + i * 97,
    }));
}

/** 공마다 같은 시드면 같은 궤적 (mulberry32) */
function seeded(seed: number) {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** 공이 1px 구를 때 도는 각도 — 지름 BALL인 공이 미끄러지지 않고 구르는 것처럼 */
const ROLL_DEG_PER_PX = 360 / (Math.PI * BALL);

/** 손잡이가 도는 시간 — 공이 유리 안을 튀는 시간과 같다 */
const SPIN_DURATION = 1.1;

/**
 * 공 하나의 움직임 — 회전은 옮겨 간 거리만큼 줘 실제로 구르는 것처럼 보이게 한다.
 * idle: 쉬는 자리 둘레를 좌우로 데굴데굴 구르다 가끔 낮게 통통 (반복)
 * spinning: 손잡이가 도는 동안 제자리 둘레에서 짧고 불규칙하게 덜그럭 — 크게 날지 않고 들썩이며 새 자리 쪽으로 조금씩 밀린다
 * dropping: 튀던 자리에서 새 자리로 떨어져 통 튀며 앉는다 — 처음 자리로 되돌아가 정렬되지 않게
 */
function ballMotion(ball: Ball, phase: GachaPhase) {
    const rand = seeded(ball.seed + (phase === 'spinning' ? 13 : 1));
    if (phase === 'spinning') {
        const x: (number | null)[] = [null];
        const y: (number | null)[] = [null];
        const rotate: (number | null)[] = [null];
        const steps = 12;
        let lastX = ball.home.x;
        let lastR = ball.home.rotate;
        for (let i = 1; i <= steps; i++) {
            // 흔들리며 새 자리 쪽으로 70%까지 밀려 간다 — 나머지는 배출될 때 떨어져 앉는다
            const t = (i / steps) * 0.7;
            const cx = ball.home.x + (ball.settle.x - ball.home.x) * t;
            const cy = ball.home.y + (ball.settle.y - ball.home.y) * t;
            const nx = cx + (rand() * 2 - 1) * 3;
            // 짝수 칸은 바닥에 부딪히고 홀수 칸은 살짝 들썩인다
            const ny = i % 2 === 1 ? cy - 3 - rand() * 5 : cy;
            lastR += (nx - lastX) * ROLL_DEG_PER_PX + (rand() * 2 - 1) * 12;
            lastX = nx;
            x.push(nx);
            y.push(ny);
            rotate.push(lastR);
        }
        return {
            animate: { x, y, rotate },
            transition: { duration: SPIN_DURATION, ease: 'easeOut' as const },
        };
    }
    if (phase === 'dropping') {
        return {
            animate: { x: ball.settle.x, y: ball.settle.y, rotate: ball.settle.rotate },
            transition: {
                // 떨어져 바닥에 닿으며 통 튄다
                y: { type: 'spring' as const, stiffness: 260, damping: 11, mass: 0.8 },
                x: { duration: 0.6, ease: 'easeOut' as const },
                rotate: { duration: 0.7, ease: 'easeOut' as const },
            },
        };
    }
    const { home } = ball;
    // 위층 공은 아래층에 얹혀 있어 덜 구른다
    const roll = home.y < BALL_FLOOR ? 4 : 7;
    const x = [home.x];
    const y = [home.y];
    const rotate = [home.rotate];
    for (let i = 1; i < 8; i++) {
        x.push(home.x + (rand() * 2 - 1) * roll);
        // 가끔(다섯에 하나꼴) 낮게 통통 — 나머지는 바닥을 구른다
        y.push(rand() < 0.2 ? home.y - 5 - rand() * 4 : home.y);
        rotate.push(rotate[i - 1]! + (x[i]! - x[i - 1]!) * ROLL_DEG_PER_PX);
    }
    // 끝은 쉬는 자리 — 반복할 때 튀지 않는다 (돌아오며 굴러 회전도 처음 각도로 맞춰진다)
    x.push(home.x);
    y.push(home.y);
    rotate.push(home.rotate);
    return {
        animate: { x, y, rotate },
        transition: {
            duration: 2.4 + rand(),
            repeat: Infinity,
            ease: 'easeInOut' as const,
            delay: rand() * 0.8,
        },
    };
}

/**
 * 캡슐 뽑기 연출 — 게임 보상 모달 안에서 기계 속 캡슐이 통통 튀다가, 손잡이를 돌리면 캡슐 하나가 나와 열리며 받은 응모권을 보여 준다.
 * 피그마 '최종 융합 프로젝트' 1115:802 — 기계 281, 손잡이 282, 안쪽 공 279·280·283·284, 뽑힌 공 285, 윗·아랫 뚜껑 289·288, 반짝임 287.
 * 진행 상태는 부모(보상 모달)가 들고, 이 컴포넌트는 단계별 그림과 다음 단계로 넘길 때만 알린다.
 * 동작 줄이기 설정이면 부모가 처음부터 'revealed'로 넘긴다 (열린 캡슐과 응모권만 그린다)
 * grade: 받은 응모권 등급 — 없으면 응모권을 든 타코야끼를 보여 준다
 */
export function CapsuleGacha({
    phase,
    onPhaseChange,
    grade,
    reduceMotion = false,
}: {
    phase: GachaPhase;
    onPhaseChange: (next: GachaPhase) => void;
    grade?: TicketGrade | null;
    reduceMotion?: boolean;
}) {
    const shaking = phase === 'spinning';
    // 모달을 열 때마다 공 자리를 새로 섞는다 (첫 렌더에 한 번만)
    const [balls] = useState(() => createBalls(Math.floor(Math.random() * 1e9)));
    const reward = grade ? TICKET_GRADE_IMAGE[grade] : rewardMascot;

    return (
        // 무대는 248×184 고정 — 모달이 낮아져도 줄지 않게 하고, 좁은 화면에서는 통째로 줄인다
        <div className="h-46 w-62 shrink-0 select-none max-sm:h-34.5" aria-hidden>
            <div className="relative h-46 w-62 origin-top max-sm:scale-75">
                {/* 기계 — 캡슐이 나오면 뒤로 물러나며 사라진다 */}
                {phase !== 'opening' && phase !== 'revealed' && (
                    <motion.div
                        className="absolute top-0 left-1/2 -ml-15"
                        style={{ width: MACHINE_W }}
                        animate={
                            phase === 'dropping'
                                ? { opacity: 0, scale: 0.85, y: -6 }
                                : shaking
                                  ? {
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                        // 기계도 손잡이를 돌리는 힘에 잘게 떨린다
                                        x: [0, -1, 1, -0.5, 0.5, 0],
                                        rotate: [0, -0.6, 0.6, -0.4, 0.3, 0],
                                    }
                                  : { opacity: 1, scale: 1, y: 0, rotate: 0 }
                        }
                        transition={
                            phase === 'dropping'
                                ? { delay: 0.9, duration: 0.5, ease: 'easeIn' }
                                : { duration: 0.22, repeat: shaking ? Infinity : 0 }
                        }
                    >
                        {/* 안쪽 공 — 기계 그림 뒤에 두어 유리 너머로 보이고 바닥 턱에 살짝 가린다 */}
                        {balls.map((ball, i) => {
                            const { animate, transition } = ballMotion(ball, phase);
                            return (
                                <motion.img
                                    // 같은 공을 계속 써서 단계가 바뀌어도 지금 자리에서 이어 움직인다
                                    key={i}
                                    src={ball.src}
                                    alt=""
                                    draggable={false}
                                    className="absolute top-0 left-0"
                                    style={{
                                        width: BALL,
                                        marginLeft: -BALL / 2,
                                        marginTop: -BALL / 2,
                                    }}
                                    initial={{
                                        x: ball.home.x,
                                        y: ball.home.y,
                                        rotate: ball.home.rotate,
                                    }}
                                    animate={animate}
                                    transition={transition}
                                />
                            );
                        })}
                        <img src={machine} alt="" draggable={false} className="relative w-full" />
                        {/* 손잡이 — 누르면 뽑는다 (키보드·스크린리더는 아래 '보상 뽑기' 버튼을 쓴다) */}
                        <motion.button
                            type="button"
                            tabIndex={-1}
                            aria-hidden
                            disabled={phase !== 'idle'}
                            onClick={() => onPhaseChange('spinning')}
                            className="absolute top-[76%] left-1/2 w-[28%] -translate-x-1/2 -translate-y-1/2 cursor-pointer disabled:cursor-default"
                            whileHover={phase === 'idle' ? { scale: 1.08 } : undefined}
                            animate={shaking ? { rotate: 720 } : { rotate: 0 }}
                            transition={
                                shaking
                                    ? { duration: SPIN_DURATION, ease: [0.45, 0, 0.2, 1] }
                                    : { duration: 0 }
                            }
                            onAnimationComplete={() => {
                                if (shaking) onPhaseChange('dropping');
                            }}
                        >
                            <img src={handle} alt="" draggable={false} className="w-full" />
                        </motion.button>
                    </motion.div>
                )}

                {/* 뽑힌 캡슐 — 배출구에서 뿅 나와 한 바퀴 구르며 가운데로 올라온다 */}
                {(phase === 'dropping' || phase === 'opening') && (
                    <motion.img
                        src={ballPicked}
                        alt=""
                        draggable={false}
                        className="absolute top-1/2 left-1/2 -mt-10 -ml-10 size-20 object-contain drop-shadow-md"
                        initial={{ y: CHUTE_OFFSET, scale: 0.3, opacity: 0, rotate: 0 }}
                        animate={
                            phase === 'dropping'
                                ? {
                                      y: [CHUTE_OFFSET - 4, CHUTE_OFFSET + 6, -14, 0],
                                      scale: [0.3, 0.42, 1.08, 1],
                                      opacity: [0, 1, 1, 1],
                                      rotate: [0, 0, 300, 360],
                                  }
                                : // 열리기 전 달그락 — 좌우로 흔들고 살짝 눌린다
                                  {
                                      rotate: [0, -12, 10, -8, 6, 0],
                                      scaleY: [1, 1, 1, 1, 0.9, 1.05],
                                      scaleX: [1, 1, 1, 1, 1.08, 0.98],
                                  }
                        }
                        transition={
                            phase === 'dropping'
                                ? {
                                      delay: 0.35,
                                      duration: 1.5,
                                      times: [0, 0.25, 0.75, 1],
                                      ease: 'easeOut',
                                  }
                                : // 가운데에서 한 숨 쉬고 달그락
                                  { delay: 0.35, duration: 0.85, ease: 'easeInOut' }
                        }
                        onAnimationComplete={() => {
                            if (phase === 'dropping') onPhaseChange('opening');
                            else onPhaseChange('revealed');
                        }}
                    />
                )}

                {/* 열린 캡슐 — 뒤에 반짝임, 아랫뚜껑 위로 응모권이 솟고 윗뚜껑이 튕겨 열린다 */}
                {phase === 'revealed' && (
                    <>
                        <motion.img
                            src={sparkle}
                            alt=""
                            draggable={false}
                            className="absolute top-1/2 left-1/2 -mt-22 -ml-22 size-44 max-w-none object-contain"
                            initial={reduceMotion ? false : { opacity: 0, scale: 0.2, rotate: 0 }}
                            animate={
                                reduceMotion
                                    ? { opacity: 0.9 }
                                    : { opacity: 0.9, scale: 1, rotate: 360 }
                            }
                            transition={{
                                opacity: { duration: 0.5, delay: 0.25 },
                                scale: { type: 'spring', stiffness: 160, damping: 12, delay: 0.25 },
                                // 터진 뒤에는 천천히 계속 돈다
                                rotate: { duration: 16, ease: 'linear', repeat: Infinity },
                            }}
                        />
                        <motion.img
                            src={capsuleBottom}
                            alt=""
                            draggable={false}
                            className="absolute top-1/2 left-1/2 -ml-10 w-20"
                            initial={reduceMotion ? false : { y: 4 }}
                            animate={{ y: 30 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                        />
                        <motion.img
                            src={reward}
                            alt=""
                            draggable={false}
                            className="absolute top-1/2 left-1/2 -mt-8 -ml-13 h-16 w-26 object-contain drop-shadow-md"
                            initial={reduceMotion ? false : { y: 26, scale: 0.2, opacity: 0 }}
                            animate={{ y: -2, scale: 1, opacity: 1 }}
                            transition={{
                                type: 'spring',
                                stiffness: 220,
                                damping: 14,
                                delay: 0.4,
                            }}
                        />
                        <motion.img
                            src={capsuleTop}
                            alt=""
                            draggable={false}
                            className="absolute top-1/2 left-1/2 -mt-11 -ml-10.5 w-21"
                            initial={reduceMotion ? false : { y: 0, x: 0, rotate: 0 }}
                            animate={{ y: -44, x: -22, rotate: -22 }}
                            transition={{ type: 'spring', stiffness: 150, damping: 13 }}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
