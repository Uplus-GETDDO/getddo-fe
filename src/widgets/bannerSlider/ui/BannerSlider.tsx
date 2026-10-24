import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Event } from '@entities/event';

import { useBanners } from '@entities/banner';
import { useEvent } from '@entities/event';
import { queryPresets } from '@shared/api/queryPresets';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { Pager } from '@shared/ui/pager';
import { RefreshStatus } from '@shared/ui/refresh-status';
import { Skeleton } from '@shared/ui/skeleton';

import { BannerSlide, FallbackBanner } from './BannerSlide';

const AUTO_SLIDE_MS = 5000;

/** 지금 보이는 배너의 연결 이벤트로 갱신 표시를 그린다 — 상세(E02)는 BannerSlide와 같은 캐시를 쓴다 */
function ActiveRefresh({
    eventId,
    summaryEvent,
    render,
}: {
    eventId: string;
    summaryEvent?: Event;
    render: (event: Event, isActive: boolean) => ReactNode;
}) {
    // 슬라이드가 바뀔 때마다 마운트되므로 폴링 주기 안의 재마운트는 받아 둔 값을 쓴다
    // 목록 이벤트가 있으면 그 값으로 충분해 상세를 따로 묻지 않는다 — 슬라이드의 상세 조회가 채운다
    const { data: detail } = useEvent(eventId, {
        staleTime: queryPresets.realtime.refetchInterval,
        enabled: !summaryEvent,
    });
    const event = detail ?? summaryEvent;
    return event && event.status === 'open' ? render(event, true) : null;
}

/**
 * 배너 수만큼의 점 — 지금 배너의 점만 알약으로 늘어나고, 자동 재생 중에는 그 안이 다음 배너까지 남은 시간만큼 찬다.
 * 채움도 알약 모양(점 크기에서 시작해 폭만 늘린다)이라 끝이 잘려 보이지 않는다. 멈추면 꽉 찬 알약으로 둔다.
 * 점을 누르면 그 배너로 바로 간다 — 점은 6px라 누르는 자리는 24px 높이로 넓힌다
 */
function SlideDots({
    total,
    index,
    playing,
    onSelect,
}: {
    total: number;
    index: number;
    playing: boolean;
    onSelect: (index: number) => void;
}) {
    return (
        <div className="flex items-center">
            {Array.from({ length: total }, (_, dot) => (
                <button
                    key={dot}
                    type="button"
                    aria-label={`${dot + 1}번째 배너`}
                    aria-current={dot === index ? 'true' : undefined}
                    onClick={() => onSelect(dot)}
                    className="group focus-visible:ring-border-focus flex h-6 cursor-pointer items-center rounded-full px-0.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                    {dot === index ? (
                        <span className="bg-border-strong relative h-1.5 w-6 overflow-hidden rounded-full">
                            <motion.span
                                key={playing ? `play-${index}` : 'still'}
                                className="bg-fg-primary absolute inset-y-0 left-0 min-w-1.5 rounded-full"
                                initial={{ width: playing ? '0%' : '100%' }}
                                animate={{ width: '100%' }}
                                transition={
                                    playing
                                        ? { duration: AUTO_SLIDE_MS / 1000, ease: 'linear' }
                                        : { duration: 0 }
                                }
                            />
                        </span>
                    ) : (
                        <span className="bg-border-strong group-hover:bg-fg-tertiary size-1.5 rounded-full transition-colors" />
                    )}
                </button>
            ))}
        </div>
    );
}

/**
 * 홈 관리 배너 —관리자가 등록한 배너(B01)를 순서대로 넘긴다.
 * 자동 재생은 계속 돌고, 마우스·포커스가 안에 있거나 정지 버튼을 누르면 멈춘다. 동작 줄이기 설정이면 켜지 않는다.
 * 자동 재생 중에는 넘김 컨트롤 옆 알약 점이 다음 배너까지 남은 시간을 채워 보여 준다 (SlideDots).
 * 배너 아래 한 줄 — 왼쪽은 페이지가 넣는 내용(바로가기), 오른쪽은 갱신 표시·정지·넘김 화살표.
 * 바로가기를 따로 한 줄로 떼면 배너와 아래 섹션 사이에 홀로 떠 보여, 배너에서 16px 띄운 한 줄로 묶는다
 */
