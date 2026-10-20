import type { Event } from '@entities/event';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { KST_HOUR_MINUTE, formatKst, formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

type VoucherVisual = Extract<NonNullable<Event['detailVisual']>, { template: 'voucher' }>;

/*
 * 캠페인 색 — 이 이벤트의 비주얼 전용이다.
 *
 * 토큰(brand/surface)을 쓰지 않고 고정값을 쓴다. 이 영역은 운영자가 만드는 세로 이벤트 이미지가
 * 놓일 자리고, 이미지는 테마를 따라 뒤집히지 않는다. 캠페인마다 색이 다른 것도 이미지와 같다.
 * grade/game 토큰이 다크 모드에 그대로인 것과 같은 이유다 (tokens.css).
 */
const INK = 'text-[#23161A]';
const MUTE = 'text-[#7A6A6D]';

/*
 * 티켓 가장자리의 반원 홈 — 본권과 반쪽이 맞닿는 자리를 파낸다.
 * 테두리를 겹쳐 그리면 배경색이 바뀔 때마다 홈이 드러나므로 마스크로 실제로 뚫는다.
 */
const MAIN_NOTCH =
    'radial-gradient(circle 12px at 100% 50%, transparent 98%, #000) right / 100% 100% no-repeat';
const STUB_NOTCH = 'radial-gradient(circle 12px at 0 50%, transparent 98%, #000)';

/**
 * 금액권 쿠폰 비주얼 — 경품이 금액권 하나라 뜯는 티켓 한 장으로 보이는 꼴 (template: 'voucher').
 *
 * 추첨 인원·응모 기간·마감 시각·참여 자격·참여 방법은 이벤트가 이미 들고 있는 값으로 요약 표를
 * 세운다. 특히 참여 자격은 응모 판정에 쓰는 membershipRule에서 끌어오므로, 버튼이 잠기는
 * 이유와 글이 늘 같은 말을 한다.
 *
 * 응모 버튼은 두지 않는다 — 상태(오픈 예정·마감·발표 완료)까지 판정하는 버튼은 화면 바닥의
 * EventEntryBar 하나로 모은다. 같은 버튼이 두 개 보이면 어느 쪽이 지금 상태인지 헷갈린다.
 */
export function VoucherEventVisual({ event, visual }: { event: Event; visual: VoucherVisual }) {
    const { voucher } = visual;
    // 운영자가 쓰는 표기('5천원')가 있으면 그걸 쓰고, 없으면 금액을 '5,000원'으로 적는다
    const amountText = voucher.amountLabel ?? `${formatNumber(voucher.amount)}원`;
    // 티켓은 '원'을 작게 따로 세우므로 표기에서 떼어 낸다
    const amountHead = amountText.replace(/원$/, '');
    // 경품 요약은 상세(E02)에만 있다 — 없으면 인원 자리를 비운다 (spec EventSummary)
    const winners = event.winnerCount != null ? formatNumber(event.winnerCount) : null;
    const summary = [
        { label: '경품', value: `${voucher.name} ${amountText}` },
        { label: '추첨 인원', value: winners == null ? '-' : `${winners}명` },
        {
            label: '응모 기간',
            value: `${formatYmd(event.startsAt)} ~ ${formatYmd(event.endsAt)}`,
            // 마감 시각은 강조색으로 따로 붙인다 — 기간보다 이 시각을 놓치기 쉽다
            accent: `${formatKst(event.endsAt, KST_HOUR_MINUTE)} 마감`,
        },
        {
            label: '참여 방법',
            value:
                event.eventType === 'NO_TICKET'
                    ? '응모권 없이 한 번 참여'
                    : `응모권 ${event.requiredTickets}장으로 참여`,
        },
        { label: '참여 자격', value: `${MEMBERSHIP_LABEL[event.membershipRule]} 등급 이상` },
    ];

    return (
        <article className="border-border-default mx-auto w-full max-w-180 overflow-hidden rounded-2xl border bg-white break-keep">
            {/* 1. 타이틀 + 쿠폰 티켓 */}
            <header className="bg-[#D9283A] px-5 pt-13 pb-14 text-center text-white sm:px-8 sm:pt-16">
                <span className="text-body-sm-bold rounded-full bg-[#FFE07A] px-3.5 py-1.5 text-[#23161A]">
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
                 * 운영자 사진이 있으면 그걸 보이고, 없을 때만 쿠폰을 그린다.
                 * 목록 카드 썸네일과 같은 그림이 이어져야 들어온 사람이 같은 이벤트로 읽는다.
                 * 사진은 기울이지 않는다 — 기울임은 종이 쿠폰처럼 보이게 하는 장치고, 실물 사진에는 어색하다.
                 */}
                {event.detailImageUrl ? (
                    <img
                        src={event.detailImageUrl}
                        alt={`${voucher.name} ${amountText}`}
                        className="mx-auto mt-10 block h-auto w-full max-w-100 rounded-[1.25rem] bg-white shadow-[0_24px_40px_-20px_rgba(80,0,10,0.45)]"
                    />
                ) : voucher.emoji ? (
                    // 경품 사진이 없을 때의 가벼운 대역 — 이모지는 글자라 어느 화면에서도 선명하다
                    <p
                        role="img"
                        aria-label={`${voucher.name} ${amountText} · 추첨 ${winners == null ? '-' : `${winners}명`}`}
                        className="mx-auto mt-10 grid aspect-[1.9] w-full max-w-100 place-items-center rounded-[1.25rem] bg-white text-[clamp(4rem,16vw,6rem)] leading-none shadow-[0_24px_40px_-20px_rgba(80,0,10,0.45)]"
                    >
                        {voucher.emoji}
                    </p>
                ) : (
                    <div
                        role="img"
                        aria-label={`${voucher.name} ${amountText} · 추첨 ${winners == null ? '-' : `${winners}명`}`}
                        className="mx-auto mt-10 flex max-w-115 -rotate-3 drop-shadow-[0_24px_30px_rgba(80,0,10,0.35)]"
                    >
                        <div
                            style={{ WebkitMask: MAIN_NOTCH, mask: MAIN_NOTCH }}
                            className={`flex flex-1 flex-col gap-1.5 rounded-l-[1.125rem] bg-white px-4.5 py-5.5 text-left sm:px-6.5 sm:py-7 ${INK}`}
                        >
                            <span className="text-body-bold text-[#D9283A]">{voucher.name}</span>
                            <strong className="text-[clamp(3.25rem,13vw,4.5rem)] leading-none font-black tracking-tighter">
                                {amountHead}
                                <small className="ml-1 text-[0.42em] font-black tracking-normal">
                                    원
                                </small>
                            </strong>
                            <span className={`text-caption ${MUTE}`}>
                                발급일로부터 {voucher.validDays}일간 사용
                            </span>
                        </div>
                        {/* 반쪽 — 점선으로 뜯는 자리를 보인다 */}
                        <div
                            style={{ WebkitMask: STUB_NOTCH, mask: STUB_NOTCH }}
                            className={`text-body-sm-bold flex w-21 shrink-0 flex-col items-center justify-center rounded-r-[1.125rem] border-l-[3px] border-dashed border-[#23161A]/25 bg-[#FFE07A] sm:w-26 ${INK}`}
                        >
                            <span>추첨</span>
                            <strong className="text-title-2 font-black">{winners ?? '-'}</strong>
                            <span>명</span>
                        </div>
                    </div>
                )}
            </header>

            {/* 2. 이벤트 요약 */}
            <section className="px-5 py-11 sm:px-8">
                <dl className="flex flex-col rounded-[1.125rem] bg-[#FFF1EE] px-4.5 py-1.5 sm:px-6">
                    {summary.map(({ label, value, accent }) => (
                        <div
                            key={label}
                            className="grid grid-cols-[5rem_1fr] gap-3 border-t border-[#F6D6D0] py-3.75 first:border-t-0 sm:grid-cols-[6rem_1fr]"
                        >
                            <dt className={`text-body-sm ${MUTE}`}>{label}</dt>
                            <dd className={`text-body-bold ${INK}`}>
                                {value}
                                {accent && <span className="ml-1 text-[#D9283A]">{accent}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* 3. 당첨 후 쿠폰 쓰는 법 */}
            <section className="bg-[#FFF1EE] px-5 py-12 sm:px-8">
                <h2 className={`text-title-2 text-center font-extrabold tracking-tight ${INK}`}>
                    당첨되면 이렇게 써요
                </h2>
                <ol className="mt-6 flex flex-col gap-2.5">
                    {visual.steps.map((step, index) => (
                        <li
                            key={step.title}
                            className="flex items-center gap-4 rounded-xl bg-white px-5 py-4"
                        >
                            <span
                                aria-hidden
                                className="text-body-bold grid size-9.5 shrink-0 place-items-center rounded-full bg-[#D9283A] text-white"
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

                {/* 문자 미리보기 — 단계 설명을 그림으로 거든다. 가짜 코드라 화면 읽기에서는 뺀다 */}
                {visual.smsPreview && (
                    <div
                        aria-hidden
                        className={`text-body-sm mx-auto mt-7 max-w-100 rounded-[1.25rem] rounded-bl-[0.25rem] border-[1.5px] border-[#F2C9C2] bg-white px-5 py-4.5 leading-relaxed ${INK}`}
                    >
                        <p className="text-body-sm-bold mb-1 text-[#D9283A]">
                            {visual.smsPreview.from}
                        </p>
                        {visual.smsPreview.lines.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                )}
            </section>

            {/* 4. 유의사항 — 이미지 안 글자와 달리 화면 읽기에 걸리고 확대해도 깨지지 않는다 */}
            <footer className="bg-[#F5F3F3] px-5 pt-9 pb-12 sm:px-8">
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
