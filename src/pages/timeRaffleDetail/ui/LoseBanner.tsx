import { motion, useAnimate, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { useMyEventEntries } from '@entities/entry';
import { useEventList } from '@entities/event';
import { useSessionStore } from '@entities/user';
import { Button } from '@shared/ui/button';
import { KST_HOUR_MINUTE, formatKst, kstDayDiff } from '@shared/utils/date';
import { formatNumber, maskName } from '@shared/utils/format';

import loseBg from '../assets/lose-bg.webp';
import loseDeco from '../assets/lose-deco-right.webp';
import loseMascot from '../assets/lose-mascot.webp';

/**
 * 낙첨 배너.
 *
 * 본인 결과 조회(E09)가 LOST로 판정했을 때만 연다. 공개 명단에서 뒷자리를 못 찾았다는 것은
 * 입력을 잘못했을 수도 있어 낙첨의 근거가 되지 못한다.
 *
 * '떨어졌다'만 알리고 끝내지 않고 다음에 할 수 있는 일을 같이 둔다 — 쓴 응모권과 다음 래플이다.
 *
 * 그림은 세 겹이다 — 하늘 배경(피그마 image 220), 구름·응모권 장식(image 214 오른쪽 조각), 아쉬워하는 마스코트(image 222).
 * 슬프게 몰아가지 않도록 차분하게 연출한다: 배너가 떠오르고, 마스코트가 내려앉으며 고개를 갸웃하고,
 * 장식은 천천히 둥실거린다. 마우스를 올리면 마스코트가 제자리에서 천천히 한숨 쉬듯 기울었다 돌아온다
 * (처음부터 다시 그리지 않는다 · 종이 조각은 당첨 배너에만).
 */
export function LoseBanner({ event }: { event: Event }) {
    const userName = useSessionStore((state) => state.user?.name);
    const nextRaffle = useNextRaffle(event.id);
    const [scope, animate] = useAnimate<HTMLElement>();
    const inView = useInView(scope, { once: true, amount: 0.4 });
    const reduceMotion = useReducedMotion();
    const lastPlayAt = useRef(0);
    const replay = () => {
        if (reduceMotion) return;
        const now = Date.now();
        if (now - lastPlayAt.current < 1800) return;
        lastPlayAt.current = now;
        void animate(
            '[data-hover="mascot"]',
            { y: [0, 6, 0], rotate: [0, -7, 4, 0] },
            { duration: 1.8, ease: 'easeInOut' },
        );
    };

    // 이벤트 상세에는 내 응모 수가 없어 E06 접수 내역으로 계산한다 — 도착 전에는 pill을 숨긴다
    const { data: myEntries } = useMyEventEntries(event.id);
    const entryCount = myEntries?.length ?? 0;
    const usedTickets = myEntries?.reduce((sum, entry) => sum + entry.deductedTicketCount, 0) ?? 0;

    return (
        <motion.section
            ref={scope}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            onMouseEnter={replay}
            // 밝은 하늘 그림이라 다크 모드에서도 라이트 색을 쓴다 (tokens.css force-light)
            className="force-light bg-play-lavender-soft relative overflow-hidden rounded-2xl"
        >
            <img
                src={loseBg}
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-cover"
            />
            {/* 장식은 화면에 들어온 뒤 위아래로 천천히 둥실거린다 (동작 줄이기 설정이면 멈춘다 — MotionConfig) */}
            <motion.img
                src={loseDeco}
                alt=""
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1, y: [0, -6, 0] } : undefined}
                transition={{
                    opacity: { duration: 0.6, delay: 0.1 },
                    y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.7 },
                }}
                className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto"
            />

            <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:px-10">
                {/* 분위기를 전하는 장식이라 읽어 줄 내용이 없다 — 결과는 옆 글에서 그대로 읽힌다 */}
                <div data-hover="mascot" className="shrink-0 self-center">
                    <motion.img
                        src={loseMascot}
                        alt=""
                        initial={{ opacity: 0, y: -36 }}
                        animate={inView ? { opacity: 1, y: 0, rotate: [0, -6, 4, 0] } : undefined}
                        // 천천히 내려앉아 한 번 출렁인 뒤 고개를 갸웃한다
                        transition={{
                            opacity: { duration: 0.4, delay: 0.15 },
                            y: {
                                type: 'spring',
                                stiffness: 110,
                                damping: 12,
                                mass: 1.2,
                                delay: 0.15,
                            },
                            rotate: { duration: 1.4, delay: 0.9, ease: 'easeInOut' },
                        }}
                        className="h-40 w-auto object-contain"
                    />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <h3 className="text-title-2 text-fg-primary">
                        아쉽지만 이번엔 당첨되지 않았어요
                    </h3>
                    <p className="text-body text-fg-secondary">
                        {userName ? `${maskName(userName)}님, ` : ''}다음 래플에서 꼭 다시 만나요.
                        응모권은 출석·게임·미션으로 다시 모을 수 있어요.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {/* 응모하지 않은 래플에 '0장'을 적으면 참여했는데 아무것도 쓰지 않은 것처럼 읽힌다 */}
                        {entryCount > 0 && (
                            <Pill
                                label="이번에 쓴 응모권"
                                value={`${formatNumber(usedTickets)}장`}
                            />
                        )}
                        {nextRaffle && (
                            <Pill label="다음 타임래플" value={nextRaffleLabel(nextRaffle)} />
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-50">
                    <Button asChild>
                        <Link to={nextRaffle ? `/time-raffle/${nextRaffle.id}` : '/time-raffle'}>
                            다음 타임래플 보기
                        </Link>
                    </Button>
                </div>
            </div>
        </motion.section>
    );
}

function Pill({ label, value }: { label: string; value: string }) {
    // 하늘색 배경 위라 회색 알약은 탁해 보인다 — 흰 알약으로 둔다
    return (
        <span className="bg-surface-page/90 flex items-center gap-2 rounded-full px-3.5 py-1.5">
            <span className="text-body-sm text-fg-tertiary">{label}</span>
            <span className="text-body-sm-bold text-fg-primary">{value}</span>
        </span>
    );
}

/**
 * 지금 열려 있거나 가장 먼저 열릴 다른 타임래플.
 *
 * 목록 화면에서 들어오는 경로가 대부분이라 같은 쿼리가 이미 캐시에 있다 — 새 요청이 아니다.
 */
function useNextRaffle(currentEventId: string): Event | undefined {
    const { data: events } = useEventList();

    return events
        ?.filter(
            (event) =>
                event.isTimeRaffle &&
                event.id !== currentEventId &&
                (event.status === 'open' || event.status === 'upcoming'),
        )
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .at(0);
}

/** 진행 중이면 마감 시각을, 예정이면 오픈 시각을 적는다 */
function nextRaffleLabel(event: Event): string {
    const at = event.status === 'open' ? event.endsAt : event.startsAt;
    const day = kstDayDiff(at, new Date());
    const prefix =
        day === 0 ? '오늘' : day === 1 ? '내일' : formatKst(at, { month: 'long', day: 'numeric' });
    return `${prefix} ${formatKst(at, KST_HOUR_MINUTE)}`;
}
