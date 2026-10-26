import { motion } from 'framer-motion';
import { useState } from 'react';

import rewardMascot from '@shared/assets/ui/reward-mascot.png';

import type { TicketGrade } from '../model/types';

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
import { TICKET_GRADE_IMAGE } from '../model/gradeImage';

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
    /** 흔들린 뒤 앉는 자리 — 제자리에서 조금 밀린 곳 */
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
    return BALL_SRCS.map((src, i) => {
        const home = homes[i]!;
        return {
            src,
            home,
            // 흔들린 뒤에는 제자리 근처로 조금 밀려 앉는다 — 다시 정렬되거나 크게 자리를 바꾸지 않게
            settle: {
                x: home.x + (rand() * 2 - 1) * 4,
                y: home.y,
                rotate: home.rotate + (rand() * 2 - 1) * 40,
            },
            seed: seed + i * 97,
        };
    });
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

/** 손잡이가 도는 시간 — 기계가 흔들리는 시간과 같다 */
const SPIN_DURATION = 1.1;

/*
 * 손잡이를 돌릴 때의 흔들림 — 기계는 바닥을 축으로 좌우로 까딱이며 점점 잦아들고,
 * 공은 같은 박자에 반대쪽으로 쏠리며(관성) 방향이 바뀔 때 살짝 들썩인다. 끝은 모두 제자리
 */
const SWAY_TIMES = [0, 0.14, 0.32, 0.5, 0.68, 0.84, 1];
const SWAY_MACHINE_ROTATE = [0, -3, 2.6, -2, 1.4, -0.6, 0];
const SWAY_MACHINE_X = [0, -2, 1.8, -1.4, 1, -0.4, 0];
const SWAY_BALL_X = [0, 5, -4.5, 3.5, -2.5, 1, 0];
const SWAY_BALL_LIFT = [0, 3, 4, 3, 2, 1, 0];

/**
 * 공 하나의 움직임 — 회전은 옮겨 간 거리만큼 줘 실제로 구르는 것처럼 보이게 한다.
 * idle: 쉬는 자리 둘레를 좌우로 데굴데굴 구르다 가끔 낮게 통통 (반복)
 * spinning: 손잡이를 돌리면 기계가 좌우로 흔들리고, 공은 관성으로 반 박자 늦게 반대쪽으로 쏠렸다 돌아온다 (손잡이가 도는 동안 한 번)
 * dropping: 흔들림이 끝난 뒤 제자리 근처로 살짝 밀려 통 튀며 앉는다
 */
function ballMotion(ball: Ball, phase: GachaPhase) {
    const rand = seeded(ball.seed + (phase === 'spinning' ? 13 : 1));
    if (phase === 'spinning') {
        const { home } = ball;
        // 공마다 쏠림 크기를 조금씩 달리해 한 덩어리로 움직이지 않게 한다
        const weight = 0.75 + rand() * 0.5;
        const x = SWAY_BALL_X.map((dx) => home.x + dx * weight);
        const y = SWAY_BALL_LIFT.map((dy) => home.y - dy * weight);
        const rotate = x.map((nx) => home.rotate + (nx - home.x) * ROLL_DEG_PER_PX);
        return {
            animate: { x, y, rotate },
            transition: {
                duration: SPIN_DURATION,
                times: SWAY_TIMES,
                ease: 'easeInOut' as const,
                delay: rand() * 0.06,
            },
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
                        // 바닥을 축으로 까딱인다
                        className="absolute top-0 left-1/2 -ml-15 origin-bottom"
                        style={{ width: MACHINE_W }}
                        animate={
                            phase === 'dropping'
                                ? { opacity: 0, scale: 0.85, y: -6 }
                                : shaking
                                  ? {
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                        x: SWAY_MACHINE_X,
                                        rotate: SWAY_MACHINE_ROTATE,
                                    }
                                  : { opacity: 1, scale: 1, y: 0, rotate: 0 }
                        }
                        transition={
                            phase === 'dropping'
                                ? { delay: 0.9, duration: 0.5, ease: 'easeIn' }
                                : shaking
                                  ? {
                                        duration: SPIN_DURATION,
                                        times: SWAY_TIMES,
                                        ease: 'easeInOut',
                                    }
                                  : { duration: 0.3 }
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
                        {/* 손잡이 뒤 빛 — 뽑기 전에만 천천히 커졌다 작아지며 누를 곳을 알린다 */}
                        {phase === 'idle' && !reduceMotion && (
                            <motion.span
                                aria-hidden
                                className="pointer-events-none absolute top-[76%] left-1/2 size-26 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--color-ticket-primary)_0%,var(--color-ticket-primary)_38%,transparent_72%)]"
                                initial={{ scale: 0.7, opacity: 0.45 }}
                                animate={{ scale: [0.7, 1.05, 0.7], opacity: [0.45, 0.9, 0.45] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        )}
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
                            className="absolute top-1/2 left-1/2 -mt-20 -ml-20 size-40 max-w-none object-contain"
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
                            className="absolute top-1/2 left-1/2 -ml-9 w-18"
                            initial={reduceMotion ? false : { y: 4 }}
                            animate={{ y: 27 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                        />
                        <motion.img
                            src={reward}
                            alt=""
                            draggable={false}
                            className="absolute top-1/2 left-1/2 -mt-8.5 -ml-14 h-17 w-28 object-contain drop-shadow-md"
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
                            className="absolute top-1/2 left-1/2 -mt-10 -ml-9.5 w-19"
                            initial={reduceMotion ? false : { y: 0, x: 0, rotate: 0 }}
                            animate={{ y: -40, x: -20, rotate: -22 }}
                            transition={{ type: 'spring', stiffness: 150, damping: 13 }}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
