import type { Event } from '@entities/event';

import shopCounter from '@shared/assets/shop/shop-counter.jpg';
import shopWall from '@shared/assets/shop/shop-wall.jpg';
import { formatNumber } from '@shared/utils/format';
import { TicketWalletCompact } from '@widgets/ticketWallet';

import itemGift from '../assets/item-gift.webp';
import itemGumball from '../assets/item-gumball.webp';
import itemTickets from '../assets/item-tickets.webp';
import { kstDateHeadline } from '../utils/raffleFormat';

interface TimeRaffleHeroProps {
    live: Event[];
    now: Date;
}

/**
 * 겟또타임 머리 — 오늘 몇 개가 열려 있는지 한 줄로 알려 주고 응모권 잔액을 함께 둔다.
 * 이 화면에서 가장 중요한 건 아래 '지금 진행 중'이라 머리는 얇은 띠로 줄였다 — 진행 칸 세 개와 큰 지갑을 빼고
 * 한 줄 지갑(TicketWalletCompact)만 둔다. 자세한 지갑은 미션 페이지에 있다.
 * 가게 느낌은 남긴다 — 얇은 나무 카운터 띠 위에 양 끝 소품(응모권·선물 상자 / 뽑기 기계)을 올린다.
 * 규칙 설명 줄(마감 직후 추첨·많이 쓸수록 기회)은 뺐다 — 아래 '추첨 결과 안내'와 상세에 같은 내용이 있다
 *
 * 래플은 시간이 지나면 사라지는 화면이라 '지금 몇 개가 열려 있는지'가 제목이어야 한다.
 * 응모권을 보려고 마이페이지로 나갔다 오지 않도록 잔액도 같은 줄에 둔다.
 */
export function TimeRaffleHero({ live, now }: TimeRaffleHeroProps) {
    return (
        <section
            aria-labelledby="time-raffle-title"
            // 미션 페이지 "오늘의 적립"과 같은 가게 — 벽(image 197) 위에 얇은 카운터 띠(image 211). --counter는 띠 높이
            className="force-light bg-play-yellow-soft relative overflow-hidden rounded-3xl bg-cover bg-center [--counter:2.25rem]"
            style={{ backgroundImage: `url(${shopWall})` }}
        >
            {/* 벽 그림이 어두운 웜톤이라 흰 막을 얇게 덮어 페이지 바탕과 어울리게 밝힌다 */}
            <div aria-hidden className="bg-surface-page/45 absolute inset-0" />
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-(--counter) bg-size-[auto_100%] bg-left bg-repeat-x"
                style={{ backgroundImage: `url(${shopCounter})` }}
            />
            {/* 카운터 위 양 끝 소품 — 왼쪽 응모권·선물 상자(안쪽을 보게 뒤집는다), 오른쪽 뽑기 기계. 글·지갑과 겹치지 않게 넓은 화면에서만 */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-4 bottom-[calc(var(--counter)*0.55)] hidden items-end justify-between lg:flex"
            >
                <div className="flex items-end gap-1">
                    <img src={itemTickets} alt="" className="h-7 w-auto -scale-x-100" />
                    <img src={itemGift} alt="" className="h-9 w-auto -scale-x-100" />
                </div>
                <img src={itemGumball} alt="" className="h-12 w-auto" />
            </div>
            <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5 px-6 pt-6 pb-[calc(var(--counter)+1.5rem)] md:px-10 md:pt-7 lg:px-24 lg:pb-[calc(var(--counter)+2.5rem)]">
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-body-sm-bold text-fg-secondary">
                        {kstDateHeadline(now)} · 겟또타임
                    </p>
                    <h1 id="time-raffle-title" className="text-title-2 text-fg-primary break-keep">
                        {live.length > 0 ? (
                            <>
                                지금 응모할 수 있는 래플{' '}
                                <span className="text-fg-brand tabular-nums">
                                    {formatNumber(live.length)}개
                                </span>
                            </>
                        ) : (
                            '지금 열린 래플이 없어요'
                        )}
                    </h1>
                </div>

                <TicketWalletCompact action={{ to: '/missions', label: '응모권 모으러 가기' }} />
            </div>
        </section>
    );
}