export function BannerSlider({
    renderStatus,
    renderRefresh,
    footer,
    events,
}: {
    /** 배너 아래 줄 왼쪽에 둘 내용 — 넘김 화살표와 같은 줄에 붙여 배너와 한 덩어리로 보이게 한다 (예: 홈 바로가기) */
    footer?: ReactNode;
    /**
     * 페이지가 이미 받은 이벤트 목록(E01) — 주면 비활성 슬라이드는 목록 이벤트로 그리고
     * 상세(E02) 조회는 활성 슬라이드만 한다. 안 주면 배너마다 상세를 받던 종전 동작을 유지한다
     */
    events?: Event[];
    /**
     * 연결 이벤트의 실시간 현황 pill을 배너 안에 그린다 — 위젯 간 참조를 피하려고 페이지가 슬롯으로 주입한다.
     * isActive는 지금 보이는 배너인지라, 보이지 않는 배너의 현황 조회를 멈추는 데 쓴다
     */
    renderStatus?: (event: Event, isActive: boolean) => ReactNode;
    /** 넘김 화살표 옆 갱신 표시 — 지금 보이는 배너의 실시간 현황 폴링과 실패를 한 줄로 알린다 */
    renderRefresh?: (event: Event, isActive: boolean) => ReactNode;
}) {
    const { data: banners, isPending, isError, refetch, isFetching } = useBanners();
    const [index, setIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [paused, setPaused] = useState(false);
    const reduceMotion = useReducedMotion();
    const total = banners?.length ?? 0;
    const safeIndex = Math.min(index, Math.max(total - 1, 0));
    const stopped = paused;
    const playing = total > 1 && !hovered && !focused && !stopped && !reduceMotion;

    // 남은 시간 표시 전용 — 마감 판정이 아니라 가상 시계의 시각으로 1초마다 다시 센다
    const clock = useVirtualClock();
    const [now, setNow] = useState(() => clock.now());
    const [lastClock, setLastClock] = useState(clock);
    if (lastClock !== clock) {
        setLastClock(clock);
        setNow(clock.now());
    }
    useEffect(() => {
        const timer = setInterval(() => setNow(clock.now()), 1000);
        return () => clearInterval(timer);
    }, [clock]);

    useEffect(() => {
        if (!playing) return;
        const timer = setInterval(() => {
            setIndex((value) => (value + 1) % total);
        }, AUTO_SLIDE_MS);
        return () => clearInterval(timer);
    }, [playing, total]);

    if (isPending) {
        // 배너 자리를 통으로 잡는다 — 아래 줄(바로가기)은 먼저 보인다
        return (
            <div className="flex flex-col gap-2">
                <div role="status">
                    <span className="sr-only">배너를 불러오는 중입니다.</span>
                    <Skeleton className="min-h-91.25 w-full rounded-2xl" />
                </div>
                {footer}
            </div>
        );
    }
    // 등록된 배너가 없으면 자리를 비운다 — 아래 줄 내용(바로가기)은 남긴다
    if (!isError && total === 0) return footer ?? null;

    const move = (offset: number) => {
        setPaused(true);
        setIndex((safeIndex + offset + total) % total);
    };
    const active = banners?.[safeIndex];
    // 페이지가 목록을 넘겼다는 사실 자체가 lazy 신호다 — 로딩 중(빈 배열)이어도 비활성 슬라이드는 상세를 묻지 않는다
    const lazyDetail = events !== undefined;
    const summaryOf = (eventId: string) => events?.find((event) => event.id === eventId);

    return (
        <section
            aria-label="관리 배너"
            aria-roledescription="캐러셀"
            className="flex min-w-0 flex-col gap-4"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                // 포커스가 섹션 안의 다른 요소로 옮겨갈 때는 유지한다
                if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
        >
            {isError && total === 0 && (
                /*
                 * 받아 둔 배너가 없으면 기본 배너로 자리를 채운다 — 홍보 자리라 실패 문구를 크게 띄우지 않는다.
                 * 자리가 빠지면 아래 섹션이 밀려 올라오고, 빈 틀에 오류만 두면 홈 첫 화면이 고장 나 보인다.
                 * 실패 안내·다시 불러오기는 아래 줄 갱신 표시가 작게 맡는다
                 */
                <div className="force-light">
                    <FallbackBanner />
                </div>
            )}
            {total > 0 && (
                // 그림 배너라 다크 모드에서도 라이트 색을 쓴다 (tokens.css force-light) — 아래 줄은 페이지 색을 따른다
                <div className="force-light relative overflow-hidden rounded-2xl">
                    <div
                        className="flex ease-out motion-safe:transition-transform motion-safe:duration-500"
                        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
                    >
                        {banners?.map((banner, slideIndex) => (
                            <div
                                key={banner.id}
                                role="group"
                                aria-roledescription="슬라이드"
                                aria-label={`${slideIndex + 1} / ${total}`}
                                // 화면 밖 배너는 Tab 포커스·보조 기술에서 뺀다
                                inert={slideIndex !== safeIndex}
                                aria-hidden={slideIndex !== safeIndex}
                                className="flex w-full min-w-0 shrink-0"
                            >
                                <BannerSlide
                                    key={`${banner.id}:${banner.imageUrl}`}
                                    banner={banner}
                                    now={now}
                                    isActive={slideIndex === safeIndex}
                                    summaryEvent={summaryOf(banner.eventId)}
                                    lazyDetail={lazyDetail}
                                    renderStatus={renderStatus}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {(footer || total > 1 || renderRefresh || isError) && (
                // 좁은 화면은 컨트롤을 위, 바로가기를 아래로 쌓는다
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">{footer}</div>
                    <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                        {/* 배너 목록 실패 — 받아 둔 배너(또는 기본 배너)를 둔 채 작은 '갱신 실패 · 다시 시도'만 */}
                        {isError && (
                            <RefreshStatus
                                fetching={isFetching}
                                error
                                onRefresh={() => void refetch()}
                            />
                        )}
                        {/* 배너 목록과 현황이 함께 실패하면(서버 장애) '갱신 실패 · 다시 시도'가 두 번 떴다 — 목록 실패 하나만 둔다 */}
                        {!isError && active && renderRefresh && (
                            <ActiveRefresh
                                eventId={active.eventId}
                                summaryEvent={summaryOf(active.eventId)}
                                render={renderRefresh}
                            />
                        )}
                        {total > 1 && (
                            <div className="flex items-center gap-1">
                                <SlideDots
                                    total={total}
                                    index={safeIndex}
                                    playing={playing}
                                    onSelect={(dot) => move(dot - safeIndex)}
                                />
                                {!reduceMotion && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="ml-1 rounded-full"
                                        aria-label={stopped ? '자동 재생 시작' : '자동 재생 정지'}
                                        onClick={() => {
                                            if (stopped) setFocused(false);
                                            setPaused(!stopped);
                                        }}
                                    >
                                        {stopped ? <Play aria-hidden /> : <Pause aria-hidden />}
                                    </Button>
                                )}
                                {/* 피그마 홈 — 원형 화살표 사이에 '01 / 04' (공용 Pager) */}
                                <Pager
                                    current={safeIndex}
                                    total={total}
                                    prevLabel="이전 배너"
                                    nextLabel="다음 배너"
                                    onPrev={() => move(-1)}
                                    onNext={() => move(1)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
