import type { Event } from '@entities/event';

import { formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

type PrizeTiersVisual = Extract<NonNullable<Event['detailVisual']>, { template: 'prizeTiers' }>;

/**
 * 등수별 경품 비주얼 — 1·2·3등을 줄로 세우는 꼴 (template: 'prizeTiers').
 *
 * 운영자가 만드는 세로로 긴 이벤트 이미지를 대신하는 본문이다. 이미지 한 장으로 받으면 글자가
 * 화면 읽기에 걸리지 않고 확대하면 깨져서, 같은 구성을 데이터(detailVisual)로 받아 조립한다.
 * 캠페인 비주얼이라 페이지 머리말(칩·제목·기간)을 이 안에 품고, 바깥에서는 이것만 본문으로 깐다.
 *
 * 응모 버튼은 두지 않는다 — 상태(오픈 예정·마감·발표 완료)까지 판정하는 버튼은 화면 바닥의
 * EventEntryBar 하나로 모은다. 같은 버튼이 두 개 보이면 어느 쪽이 지금 상태인지 헷갈린다.
 *
 * 경품 한 종류를 쿠폰 한 장으로 보이는 꼴은 CouponEventVisual이 맡는다.
 */
export function EventDetailVisual({ event, visual }: { event: Event; visual: PrizeTiersVisual }) {
    return (
        <article className="bg-surface-page border-border-default mx-auto w-full max-w-180 overflow-hidden rounded-2xl border break-keep">
            {/* 1. 타이틀 배너 */}
            <header className="bg-brand-primary text-fg-on-brand relative overflow-hidden px-5 py-12 text-center sm:px-10 sm:pt-16 sm:pb-12">
                {/* 배경 장식 원 — 제목 뒤에 깔리므로 포인터·읽기 대상에서 뺀다 */}
                <span
                    aria-hidden
                    className="bg-brand-primary-pressed pointer-events-none absolute -top-22 -right-20 size-65 rounded-full"
                />
                <span
                    aria-hidden
                    className="bg-ticket-primary pointer-events-none absolute bottom-30 -left-15 size-35 rounded-full opacity-90"
                />

                <div className="relative flex flex-col items-center">
                    <span className="bg-ticket-primary text-ticket-on text-body-sm-bold rounded-full px-3.5 py-1.5">
                        {visual.category}
                    </span>

                    <h1 className="text-display mt-5 font-black tracking-tight">
                        {visual.headline.map((line) => (
                            <span key={line} className="block">
                                {line}
                            </span>
                        ))}
                    </h1>

                    <p className="text-subhead mt-3 opacity-90">{visual.subtitle}</p>

                    {/* 응모권 모양 2칸 상자 — 가운데를 점선으로 끊어 절취선처럼 보인다 */}
                    <dl className="bg-surface-page text-fg-primary mt-8 grid w-full grid-cols-2 rounded-2xl text-left">
                        <div className="px-5 py-4.5">
                            <dt className="text-caption text-fg-tertiary">응모 기간</dt>
                            {/* 기간은 비주얼 데이터에 또 적지 않고 이벤트 기간을 그대로 쓴다 — 두 값이 어긋날 일이 없다 */}
                            <dd className="text-body-bold mt-1">
                                {formatYmd(event.startsAt)} ~ {formatYmd(event.endsAt)}
                            </dd>
                        </div>
                        <div className="border-border-brand-subtle border-l-2 border-dashed px-5 py-4.5">
                            <dt className="text-caption text-fg-tertiary">당첨자 발표</dt>
                            {/*
                             * 날짜를 적지 않는다. 최초 공개는 관리자가 명단을 확인한 뒤 직접 하는
                             * 절차라 약속할 시각이 없다 (ADR-022, 05-api/drawing.md)
                             */}
                            <dd className="text-body-bold mt-1">마감 후 공개</dd>
                        </div>
                    </dl>
                </div>
            </header>

            {/* 2. 경품 */}
            <section className="px-5 py-14 sm:px-8">
                <h2 className="text-title-2 text-fg-primary text-center font-extrabold tracking-tight">
                    이런 경품을 드려요
                </h2>
                <ul className="mt-7 flex flex-col gap-3">
                    {visual.prizes.map((prize, index) => (
                        <li
                            key={`${prize.rank}-${prize.name}`}
                            // 1등만 브랜드 테두리로 올린다 — 등수 순서가 한눈에 읽힌다
                            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-4 sm:gap-3 sm:px-5 ${
                                index === 0
                                    ? 'border-border-brand bg-brand-soft'
                                    : 'border-brand-soft'
                            }`}
                        >
                            {prize.emoji && (
                                <span aria-hidden className="w-9 shrink-0 text-center text-2xl">
                                    {prize.emoji}
                                </span>
                            )}
                            <span className="text-body-bold text-fg-brand w-11 shrink-0">
                                {prize.rank}
                            </span>
                            <span className="text-subhead text-fg-primary min-w-0 flex-1 font-bold">
                                {prize.name}
                            </span>
                            <span className="text-body-sm text-fg-tertiary shrink-0 tabular-nums">
                                {formatNumber(prize.count)}명
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* 3. 참여 방법 */}
            <section className="bg-brand-soft px-5 py-14 sm:px-8">
                <h2 className="text-title-2 text-fg-primary text-center font-extrabold tracking-tight">
                    참여 방법
                </h2>
                <ol className="mt-7 flex flex-col gap-3.5">
                    {visual.steps.map((step, index) => (
                        <li
                            key={step.title}
                            className="bg-surface-page flex items-center gap-4 rounded-xl px-5 py-4.5"
                        >
                            <span
                                aria-hidden
                                className="bg-brand-primary text-fg-on-brand text-body-bold grid size-10 shrink-0 place-items-center rounded-full"
                            >
                                {index + 1}
                            </span>
                            <div className="flex min-w-0 flex-col">
                                <strong className="text-subhead text-fg-primary">
                                    {step.title}
                                </strong>
                                <p className="text-body-sm text-fg-tertiary mt-0.5">
                                    {step.description}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* 4. 유의사항 */}
            <footer className="bg-surface-canvas px-5 pt-9 pb-12 sm:px-8">
                <h2 className="text-body-sm-bold text-fg-primary">유의사항</h2>
                <ul className="text-caption text-fg-tertiary mt-3 flex list-disc flex-col gap-1.5 pl-4.5 leading-relaxed">
                    {visual.notices.map((notice) => (
                        <li key={notice}>{notice}</li>
                    ))}
                </ul>
            </footer>
        </article>
    );
}
