import type { ReactNode } from 'react';

import { Clock, Flame } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Banner } from '@entities/banner';
import type { Event } from '@entities/event';

import { eventDetailPath, useEvent } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { formatRemaining } from '@shared/utils/date';

import bannerBackground from '../assets/banner-bg.jpg';

/** 배너 한 장의 칸 — 피그마 홈 배너 1200×365. 좁은 화면에서는 글이 들어가도록 높이를 최소로만 잡는다 */
const SLIDE_BOX = 'relative flex min-h-91.25 w-full flex-col overflow-hidden rounded-2xl';

/**
 * 배너를 그리지 못할 때의 빈 틀 — 노란 기본 배경을 배너 크기로 깔고 아래 왼쪽에 안내를 둔다.
 * 배너 목록(B01)이 실패해도 홈 맨 위 자리가 통째로 빠져 아래가 밀려 올라오지 않게 한다
 */
export function BannerFrame({ children }: { children: ReactNode }) {
    return (
        <div className={`bg-play-yellow ${SLIDE_BOX}`}>
            <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-right-bottom"
                style={{ backgroundImage: `url(${bannerBackground})` }}
            />
            <div className="relative mt-auto p-6 sm:px-12.5">{children}</div>
        </div>
    );
}

/**
 * 관리 배너 한 장 —관리자가 올린 그림(B01 imageUrl)을 배경으로 통째로 깔고, 글은 연결 이벤트(E02)에서 받아 왼쪽에 얹는다.
 * 남은 시간·참여 인원은 계속 바뀌어 그림에 넣을 수 없고, 그림 속 글은 좁은 화면에서 잘리고 화면 낭독기가 읽지 못한다.
 * 그래서 그림은 왼쪽(글 자리)을 비운 템플릿으로 받는다. 그림을 못 불러오면 노란 기본 배경으로 대신한다.
 * 배너 어디를 눌러도 상세로 간다 — 버튼·캐릭터는 두지 않는다
 */
export function BannerSlide({
    banner,
    now,
    isActive,
    renderStatus,
}: {
    banner: Banner;
    now: Date;
    /** 지금 보이는 배너인가 — 보이지 않는 배너의 실시간 현황 조회를 멈추는 데 쓴다 */
    isActive: boolean;
    renderStatus?: (event: Event, isActive: boolean) => ReactNode;
}) {
    const { data: event, isPending, isError, refetch, isFetching } = useEvent(banner.eventId);
    const [imageFailed, setImageFailed] = useState(false);

    const background = imageFailed ? (
        <>
            <div
                aria-hidden
                className="bg-play-yellow absolute inset-0 bg-cover bg-right-bottom"
                style={{ backgroundImage: `url(${bannerBackground})` }}
            />
            <p role="status" className="sr-only">
                배너 이미지를 불러오지 못했습니다.
            </p>
        </>
    ) : (
        <img
            src={banner.imageUrl}
            alt={event ? `${event.title} 배너` : '이벤트 배너'}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 size-full object-cover object-right"
        />
    );

    if (!event || isError) {
        // 연결 이벤트를 모르면 갈 곳이 없어 링크를 걸지 않는다 — 그림만 두고 확인 중·실패를 알린다
        return (
            <div className={`bg-play-yellow ${SLIDE_BOX}`}>
                {background}
                <div className="relative mt-auto p-6 sm:px-12.5">
                    {isPending && (
                        <p role="status" className="text-body-sm text-fg-secondary">
                            연결 이벤트를 확인하는 중입니다.
                        </p>
                    )}
                    {isError && (
                        <div role="status" className="flex flex-wrap items-center gap-2">
                            <p className="text-body-sm text-fg-primary">
                                연결 이벤트를 불러오지 못했습니다.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={isFetching}
                                onClick={() => void refetch()}
                            >
                                연결 이벤트 다시 불러오기
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const open = event.status === 'open';
    const remainingMs = new Date(event.endsAt).getTime() - now.getTime();

    return (
        <Link
            to={eventDetailPath(event)}
            aria-label={`${event.title} 상세 보기`}
            className={`bg-play-yellow focus-visible:ring-border-focus group focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${SLIDE_BOX}`}
        >
            {background}
            {/* 마감 시간 — 배너 왼쪽 끝에 붙은 탭 (공용 Badge surface xl). 진행 중일 때만 */}
            {open && remainingMs > 0 && (
                <Badge
                    variant="surface"
                    size="xl"
                    className="absolute top-7.5 left-0 rounded-l-none pl-12.5 tabular-nums"
                >
                    <Clock />
                    마감까지{' '}
                    {formatRemaining(remainingMs, remainingMs >= 3_600_000 ? 'minute' : 'second')}
                </Badge>
            )}
            {/* 글 덩어리는 세로 가운데 — 그림의 왼쪽 글 자리(약 55%)를 넘지 않게 폭을 묶는다 */}
            <div className="relative flex flex-1 flex-col justify-center gap-1 px-6 pt-21 pb-8 sm:max-w-[55%] sm:px-12.5 sm:pb-8.75">
                <div className="flex items-center gap-1">
                    <Flame aria-hidden className="fill-fg-primary text-fg-primary size-5.5" />
                    <span className="text-fg-primary text-body-sm-bold">
                        {event.isTimeRaffle ? '오늘의 겟또타임' : '이벤트'}
                    </span>
                </div>
                <div className="flex flex-col gap-3">
                    <h2 className="text-display text-fg-primary break-keep group-hover:underline group-hover:underline-offset-4">
                        {event.title}
                    </h2>
                    {event.description && (
                        <p className="text-body text-fg-primary line-clamp-2 break-keep whitespace-pre-line">
                            {event.description}
                        </p>
                    )}
                    {open && renderStatus?.(event, isActive)}
                </div>
            </div>
        </Link>
    );
}
