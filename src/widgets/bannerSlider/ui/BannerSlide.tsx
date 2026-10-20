import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Banner } from '@entities/banner';

import { eventDetailPath, useEvent } from '@entities/event';
import { Button } from '@shared/ui/button';

export function BannerSlide({ banner }: { banner: Banner }) {
    const { data: event, isPending, isError, refetch, isFetching } = useEvent(banner.eventId);
    const [imageFailed, setImageFailed] = useState(false);
    const image = imageFailed ? (
        <p role="status" className="text-body-sm p-6">
            배너 이미지를 불러오지 못했습니다.
        </p>
    ) : (
        <img
            src={banner.imageUrl}
            alt={event ? `${event.title} 배너` : '이벤트 배너'}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain"
        />
    );

    return (
        <div className="bg-surface-canvas flex h-full flex-col">
            {event && !isError ? (
                <Link
                    to={eventDetailPath(event)}
                    aria-label={`${event.title} 상세 보기`}
                    className="focus-visible:ring-border-focus flex aspect-1200/365 items-center justify-center rounded-2xl focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                >
                    {image}
                </Link>
            ) : (
                <div className="flex aspect-1200/365 items-center justify-center">{image}</div>
            )}
            {isPending && (
                <p role="status" className="text-body-sm p-3">
                    연결 이벤트를 확인하는 중입니다.
                </p>
            )}
            {isError && (
                <div role="status" className="flex flex-wrap items-center gap-2 p-3">
                    <p className="text-body-sm">연결 이벤트를 불러오지 못했습니다.</p>
                    <Button
                        variant="secondary"
                        className="min-h-11"
                        disabled={isFetching}
                        onClick={() => void refetch()}
                    >
                        연결 이벤트 다시 불러오기
                    </Button>
                </div>
            )}
        </div>
    );
}
