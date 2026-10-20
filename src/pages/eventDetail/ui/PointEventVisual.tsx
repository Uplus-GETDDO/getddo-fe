import { motion, useReducedMotion } from 'framer-motion';

import type { Event } from '@entities/event';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { KST_HOUR_MINUTE, formatKst, formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

type PointVisual = Extract<NonNullable<Event['detailVisual']>, { template: 'point' }>;

/*
 * 캠페인 색 — 이 이벤트의 비주얼 전용이다.
 *
 * 토큰(brand/surface)을 쓰지 않고 고정값을 쓴다. 이 영역은 운영자가 만드는 세로 이벤트 이미지가
 * 놓일 자리고, 이미지는 테마를 따라 뒤집히지 않는다. 캠페인마다 색이 다른 것도 이미지와 같다.
 * grade/game 토큰이 다크 모드에 그대로인 것과 같은 이유다 (tokens.css).
 */
const INK = 'text-[#2A1220]';
const MUTE = 'text-[#7E6672]';

/**
 * 멤버십 포인트 응모 비주얼 — 경품이 포인트 하나라 금화 한 장으로 보이는 꼴 (template: 'point').
 *
 * 추첨 인원·응모 기간·참여 자격은 이벤트가 이미 들고 있는 값으로 요약 표를 세운다. 비주얼
 * 데이터에 또 적지 않아 두 값이 어긋날 일이 없다 — 특히 참여 자격은 응모 판정에 쓰는
 * membershipRule에서 끌어오므로, 버튼이 잠기는 이유와 글이 늘 같은 말을 한다.
 *
 * 응모 버튼은 두지 않는다 — 상태(오픈 예정·마감·발표 완료)까지 판정하는 버튼은 화면 바닥의
 * EventEntryBar 하나로 모은다. 같은 버튼이 두 개 보이면 어느 쪽이 지금 상태인지 헷갈린다.
 */
export function PointEventVisual({ event, visual }: { event: Event; visual: PointVisual }) {
    const reduceMotion = useReducedMotion();
    const points = formatNumber(visual.point.amount);
    const summary = [
        { label: '경품', value: `${visual.point.name} ${points}P` },
        // 경품 요약은 상세(E02)에만 있다 — 없으면 인원 자리를 비운다 (spec EventSummary)
        {
            label: '추첨 인원',
            value: event.winnerCount != null ? `${formatNumber(event.winnerCount)}명` : '-',
        },
        {
            label: '응모 기간',
            value: `${formatYmd(event.startsAt)} ~ ${formatYmd(event.endsAt)}`,
            // 마감 시각은 강조색으로 따로 붙인다 — 기간보다 이 시각을 놓치기 쉽다
            accent: `${formatKst(event.endsAt, KST_HOUR_MINUTE)} 마감`,
        },
        { label: '참여 자격', value: `${MEMBERSHIP_LABEL[event.membershipRule]} 등급 이상` },
    ];

    return (
        <article className="border-border-default mx-auto w-full max-w-180 overflow-hidden rounded-2xl border bg-white break-keep">
            {/* 1. 타이틀 + 포인트 금화 — 금화 뒤로 금빛이 번지도록 방사 그라데이션을 겹친다 */}
            <header
                className="px-5 pt-13 pb-14 text-center text-white sm:px-8 sm:pt-16"
                style={{
                    background:
                        'radial-gradient(circle at 50% 78%, rgba(255, 200, 61, 0.28) 0, transparent 42%), #D81B76',
                }}
            >
                <span className="text-body-sm-bold rounded-full border-[1.5px] border-white/50 px-3.5 py-1.5">
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

                {/*
                 * 운영자 사진이 있으면 그걸 보이고, 없을 때만 금화를 그린다.
                 * 목록 카드 썸네일과 같은 그림이 이어져야 들어온 사람이 같은 이벤트로 읽는다.
                 */}
                {event.detailImageUrl ? (
                    <motion.img
                        src={event.detailImageUrl}
                        alt={`${visual.point.name} ${points}포인트`}
                        initial={reduceMotion ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.7, ease: [0.2, 1.4, 0.4, 1] }}
                        // 금화와 같은 자리를 차지하도록 정사각으로 고정한다 — 세로 비율이 다른 사진이 와도 히어로 높이가 흔들리지 않는다
                        className="mx-auto mt-10 block size-47.5 rounded-[2.5rem] border-6 border-white/90 object-cover shadow-[0_30px_50px_-24px_rgba(60,0,30,0.6)] sm:size-60 sm:rounded-[3rem]"
                    />
                ) : (
                    // 금화는 장식이라 포인트 값을 대체 텍스트로 읽어 준다
                    <motion.div
                        role="img"
                        aria-label={`${visual.point.name} ${points}포인트`}
                        initial={reduceMotion ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.7, ease: [0.2, 1.4, 0.4, 1] }}
                        className="mx-auto mt-10 grid size-47.5 place-items-center rounded-full bg-[#E39B00] pb-2.5 shadow-[0_30px_50px_-24px_rgba(0,0,0,0.55)] sm:size-57.5"
                    >
                        <span className="flex size-full flex-col items-center justify-center rounded-full border-6 border-[#FFE08A] bg-[#FFC83D] text-[#7A0E45]">
                            <strong className="text-[2.875rem] leading-none font-black tracking-tighter sm:text-[3.625rem]">
                                {points}
                            </strong>
                            <span className="text-body-sm-bold mt-1.5 tracking-[0.2em]">POINT</span>
                        </span>
                    </motion.div>
                )}
            </header>

            {/* 2. 이벤트 요약 */}
            <section className="px-5 py-10 sm:px-8">
                <dl className="flex flex-col rounded-[1.125rem] bg-[#FDEEF5] px-4.5 py-2 sm:px-6">
                    {summary.map(({ label, value, accent }) => (
                        <div
                            key={label}
                            className="grid grid-cols-[5rem_1fr] gap-3 border-t border-[#F7D3E4] py-4 first:border-t-0 sm:grid-cols-[6rem_1fr]"
                        >
                            <dt className={`text-body-sm ${MUTE}`}>{label}</dt>
                            <dd className={`text-body-bold ${INK}`}>
                                {value}
                                {accent && <span className="ml-1 text-[#D81B76]">{accent}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* 3. 참여 방법 — 단계가 이어진다는 걸 세로 점선으로 보인다 */}
            <section className="px-5 pt-4 pb-14 sm:px-8">
                <h2 className={`text-title-2 text-center font-extrabold tracking-tight ${INK}`}>
                    이렇게 참여해요
                </h2>
                <ol className="relative mt-6">
                    <span
                        aria-hidden
                        className="absolute top-6 bottom-6 left-4.75 border-l-2 border-dashed border-[#F2B6D2]"
                    />
                    {visual.steps.map((step, index) => (
                        <li key={step.title} className="relative flex items-center gap-4 py-3">
                            <span
                                aria-hidden
                                className="text-body-bold grid size-10 shrink-0 place-items-center rounded-full bg-[#D81B76] text-white"
                            >
                                {index + 1}
                            </span>
                            <div className="flex min-w-0 flex-col">
                                <strong className={`text-subhead ${INK}`}>{step.title}</strong>
                                <p className={`text-body-sm mt-0.5 ${MUTE}`}>{step.description}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* 4. 유의사항 — 이미지 안 글자와 달리 화면 읽기에 걸리고 확대해도 깨지지 않는다 */}
            <footer className="bg-[#F5F4F8] px-5 pt-9 pb-12 sm:px-8">
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
