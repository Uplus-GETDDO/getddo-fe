import type { ReactNode } from 'react';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import type { Event } from '@entities/event';

import { useBanners } from '@entities/banner';
import { useEvent } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Button } from '@shared/ui/button';
import { Pager } from '@shared/ui/pager';
import { Skeleton } from '@shared/ui/skeleton';

import { BannerFrame, BannerSlide } from './BannerSlide';

const AUTO_SLIDE_MS = 5000;

/** 지금 보이는 배너의 연결 이벤트로 갱신 표시를 그린다 — 상세(E02)는 BannerSlide와 같은 캐시를 쓴다 */
function ActiveRefresh({
    eventId,
    render,
}: {
    eventId: string;
    render: (event: Event, isActive: boolean) => ReactNode;
}) {
    const { data: event } = useEvent(eventId);
    return event && event.status === 'open' ? render(event, true) : null;
}

/** 배너 목록 실패 안내와 다시 불러오기 */
function BannerLoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
    return (
        <div role="status" className="flex flex-wrap items-center gap-2">
            <p className="text-body-sm text-fg-secondary">배너를 불러오지 못했습니다.</p>
            <Button variant="secondary" size="sm" disabled={retrying} onClick={onRetry}>
                배너 다시 불러오기
            </Button>
        </div>
    );
}

/**
 * 홈 관리 배너 —관리자가 등록한 배너(B01)를 순서대로 넘긴다.
 * 자동 재생은 한 바퀴만 돌고 멈추며, 마우스·포커스가 안에 있거나 '자동 재생 정지'를 누르면 멈춘다. 동작 줄이기 설정이면 켜지 않는다.
 * 배너 아래 줄 왼쪽에는 페이지가 넣는 내용(바로가기), 오른쪽에는 갱신 표시와 넘김 화살표를 둔다
 */
export function BannerSlider({
    renderStatus,
    renderRefresh,
    footer,
}: {
    /** 배너 아래 줄 왼쪽에 둘 내용 — 넘김 화살표와 같은 줄에 붙여 배너와 한 덩어리로 보이게 한다 (예: 홈 바로가기) */
    footer?: ReactNode;
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
    const [autoSteps, setAutoSteps] = useState(0);
    const reduceMotion = useReducedMotion();
    const total = banners?.length ?? 0;
    const safeIndex = Math.min(index, Math.max(total - 1, 0));
    const stopped = paused || autoSteps >= total;

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
        if (total <= 1 || hovered || focused || stopped || reduceMotion) return;
        const timer = setInterval(() => {
            setIndex((value) => (value + 1) % total);
            setAutoSteps((value) => value + 1);
        }, AUTO_SLIDE_MS);
        return () => clearInterval(timer);
    }, [total, hovered, focused, stopped, reduceMotion]);

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

    return (
        <section
            aria-label="관리 배너"
            aria-roledescription="캐러셀"
            className="flex min-w-0 flex-col gap-2"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                // 포커스가 섹션 안의 다른 요소로 옮겨갈 때는 유지한다
                if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
        >
            {isError &&
                (total === 0 ? (
                    // 받아 둔 배너가 없으면 배너 크기의 빈 틀 안에 안내를 둔다 — 자리가 빠지면 아래 섹션이 밀려 올라온다
                    <div className="force-light">
                        <BannerFrame>
                            <BannerLoadError retrying={isFetching} onRetry={() => void refetch()} />
                        </BannerFrame>
                    </div>
                ) : (
                    <BannerLoadError retrying={isFetching} onRetry={() => void refetch()} />
                ))}
            {total > 0 && (
                // 그림 배너라 다크 모드에서도 라이트 색을 쓴다 (tokens.css force-light) — 아래 줄은 페이지 색을 따른다
                <div className="force-light overflow-hidden rounded-2xl">
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
                                    renderStatus={renderStatus}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {(footer || total > 1 || renderRefresh) && (
                <div className="relative z-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">{footer}</div>
                    <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                        {active && renderRefresh && (
                            <ActiveRefresh eventId={active.eventId} render={renderRefresh} />
                        )}
                        {total > 1 && !reduceMotion && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (stopped) setFocused(false);
                                    setPaused(!stopped);
                                    setAutoSteps(0);
                                }}
                            >
                                {stopped ? '자동 재생 시작' : '자동 재생 정지'}
                            </Button>
                        )}
                        {/* 피그마 홈 — 원형 화살표 사이에 '01 / 04' (공용 Pager) */}
                        {total > 1 && (
                            <Pager
                                current={safeIndex}
                                total={total}
                                prevLabel="이전 배너"
                                nextLabel="다음 배너"
                                onPrev={() => move(-1)}
                                onNext={() => move(1)}
                            />
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
