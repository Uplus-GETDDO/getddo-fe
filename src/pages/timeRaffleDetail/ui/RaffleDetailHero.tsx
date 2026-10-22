import type { ReactNode } from 'react';

import { Clock } from 'lucide-react';

import type { Event } from '@entities/event';

import { useEntryStatistics } from '@entities/entry';
import { useImageFallback } from '@shared/hooks/useImageFallback';
import { useVirtualClock } from '@shared/model/virtualClock';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

const CHIP = 'text-caption bg-surface-sunken flex items-center gap-2.5 rounded-full px-3 py-1';

/**
 * 히어로 상단 상태 칩.
 *
 * 마감·발표 완료 래플도 목록에서 상세로 들어올 수 있으므로 '진행중'으로 고정할 수 없다.
 * 강조는 지금 응모할 수 있는 래플에만 둔다 — 끝난 래플까지 핑크로 띄우면 위계가 사라진다.
 */
const STATUS_CHIP: Record<Event['status'], { label: string; emphasized: boolean }> = {
    open: { label: '진행중', emphasized: true },
    upcoming: { label: '오픈 예정', emphasized: false },
    closed: { label: '발표 대기', emphasized: false },
    drawn: { label: '발표 완료', emphasized: false },
    canceled: { label: '이벤트 취소', emphasized: false },
    ended: { label: '추첨 없이 종료', emphasized: false },
};

interface RaffleDetailHeroProps {
    event: Event;
    /** 응모 수량 스테퍼 — 진행 중일 때만 노출한다 */
    quantityControl?: ReactNode;
    cta: ReactNode;
}

/** 상세 화면 대표 카드 — 목록 히어로와 달리 이미지가 카드에 꽉 차고, 현황은 칩으로 줄어든다 */
export function RaffleDetailHero({ event, quantityControl, cta }: RaffleDetailHeroProps) {
    // 응모 현황은 E03 전용 조회로 받는다 — 진행 중일 때만 30초 폴링 (ADR-0007)
    const isOpen = event.status === 'open';
    const banner = useImageFallback(event.bannerImageUrl);
    const { data: statistics, dataUpdatedAt } = useEntryStatistics(event.id, { isOpen });
    const { override } = useVirtualClock();
    // 진행 중에는 30초마다 바뀌는 값이라 언제 기준인지 같이 적는다 — 가상 시계로 멈춰 두면 그 시각으로 맞춘다
    const fetchedAt = isOpen && dataUpdatedAt ? (override ?? new Date(dataUpdatedAt)) : null;

    return (
        <article className="bg-surface-page flex flex-col overflow-hidden rounded-2xl lg:flex-row lg:gap-5">
            {/*
             * 상품 이미지는 래플마다 같은 크기의 정사각형(440)으로 위에 맞춘다. 오른쪽 높이를 따라 늘이면
             * 응모권 선택이 긴 래플만 이미지가 세로로 길어져 상품이 작아 보였다
             */}
            <div className="bg-surface-canvas relative aspect-square w-full max-w-110 shrink-0 self-center overflow-hidden rounded-2xl lg:size-110 lg:self-start">
                {banner.shown ? (
                    <img
                        src={event.bannerImageUrl!}
                        alt=""
                        onError={banner.onError}
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <div className="size-full" />
                )}
            </div>

            {/* 피그마 시안처럼 글은 위에서부터 쌓고, 수량·버튼은 아래쪽에 붙인다 */}
            <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={
                                STATUS_CHIP[event.status].emphasized
                                    ? 'bg-brand-primary text-fg-on-brand text-caption rounded-full px-3 py-1'
                                    : 'bg-surface-sunken text-fg-secondary text-caption rounded-full px-3 py-1'
                            }
                        >
                            {STATUS_CHIP[event.status].label}
                        </span>
                        {/* 시간 칩도 옆 칩들과 같은 글자(caption)·아이콘 크기를 쓴다 */}
                        <span className={`${CHIP} text-fg-primary`}>
                            <Clock className="size-5" />
                            {formatKst(event.startsAt, KST_HOUR_MINUTE)} ~{' '}
                            {formatKst(event.endsAt, KST_HOUR_MINUTE)}
                        </span>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h2 className="text-title-1 text-fg-primary">{event.title}</h2>
                        {/* 전문은 아래 '이벤트 상세 안내'에 있다 — 위에서는 세 줄로 잘라 응모 칸을 밀어내지 않게 한다 */}
                        <p className="text-body text-fg-primary line-clamp-3">
                            {event.description}
                        </p>
                        {/*
                         * 참여 수·쓴 장수는 응모 판단에 꼭 필요한 값이 아니라 칩 대신 설명 아래 한 줄로 낮춘다.
                         * 칩이 넷이면 '진행중'과 운영 시간이 묻힌다
                         */}
                        {statistics && (
                            <p className="text-caption text-fg-tertiary">
                                {formatNumber(statistics.participantCount)}명 참여 · 응모권{' '}
                                {formatNumber(statistics.totalSpentTicketCount)}장 사용
                                {fetchedAt && ` · ${formatKst(fetchedAt, KST_HOUR_MINUTE)} 기준`}
                            </p>
                        )}
                    </div>
                </div>

                {/* 구분선·수량·버튼은 카드 아래쪽에 붙인다 — 상태가 달라 위 글 길이가 달라도 버튼 위치는 늘 같다 */}
                {(quantityControl || cta) && (
                    <div className="mt-auto flex flex-col gap-5">
                        <hr className="border-border-default" />
                        {quantityControl}
                        {cta}
                    </div>
                )}
            </div>
        </article>
    );
}
