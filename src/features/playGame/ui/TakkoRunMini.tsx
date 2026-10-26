import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import type { RunPhase, RunState } from '../model/takkoRun';
import type { TakkoRunSprites } from '../model/takkoRunAssets';

import { PIXEL_FONT } from '../model/pixelFont';
import {
    createRun,
    GROUND_Y,
    pressJump,
    releaseJump,
    RUNNER_SIZE,
    RUNNER_X,
    runnerFrame,
    scoreOf,
    stepRun,
    WORLD_WIDTH,
} from '../model/takkoRun';
import { loadTakkoRunSprites } from '../model/takkoRunAssets';
import { ATLAS_SCALE, CHARACTER_FRAMES, OBSTACLE_SPRITES, pick } from '../model/takkoRunAtlas';

/** 게임 화면에서 잘라 보이는 띠 — 가장 높이 뛴 캐릭터 머리부터 땅 아래 자갈까지 */
const VIEW_TOP = GROUND_Y - 280;
const VIEW_HEIGHT = 310;
/** 탭을 오래 두고 돌아오면 한 번에 크게 건너뛰지 않게 한 프레임 시간을 묶는다 */
const MAX_DT = 1 / 30;
const JUMP_KEYS = new Set(['Space', 'ArrowUp']);

/** 땅 아래 자갈 — 거리만큼 왼쪽으로 흘러 달리는 느낌을 준다. 자리·길이는 고정 값이라 매번 같은 모양이다 */
const PEBBLES = Array.from({ length: 14 }, (_, i) => ({
    x: (i * 61 + i * i * 13) % 900,
    y: GROUND_Y + 10 + (i % 3) * 7,
    width: 4 + (i % 4) * 5,
}));

function draw(
    ctx: CanvasRenderingContext2D,
    run: RunState,
    sprites: TakkoRunSprites,
    ink: string,
    reduceMotion: boolean,
) {
    ctx.clearRect(0, VIEW_TOP, WORLD_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = ink;

    // 길바닥 — 선 하나와 흘러가는 자갈 (공룡 달리기처럼 배경 없이)
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, 3);
    for (const pebble of PEBBLES) {
        const x = ((((pebble.x - run.distance) % 900) + 900) % 900) - 30;
        ctx.fillRect(x, pebble.y, pebble.width, 3);
    }

    for (const obstacle of run.obstacles) {
        const { sheet, rect } = pick(OBSTACLE_SPRITES, obstacle.sprite);
        const [sx, sy, sw, sh] = rect;
        ctx.drawImage(
            sprites[sheet],
            sx,
            sy,
            sw,
            sh,
            obstacle.x,
            GROUND_Y - obstacle.height + 4,
            sw * ATLAS_SCALE,
            sh * ATLAS_SCALE,
        );
    }

    // 대기 중에는 제자리에서 통통 튄다 — 누르면 달린다는 신호. 동작 줄이기 설정이면 가만히 선다 (점프는 직접 누른 것이라 그대로)
    const bob =
        run.phase === 'ready' && !reduceMotion ? Math.abs(Math.sin(run.elapsed * 4)) * 6 : 0;
    const [sx, sy, sw, sh] = pick(CHARACTER_FRAMES, runnerFrame(run));
    ctx.drawImage(
        sprites.character,
        sx,
        sy,
        sw,
        sh,
        RUNNER_X,
        GROUND_Y - run.height - RUNNER_SIZE + 2 - bob,
        RUNNER_SIZE,
        RUNNER_SIZE,
    );
}

/** 시작·점프·다시 하기를 한 동작으로 — 끝난 판이면 새 판을 만들어 바로 뛴다 */
function startOrJump(runRef: { current: RunState }): RunPhase {
    if (runRef.current.phase === 'over') runRef.current = createRun();
    pressJump(runRef.current);
    return runRef.current.phase;
}

/** 입력이 다른 조작(버튼·링크·입력칸)을 가로채지 않게, 화면 바탕이나 게임 칸에 초점이 있을 때만 받는다 */
function isFreeTarget(target: EventTarget | null, container: HTMLElement | null) {
    if (!(target instanceof HTMLElement)) return true;
    if (target === document.body || target === container) return true;
    return !target.closest('a, button, input, textarea, select, [contenteditable="true"]');
}

