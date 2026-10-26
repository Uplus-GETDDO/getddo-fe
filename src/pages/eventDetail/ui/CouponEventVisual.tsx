import type { Event } from '@entities/event';

import { formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

type CouponVisual = Extract<NonNullable<Event['detailVisual']>, { template: 'coupon' }>;

/*
 * 캠페인 색 — 이 이벤트의 비주얼 전용이다.
 *
 * 토큰(brand/surface)을 쓰지 않고 고정값을 쓴다. 이 영역은 운영자가 만드는 세로 이벤트 이미지가
 * 놓일 자리고, 이미지는 테마를 따라 뒤집히지 않는다. 캠페인마다 색이 다른 것도 이미지와 같다.
 * grade/game 토큰이 다크 모드에 그대로인 것과 같은 이유다 (tokens.css).
 */
const INK = 'text-[#102A33]';
const MUTE = 'text-[#5E7480]';

/**
 * 데이터 쿠폰 무료 응모 비주얼 — 경품 한 종류를 쿠폰 한 장으로 크게 보이는 꼴 (template: 'coupon').
 *
 * 히어로 아래로 쿠폰 카드가 걸쳐 올라와 제목과 경품이 한 화면에 같이 들어온다.
 * 경품 이미지(detailImageUrl)가 있으면 그린 카드 대신 그 이미지를 쓴다.
 *
 * 등수가 여럿인 추첨은 EventDetailVisual(template: 'prizeTiers')이 맡는다.
 */
export function CouponEventVisual({ event, visual }: { event: Event; visual: CouponVisual }) {
    const { coupon } = visual;
    const prizeLabel = `${coupon.name} ${coupon.amount}`;

    return (
        <article className="border-border-default mx-auto w-full max-w-180 overflow-hidden rounded-2xl border bg-white break-keep">
            {/* 1. 타이틀 — 아래쪽을 넉넉히 비워 쿠폰 카드가 걸쳐 올라올 자리를 만든다 */}
            <header className="relative overflow-hidden bg-[#0C5A6B] px-5 pt-14 pb-35 text-center text-white sm:px-8 sm:pt-18">
                {/* 신호가 퍼지는 모양 — 히어로 아래 가운데에서 동심원으로 번진다 */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
                >
                    <span className="absolute top-1/2 left-1/2 size-90 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#43E0B8]/35" />
                    <span className="absolute top-1/2 left-1/2 size-140 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#43E0B8]/20" />
                    <span className="absolute top-1/2 left-1/2 size-190 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#43E0B8]/10" />
                </span>

                <div className="relative flex flex-col items-center">
                    <span className="text-body-sm-bold rounded-full bg-[#43E0B8] px-3.5 py-1.5 text-[#073F4C]">
                        {visual.category}
                    </span>

                    <h1 className="text-display mt-5 font-black tracking-tight">
                        {visual.headline.map((line) => (
                            <span key={line} className="block">
                                {line}
                            </span>
                        ))}
                    </h1>

                    <p className="text-subhead mt-3.5 opacity-90">{visual.subtitle}</p>

                    {/* 기간은 비주얼 데이터에 또 적지 않고 이벤트 기간을 그대로 쓴다 — 두 값이 어긋날 일이 없다 */}
                    <p className="text-body-sm-bold mt-2.5 text-[#43E0B8]">
                        응모 기간 {formatYmd(event.startsAt)} ~ {formatYmd(event.endsAt)}
                    </p>
                </div>
            </header>

            {/* 2. 경품 — 히어로 위로 끌어올려 걸친다 */}
            <section className="relative -mt-25 px-5 pb-14 text-center sm:px-8">
                {event.detailImageUrl ? (
                    <img
                        src={event.detailImageUrl}
                        alt={prizeLabel}
                        loading="lazy"
                        className="mx-auto block h-auto w-full max-w-105 rounded-[1.25rem] bg-white shadow-[0_24px_48px_-20px_rgba(7,63,76,0.45)]"
                    />
                ) : coupon.emoji ? (
                    // 경품 사진이 없을 때의 가벼운 대역 — 이모지는 글자라 어느 화면에서도 선명하다
                    <p
                        role="img"
                        aria-label={prizeLabel}
                        className="mx-auto grid aspect-[1.6] w-full max-w-105 place-items-center rounded-[1.25rem] border-2 border-[#43E0B8] bg-gradient-to-br from-white to-[#E6FAF4] text-[clamp(4rem,16vw,6rem)] leading-none shadow-[0_24px_48px_-20px_rgba(7,63,76,0.45)]"
                    >
                        {coupon.emoji}
                    </p>
                ) : (
                    <div
                        role="img"
                        aria-label={prizeLabel}
                        className="mx-auto flex aspect-[1.6] w-full max-w-105 flex-col justify-between rounded-[1.25rem] border-2 border-[#43E0B8] bg-gradient-to-br from-white to-[#E6FAF4] px-7 py-6.5 text-left shadow-[0_24px_48px_-20px_rgba(7,63,76,0.45)]"
                    >
                        <div className="text-body-bold flex items-center justify-between text-[#0C5A6B]">
                            <span>{coupon.name}</span>
                            {/* 신호 세기 막대 — 데이터 쿠폰임을 그림으로 알린다 */}
                            <span aria-hidden className="flex h-4.5 items-end gap-0.75">
                                <b className="h-1/4 w-1.25 rounded-sm bg-[#0C5A6B]" />
                                <b className="h-1/2 w-1.25 rounded-sm bg-[#0C5A6B]" />
                                <b className="h-3/4 w-1.25 rounded-sm bg-[#0C5A6B]" />
                                <b className="h-full w-1.25 rounded-sm bg-[#0C5A6B]" />
                            </span>
                        </div>

                        <strong className="text-[clamp(3.5rem,14vw,5rem)] leading-none font-black tracking-tighter text-[#073F4C]">
                            {coupon.amount}
                        </strong>

                        <div className={`text-body-sm-bold flex justify-between ${MUTE}`}>
                            <span>DATA COUPON</span>
                            {coupon.value && <span>{coupon.value}</span>}
                        </div>
                    </div>
                )}

                <p className="mt-6 flex flex-col gap-1">
                    <strong className={`text-title-3 font-extrabold ${INK}`}>{prizeLabel}</strong>
                    {/*
                     * 발표 날짜를 적지 않는다. 최초 공개는 관리자가 명단을 확인한 뒤 직접 하는
                     * 절차라 약속할 시각이 없다 (ADR-022, 05-api/drawing.md)
                     */}
                    <span className={`text-body-sm ${MUTE}`}>
                        {event.winnerCount != null &&
                            `추첨 ${formatNumber(event.winnerCount)}명 · `}
                        마감 후 발표
                    </span>
                </p>
            </section>

            {/* 3. 참여 방법 — 세 단계라 넓은 화면에서는 가로로 나란히 둔다 */}
            <section className="bg-[#E6FAF4] px-5 py-14 sm:px-8">
                <h2 className={`text-title-2 text-center font-extrabold tracking-tight ${INK}`}>
                    참여 방법
                </h2>
                <ol className="mt-7 grid gap-3 sm:grid-cols-3">
                    {visual.steps.map((step, index) => (
                        <li
                            key={step.title}
                            className="grid grid-cols-[2.25rem_1fr] items-center gap-x-3.5 rounded-2xl bg-white px-4.5 py-4 sm:grid-cols-1 sm:place-items-center sm:px-3.5 sm:py-5.5"
                        >
                            <span
                                aria-hidden
                                className="text-body-bold row-span-2 grid size-9 place-items-center rounded-full bg-[#0C5A6B] text-white sm:row-span-1 sm:mb-2.5"
                            >
                                {index + 1}
                            </span>
                            <strong className={`text-subhead ${INK} sm:text-center`}>
                                {step.title}
                            </strong>
                            <p className={`text-body-sm mt-0.5 ${MUTE} sm:text-center`}>
                                {step.description}
                            </p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* 4. 유의사항 — 이미지 안 글자와 달리 화면 읽기에 걸리고 확대해도 깨지지 않는다 */}
            <footer className="bg-[#F3F6F7] px-5 pt-9 pb-12 sm:px-8">
                <h2 className={`text-body-sm-bold ${INK}`}>유의사항</h2>
                <ul
                    className={`text-caption mt-3 flex list-disc flex-col gap-1.5 pl-4.5 leading-relaxed ${MUTE}`}
                >
                    {visual.notices.map((notice) => (
                        <li key={notice}>{notice}</li>
                    ))}
                </ul>
            </footer>
        </article>
    );
}
