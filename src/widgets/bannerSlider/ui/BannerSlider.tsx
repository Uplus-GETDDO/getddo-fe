import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { useBanners } from '@entities/banner';
import { Button } from '@shared/ui/button';
import { Pager } from '@shared/ui/pager';
import { Skeleton } from '@shared/ui/skeleton';

import { BannerSlide } from './BannerSlide';

export function BannerSlider() {
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

    useEffect(() => {
        if (total <= 1 || hovered || focused || stopped || reduceMotion) return;
        const timer = setInterval(() => {
            setIndex((value) => (value + 1) % total);
            setAutoSteps((value) => value + 1);
        }, 5000);
        return () => clearInterval(timer);
    }, [total, hovered, focused, stopped, reduceMotion]);

    if (isPending) {
        return (
            <div role="status">
                <span className="sr-only">배너를 불러오는 중입니다.</span>
                <Skeleton className="aspect-1200/365 w-full rounded-2xl" />
            </div>
        );
    }
    if (!isError && total === 0) return null;
    const move = (offset: number) => {
        setPaused(true);
        setIndex((safeIndex + offset + total) % total);
    };
    return (
        <section
            aria-label="관리 배너"
            aria-roledescription="캐러셀"
            className="flex min-w-0 flex-col gap-2"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
        >
            {isError && (
                <div role="status" className="flex flex-wrap items-center gap-2">
                    <p>배너를 불러오지 못했습니다.</p>
                    <Button
                        variant="secondary"
                        className="min-h-11"
                        disabled={isFetching}
                        onClick={() => void refetch()}
                    >
                        배너 다시 불러오기
                    </Button>
                </div>
            )}
            {total > 0 && (
                <>
                    <div className="overflow-hidden rounded-2xl">
                        <div
                            className="flex motion-safe:transition-transform motion-safe:duration-500"
                            style={{ transform: `translateX(-${safeIndex * 100}%)` }}
                        >
                            {banners?.map((banner, slideIndex) => (
                                <div
                                    key={banner.id}
                                    role="group"
                                    aria-roledescription="슬라이드"
                                    aria-label={`${slideIndex + 1} / ${total}`}
                                    inert={slideIndex !== safeIndex}
                                    aria-hidden={slideIndex !== safeIndex}
                                    className="w-full min-w-0 shrink-0"
                                >
                                    <BannerSlide
                                        key={`${banner.id}:${banner.imageUrl}`}
                                        banner={banner}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    {total > 1 && (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {!reduceMotion && (
                                <Button
                                    variant="ghost"
                                    className="min-h-11"
                                    onClick={() => {
                                        if (stopped) setFocused(false);
                                        setPaused(!stopped);
                                        setAutoSteps(0);
                                    }}
                                >
                                    {stopped ? '자동 재생 시작' : '자동 재생 정지'}
                                </Button>
                            )}
                            <Pager
                                className="[&>button]:size-11"
                                current={safeIndex}
                                total={total}
                                prevLabel="이전 배너"
                                nextLabel="다음 배너"
                                onPrev={() => move(-1)}
                                onNext={() => move(1)}
                            />
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
