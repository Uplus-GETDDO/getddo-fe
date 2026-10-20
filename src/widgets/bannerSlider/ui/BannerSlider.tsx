import type { ReactNode } from 'react';

import { useReducedMotion } from 'framer-motion';
import { Clock, Flame } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Event } from '@entities/event';

import { eventDetailPath, useEventList } from '@entities/event';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Pager } from '@shared/ui/pager';
import { Skeleton } from '@shared/ui/skeleton';
import { formatRemaining } from '@shared/utils/date';

import bannerBackground from '../assets/banner-bg.jpg';
import bannerMascot from '../assets/banner-mascot.webp';

const AUTO_SLIDE_MS = 5000;
const MAX_SLIDES = 5;
/** 피그마 홈 배너의 무너 캐릭터(image 28) — 배너 이미지 대신 고정 장식으로 보여준다 */
const SHOW_MASCOT = true;

export function BannerSlider({
    renderStatus,
}: {
    /**
     * 배너 이벤트의 실시간 현황 pill을 배너 안에 렌더링한다 — 위젯 간 참조를 피하기 위해 페이지가 슬롯으로 주입한다.
     * isActive는 지금 보이는 슬라이드인지 여부라, 보이지 않는 슬라이드의 현황 조회를 멈추는 데 쓴다
     */
    renderStatus?: (event: Event, isActive: boolean) => ReactNode;
}) {
    const { data: events, isPending, isError } = useEventList();
    const [index, setIndex] = useState(0);
    // 정지 조건을 축별로 분리한다 — 포커스가 안에 있는데 마우스만 빠져나가도 재생이 재개되지 않게
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    // 자동 넘김은 한 바퀴(모든 배너를 한 번씩 보여주고 첫 배너로 돌아오기)만 하고 멈춘다.
    // 사용자가 화살표로 직접 넘기면 그때부터는 자동 넘김을 끈다
    const [autoSteps, setAutoSteps] = useState(0);
    const [userControlled, setUserControlled] = useState(false);
    // 동작 줄이기 설정 사용자에게는 자동 슬라이드를 켜지 않는다
    const reduceMotion = useReducedMotion();
    // 마감 판정이 아닌 화면 표시 전용 카운트다운이므로 가상 시계의 시각을 쓴다
    const clock = useVirtualClock();
    const [now, setNow] = useState(() => clock.now());
    // 가상 시계 오버라이드가 바뀌면 렌더 단계에서 즉시 갱신한다 (effect setState는 lint 금지)
    const [lastClock, setLastClock] = useState(clock);
    if (lastClock !== clock) {
        setLastClock(clock);
        setNow(clock.now());
    }

    useEffect(() => {
        const timer = setInterval(() => setNow(clock.now()), 1000);
        return () => clearInterval(timer);
    }, [clock]);

    const slides = useMemo(
        () =>
            (events ?? [])
                // '오늘의 겟또타임' 배너라 진행 중인 겟또타임만 싣는다
                .filter((event) => event.status === 'open' && event.isTimeRaffle)
                .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
                .slice(0, MAX_SLIDES),
        [events],
    );

    const autoplayStopped =
        slides.length <= 1 ||
        hovered ||
        focused ||
        userControlled ||
        autoSteps >= slides.length ||
        reduceMotion === true;

    useEffect(() => {
        if (autoplayStopped) {
            return;
        }
        const timer = setInterval(() => {
            setIndex((i) => (i + 1) % slides.length);
            setAutoSteps((n) => n + 1);
        }, AUTO_SLIDE_MS);
        return () => clearInterval(timer);
    }, [slides.length, autoplayStopped]);

    const safeIndex = Math.min(index, Math.max(slides.length - 1, 0));
    // 화살표로 직접 넘기면 그때부터 자동 넘김을 끈다
    const goPrev = () => {
        setUserControlled(true);
        setIndex((safeIndex - 1 + slides.length) % slides.length);
    };
    const goNext = () => {
        setUserControlled(true);
        setIndex((safeIndex + 1) % slides.length);
    };

    if (isPending) {
        // 겟또타임·미션 머리처럼 배너 자리를 통으로 잡는다
        return <Skeleton className="min-h-91.25 w-full rounded-2xl" />;
    }

    if (isError || slides.length === 0) {
        return null;
    }

    return (
        <section
            className="relative flex flex-col gap-2"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(e) => {
                // 포커스가 섹션 안의 다른 요소로 옮겨갈 때는 유지한다
                if (!e.currentTarget.contains(e.relatedTarget)) {
                    setFocused(false);
                }
            }}
        >
            {/* 모든 슬라이드를 한 줄로 나열 — 트랙 높이가 가장 큰 슬라이드로 고정돼 전환 중 크기 변환이 없고 transform만 애니메이션된다 */}
            {/* 노란 그림 배너라 다크 모드에서도 라이트 색을 쓴다 (tokens.css force-light) — 아래 넘김 화살표는 페이지 색을 따른다 */}
            <div className="force-light overflow-hidden rounded-2xl">
                <div
                    className="flex ease-out motion-safe:transition-transform motion-safe:duration-500"
                    style={{ transform: `translateX(-${safeIndex * 100}%)` }}
                >
                    {slides.map((event, slideIndex) => {
                        const remainingMs = new Date(event.endsAt).getTime() - now.getTime();
                        return (
                            // 피그마 홈 배너 — 1200×365, 노란 배경 그림, 본문은 왼쪽 50·위 84에서 시작
                            <div
                                key={event.id}
                                // 화면 밖 배너는 Tab 포커스·보조 기술에서 빼 실시간 현황 알림도 보이는 배너만 읽힌다
                                inert={slideIndex !== safeIndex}
                                className="bg-play-yellow relative flex min-h-91.25 w-full shrink-0 flex-col bg-cover bg-right-bottom"
                                style={{ backgroundImage: `url(${bannerBackground})` }}
                            >
                                {/* 마감 시간 — 배너 왼쪽 끝에 붙은 흰 탭 (공용 Badge surface xl). 시각 꼴(169:59:58) 대신 읽는 단위로 적는다 */}
                                <Badge
                                    variant="surface"
                                    size="xl"
                                    className="absolute top-7.5 left-0 rounded-l-none pl-12.5 tabular-nums"
                                >
                                    <Clock />
                                    마감까지 {formatRemaining(remainingMs)}
                                </Badge>
                                {/*
                                 * 글 덩어리는 세로 가운데에 모은다 — 버튼만 바닥에 붙이면 설명이 짧을 때
                                 * 글은 위로 쏠리고 칩과 버튼 사이가 비어 허전했다
                                 */}
                                <div className="flex flex-1 flex-col items-start justify-center gap-6 px-6 pt-21 pb-8 sm:px-12.5 sm:pb-8.75">
                                    <div className="flex max-w-150 flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            {/* 채운 불꽃 아이콘 — 아이콘·글자 모두 잉크(fg/primary) */}
                                            <Flame
                                                aria-hidden
                                                className="fill-fg-primary text-fg-primary size-5.5"
                                            />
                                            <span className="text-fg-primary text-body-sm-bold">
                                                오늘의 겟또타임
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <h2 className="text-display text-fg-primary break-keep">
                                                {event.title}
                                            </h2>
                                            <p className="text-body text-fg-primary line-clamp-2 break-keep whitespace-pre-line">
                                                {event.description}
                                            </p>
                                            {renderStatus?.(event, slideIndex === safeIndex)}
                                        </div>
                                    </div>
                                    {/* 상세로 이동하는 버튼이라 '응모하러 가기' — 실제로 응모권을 쓰는 '응모하기'와 구분한다 */}
                                    <Button asChild size="lg" className="px-7">
                                        <Link to={eventDetailPath(event)}>응모하러 가기</Link>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* 피그마 홈 — 배너 오른쪽에 무너 캐릭터가 배너 밖으로 살짝 걸쳐 있다 (넓은 화면만) */}
            {slides.length > 1 && (
                <div className="relative z-10 flex justify-end">
                    {/* 피그마 홈 — 원형 화살표 사이에 '01 / 04' (공용 Pager) */}
                    <Pager
                        current={safeIndex}
                        total={slides.length}
                        prevLabel="이전 이벤트"
                        nextLabel="다음 이벤트"
                        onPrev={goPrev}
                        onNext={goNext}
                    />
                </div>
            )}
            {SHOW_MASCOT && (
                <img
                    src={bannerMascot}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute -top-16.75 right-8 hidden w-125 select-none xl:block"
                />
            )}
        </section>
    );
}
