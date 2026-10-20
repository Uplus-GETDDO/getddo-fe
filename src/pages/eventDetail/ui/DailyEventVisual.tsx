import type { Event } from '@entities/event';

import { useMyEntries } from '@entities/entry';
import { useVirtualClock } from '@shared/model/virtualClock';
import { formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { buildEntryCalendar } from '../utils/entryCalendar';

type DailyVisual = Extract<NonNullable<Event['detailVisual']>, { template: 'daily' }>;

/*
 * 캠페인 색 — 이 이벤트의 비주얼 전용이다.
 *
 * 토큰(brand/surface)을 쓰지 않고 고정값을 쓴다. 이 영역은 운영자가 만드는 세로 이벤트 이미지가
 * 놓일 자리고, 이미지는 테마를 따라 뒤집히지 않는다. 캠페인마다 색이 다른 것도 이미지와 같다.
 * grade/game 토큰이 다크 모드에 그대로인 것과 같은 이유다 (tokens.css).
 */
const INK = 'text-[#2A1810]';
const MUTE = 'text-[#6E7A82]';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 경품 사진이 없을 때 자리를 채우는 컵 — 단순한 도형만 쓴다 */
function CupFigure() {
    return (
        <svg viewBox="0 0 160 220" aria-hidden className="h-auto w-27.5 sm:w-42.5">
            {/* 컵 몸통 */}
            <path d="M28 52H132L118 206Q117 214 108 214H52Q43 214 42 206Z" fill="#ffffff8c" />
            {/* 음료 */}
            <path d="M36 92H124L116 202Q115 208 108 208H52Q45 208 44 202Z" fill="#3A2216" />
            {/* 얼음 */}
            <rect x="56" y="106" width="22" height="20" rx="4" fill="#ffffff59" />
            <rect x="86" y="132" width="20" height="18" rx="4" fill="#ffffff4d" />
            <rect x="60" y="156" width="18" height="16" rx="4" fill="#ffffff40" />
            {/* 뚜껑과 빨대 */}
            <rect x="22" y="40" width="116" height="16" rx="8" fill="#fff" />
            <rect x="94" y="0" width="8" height="64" rx="4" fill="#2A1810" />
        </svg>
    );
}

/**
 * 기간 응모 비주얼 — 응모 현황을 달력으로 보이는 꼴 (template: 'daily').
 *
 * 달력은 운영자가 적는 값이 아니라 이벤트 기간과 내 응모 기록(E06)에서 만든다. 화면이 응모
 * 여부를 추측하지 않고 서버가 접수한 기록만 도장으로 찍는다.
 *
 * 히어로는 좌우로 나뉘어 오른쪽에 경품이 선다. 배경을 경품 사진 배경과 같은 색으로 주면
 * 사진이 배경에 얹힌 것처럼 이어진다 (daily.heroHex).
 *
 * 응모 버튼은 두지 않는다 — 상태(오픈 예정·마감·발표 완료)까지 판정하는 버튼은 화면 바닥의
 * EventEntryBar 하나로 모은다. 같은 버튼이 두 개 보이면 어느 쪽이 지금 상태인지 헷갈린다.
 */
export function DailyEventVisual({ event, visual }: { event: Event; visual: DailyVisual }) {
    const clock = useVirtualClock();
    const { data: entries } = useMyEntries();
    // 접수된 응모만 도장으로 찍는다 — 거절된 요청은 참여 기록이 아니다
    const enteredAt = (entries ?? [])
        .filter((entry) => entry.eventId === event.id && entry.status === 'ACCEPTED')
        .map((entry) => entry.requestedAt);
    const calendar = buildEntryCalendar(event.startsAt, event.endsAt, enteredAt, clock.now());

    return (
        <article className="border-border-default mx-auto w-full max-w-180 overflow-hidden rounded-2xl border bg-white break-keep">
            {/* 1. 타이틀 + 경품 — 글과 경품을 좌우로 벌려 첫 화면에 둘 다 들어온다 */}
            <header
                className="flex items-end justify-between gap-4 px-5 pt-12 sm:px-9 sm:pt-14"
                style={{ background: visual.daily.heroHex }}
            >
                <div className="flex flex-col pb-9 sm:pb-12">
                    <span
                        className={`text-body-sm-bold w-fit rounded-full bg-[#2A1810] px-3.5 py-1.5 text-white`}
                    >
                        {visual.category}
                    </span>

                    <h1 className={`text-display mt-4.5 font-black tracking-tight ${INK}`}>
                        {visual.headline.map((line) => (
                            <span key={line} className="block">
                                {line}
                            </span>
                        ))}
                    </h1>

                    <p className="text-body mt-3 text-[#5B3A28]">{visual.subtitle}</p>

                    {/* 기간·추첨 인원은 이벤트 값을 그대로 쓴다 — 글에 숫자를 박지 않는다 */}
                    <p className={`text-body-sm-bold mt-3.5 ${INK}`}>
                        {formatYmd(event.startsAt)} ~ {formatYmd(event.endsAt)}
                        {event.winnerCount != null &&
                            ` · 총 ${formatNumber(event.winnerCount)}명 추첨`}
                    </p>
                </div>

                {event.detailImageUrl ? (
                    <img
                        src={event.detailImageUrl}
                        alt={visual.daily.prizeName}
                        // 배경색이 사진 배경과 같아 아래를 붙이면 바닥에 선 것처럼 이어진다
                        className="-mr-3 w-37.5 shrink-0 self-end sm:-mr-5 sm:w-65"
                    />
                ) : (
                    <div className="shrink-0 self-end">
                        <CupFigure />
                    </div>
                )}
            </header>

            {/* 2. 응모 현황 달력 */}
            <section className="px-4 py-11 sm:px-8">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className={`text-title-2 font-extrabold tracking-tight ${INK}`}>
                        나의 응모 현황
                    </h2>
                    <p className={`text-body-sm ${MUTE}`}>
                        <strong className={`text-title-3 font-black ${INK}`}>
                            {calendar.enteredCount}
                        </strong>
                        일 응모 / 총 {calendar.days.length}일
                    </p>
                </div>

                {/*
                 * 읽기 전용이라 격자(grid)가 아니라 목록으로 읽힌다.
                 * role="grid"는 행(row) 구조와 화살표 키 이동까지 요구하는데 이 달력은 둘 다 없다.
                 * 요일 머리글과 빈 칸은 자리를 맞추는 장식이고, 날짜마다 전체 날짜를 읽어 주므로 숨긴다.
                 */}
                <div
                    role="list"
                    aria-label="이벤트 기간 응모 현황"
                    className="mt-4.5 grid grid-cols-7 gap-1.5 rounded-[1.125rem] border-2 border-[#CDEAE4] bg-[#F4FBF9] p-3 sm:gap-2 sm:p-5"
                >
                    {WEEKDAYS.map((weekday) => (
                        <span
                            key={weekday}
                            aria-hidden
                            className={`text-caption pb-1 text-center ${MUTE}`}
                        >
                            {weekday}
                        </span>
                    ))}
                    {Array.from({ length: calendar.leadingBlanks }, (_, index) => (
                        <span key={`blank-${index}`} aria-hidden />
                    ))}
                    {calendar.days.map((day) => (
                        <span
                            key={day.key}
                            role="listitem"
                            // 아직 오지 않은 날은 덧붙일 상태가 없다 — 빈 문자열을 이어 붙이면 공백으로 끝난다
                            aria-label={[
                                day.key,
                                day.entered ? '응모 완료' : day.missed ? '미응모' : null,
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            className={`text-body-sm relative grid aspect-square place-items-center rounded-xl font-semibold ${
                                day.entered
                                    ? 'bg-[#2A1810] text-white'
                                    : day.missed
                                      ? 'bg-white text-[#B5BEC4]'
                                      : `bg-white ${INK}`
                            } ${day.today ? 'outline-2 -outline-offset-2 outline-[#2A1810]' : ''}`}
                        >
                            {day.entered ? (
                                <>
                                    <span className="text-caption absolute top-1 left-1.5 opacity-70">
                                        {day.day}
                                    </span>
                                    <span aria-hidden className="text-lg">
                                        ☕
                                    </span>
                                </>
                            ) : (
                                day.day
                            )}
                        </span>
                    ))}
                </div>
            </section>

            {/* 3. 참여 방법 — 세 단계라 넓은 화면에서는 가로로 나란히 둔다 */}
            <section className="bg-[#F4FBF9] px-5 py-12 sm:px-8">
                <h2 className={`text-title-2 text-center font-extrabold tracking-tight ${INK}`}>
                    참여 방법
                </h2>
                <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                    {visual.steps.map((step, index) => (
                        <li
                            key={step.title}
                            className="grid grid-cols-[2.125rem_1fr] items-center gap-x-3.5 rounded-2xl border-[1.5px] border-[#CDEAE4] bg-white px-4.5 py-4 sm:grid-cols-1 sm:place-items-center sm:px-3.5 sm:py-5.5"
                        >
                            <span
                                aria-hidden
                                className={`text-body-bold row-span-2 grid size-8.5 place-items-center rounded-full bg-[#8FCFC3] sm:row-span-1 sm:mb-2.5 ${INK}`}
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
            <footer className="bg-[#F2F4F5] px-5 pt-9 pb-12 sm:px-8">
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