/**
 * 404 화면의 타꼬런 — 크롬 공룡 달리기처럼 배경 없이 길바닥·장애물·타코야끼만 둔다.
 * 스페이스(↑)나 화면 탭으로 바로 시작하고, 부딪히면 같은 키로 다시 한다.
 * 기록·보상은 남기지 않는다 — 없는 주소로 들어와 응모권을 받는 길이 되면 안 된다.
 * 타꼬런 본게임과 같은 규칙(model/takkoRun)을 써서 점프감이 같다
 */
export function TakkoRunMini({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const runRef = useRef<RunState>(createRun());
    const [sprites, setSprites] = useState<TakkoRunSprites | null>(null);
    const [phase, setPhase] = useState<RunPhase>('ready');
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const reduceMotion = useReducedMotion() ?? false;

    useEffect(() => {
        let alive = true;
        loadTakkoRunSprites()
            .then((loaded) => alive && setSprites(loaded))
            // 그림을 못 받으면 게임 칸 없이 글자만 남는다
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);

    // 그리기 — 점수는 바뀔 때만 상태로 올려 다시 그리기를 줄인다
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !sprites) return;
        let frame = 0;
        let last = performance.now();
        let shownScore = -1;
        const tick = (now: number) => {
            const run = runRef.current;
            const dt = Math.min(MAX_DT, (now - last) / 1000);
            last = now;
            if (stepRun(run, dt)) {
                setPhase('over');
                setBest((value) => Math.max(value, scoreOf(run)));
            }
            const nextScore = scoreOf(run);
            if (nextScore !== shownScore) {
                shownScore = nextScore;
                setScore(nextScore);
            }
            // 칸 폭이 바뀌면 화소 수를 다시 맞춘다 — 레티나에서도 도트가 흐리지 않게
            const ratio = window.devicePixelRatio || 1;
            const width = Math.round(canvas.clientWidth * ratio);
            const height = Math.round((width * VIEW_HEIGHT) / WORLD_WIDTH);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            const scale = width / WORLD_WIDTH;
            ctx.setTransform(scale, 0, 0, scale, 0, -VIEW_TOP * scale);
            ctx.imageSmoothingEnabled = false;
            // 길바닥은 글자색을 따른다 — 다크 모드에서도 바탕과 대비가 맞는다
            draw(ctx, run, sprites, getComputedStyle(canvas).color, reduceMotion);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [sprites, reduceMotion]);

    const press = () => setPhase(startOrJump(runRef));

    // 입력은 그림을 받은 뒤에만 받는다 — 못 받았는데 스페이스를 막고 판만 바꾸면 빈 칸에 점수만 보였다
    useEffect(() => {
        if (!sprites) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (!JUMP_KEYS.has(event.code) || !isFreeTarget(event.target, containerRef.current))
                return;
            // 스페이스가 화면을 내리지 않게 막는다
            event.preventDefault();
            if (!event.repeat) setPhase(startOrJump(runRef));
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (JUMP_KEYS.has(event.code)) releaseJump(runRef.current);
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [sprites]);

    const hint = !sprites
        ? null
        : phase === 'ready'
          ? '스페이스 · 탭으로 달리기'
          : phase === 'over'
            ? '꽝! 다시 하려면 스페이스 · 탭'
            : null;

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label="ERROR 404 — 스페이스나 탭으로 타코야끼를 달리게 하는 작은 게임"
            className={`text-fg-primary relative w-full touch-manipulation select-none ${className ?? ''}`}
            onPointerDown={(event) => {
                if (sprites && event.button === 0) press();
            }}
            onPointerUp={() => releaseJump(runRef.current)}
        >
            <p
                aria-hidden
                className={`${PIXEL_FONT} text-center text-[clamp(1.75rem,6vw,3.25rem)] leading-none tracking-[0.3em]`}
            >
                ERROR 404
            </p>
            <div aria-hidden className="relative mt-4">
                <canvas ref={canvasRef} className="block aspect-[840/310] w-full" />
                {/* 점수 — 달리기 시작한 뒤에만, 최고 기록은 이번 방문 동안만 기억한다 */}
                {phase !== 'ready' && (
                    <p
                        className={`${PIXEL_FONT} text-fg-secondary absolute top-1 right-1 text-sm tabular-nums`}
                    >
                        {best > 0 && (
                            <span className="text-fg-tertiary mr-3">
                                HI {String(best).padStart(5, '0')}
                            </span>
                        )}
                        {String(score).padStart(5, '0')}
                    </p>
                )}
                {hint && (
                    <p
                        className={`${PIXEL_FONT} text-fg-tertiary absolute inset-x-0 top-[38%] text-center text-sm`}
                    >
                        {hint}
                    </p>
                )}
            </div>
        </div>
    );
}
