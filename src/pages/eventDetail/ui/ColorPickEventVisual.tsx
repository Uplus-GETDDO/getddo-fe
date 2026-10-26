import { useId, useState } from 'react';

import type { Event } from '@entities/event';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { KST_HOUR_MINUTE, formatKst, formatYmd } from '@shared/utils/date';
import { formatNumber } from '@shared/utils/format';

import { tintFilter } from '../utils/tintFilter';

type ColorPickVisual = Extract<NonNullable<Event['detailVisual']>, { template: 'colorPick' }>;

/*
 * 캠페인 색 — 이 이벤트의 비주얼 전용이다.
 *
 * 토큰(brand/surface)을 쓰지 않고 고정값을 쓴다. 이 영역은 운영자가 만드는 세로 이벤트 이미지가
 * 놓일 자리고, 이미지는 테마를 따라 뒤집히지 않는다. 캠페인마다 색이 다른 것도 이미지와 같다.
 * grade/game 토큰이 다크 모드에 그대로인 것과 같은 이유다 (tokens.css).
 */
const INK = 'text-[#1A222C]';
const MUTE = 'text-[#66717E]';

/** 스트랩 그림 — 밴드 색만 고른 색으로 바뀐다 */
function StrapFigure({ hex }: { hex: string }) {
    return (
        <svg viewBox="0 0 200 320" aria-hidden className="h-auto w-42.5">
            {/* 위 밴드 */}
            <path d="M64 0H136V96H64Z" fill={hex} className="transition-[fill] duration-350" />
            {/* 아래 밴드 + 조절 구멍 */}
            <path
                d="M64 224H136V306Q136 320 122 320H78Q64 320 64 306Z"
                fill={hex}
                className="transition-[fill] duration-350"
            />
            {[248, 268, 288].map((y) => (
                <circle key={y} cx="100" cy={y} r="4" fill="rgba(0,0,0,.25)" />
            ))}
            {/* 밴드 결 — 한쪽에 밝은 띠를 줘 가죽처럼 보인다 */}
            <path d="M64 0H74V96H64ZM64 224H74V320H64Z" fill="rgba(255,255,255,.12)" />
            {/* 워치 본체 */}
            <circle cx="100" cy="160" r="70" fill="#1A1E23" />
            <circle cx="100" cy="160" r="62" fill="#2A3038" />
            <circle cx="100" cy="160" r="56" fill="#0F1216" />
            <text
                x="100"
                y="168"
                textAnchor="middle"
                fontSize="24"
                fontWeight="700"
                fill="#fff"
                fontFamily="inherit"
            >
                10:25
            </text>
            <circle cx="173" cy="140" r="5" fill="#1A1E23" />
        </svg>
    );
}

/**
 * 색상 랜덤 증정 비주얼 — 굿즈 색을 골라 보는 꼴 (template: 'colorPick').
 *
 * 색을 고르는 건 미리보기일 뿐 응모에 실리지 않는다. 색상은 당첨자에게 무작위로 발송되므로,
 * 고른 색이 신청으로 읽히지 않도록 바로 아래에 '실제 색상은 무작위' 안내를 붙인다.
 *
 * 색 고르기는 라디오 버튼으로 둔다 — 화살표 키 이동·그룹 읽기를 브라우저가 해 준다.
 * 직접 만든 버튼 묶음은 그걸 다시 구현해야 하고 보통 빠뜨린다.
 *
 * 응모 버튼은 두지 않는다 — 상태(오픈 예정·마감·발표 완료)까지 판정하는 버튼은 화면 바닥의
 * EventEntryBar 하나로 모은다. 같은 버튼이 두 개 보이면 어느 쪽이 지금 상태인지 헷갈린다.
 */
export function ColorPickEventVisual({ event, visual }: { event: Event; visual: ColorPickVisual }) {
    const { giveaway } = visual;
    const groupName = useId();
    const [picked, setPicked] = useState(0);
    const colors = giveaway.colors;
    // 스키마가 색을 한 개 이상 받지만(min(1)) 그건 타입으로 드러나지 않는다 — 빈 목록이 오면 그린다는 게 없다
    const color = colors[picked] ?? colors[0];
    // 경품 요약은 상세(E02)에만 있다 — 없으면 인원 자리를 비운다 (spec EventSummary)
    const winners = event.winnerCount != null ? `${formatNumber(event.winnerCount)}명` : null;

    if (!color) return null;

    /*
     * 고른 색을 어떻게 보일지 — 정확한 쪽부터 쓴다.
     * 1. 그 색 실사 사진이 있으면 그대로 (가장 정확)
     * 2. 기준 사진이 있으면 그 한 장을 색만 틀어서 (근사)
     * 3. 둘 다 없으면 그린 그림에 색을 칠해서
     */
    const photoUrl = color.photoUrl ?? giveaway.photo?.url;
    const filter = color.photoUrl
        ? undefined
        : giveaway.photo && tintFilter(giveaway.photo.baseHex, color.hex);
    /*
     * 색을 틀 때만 덧장을 덮는다.
     *
     * 필터는 사진 전체에 걸려 굿즈 색과 상관없는 화면까지 같이 돈다. 그 부분만 떼어낸 덧장을
     * 원본 그대로 위에 올려 되살린다. 그 색 실사 사진을 쓰는 중이면 틀 게 없으니 덮지 않는다.
     */
    const overlayUrl = filter ? giveaway.photo?.overlayUrl : undefined;

    const summary = [
        { label: '경품', value: giveaway.name, accent: '색상 랜덤' },
        { label: '추첨 인원', value: winners ?? '-' },
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
            {/* 1. 타이틀 + 스트랩 미리보기 */}
            <header className="bg-[#27313D] px-5 pt-12 pb-11 text-center text-white sm:px-8 sm:pt-15">
                <span className="text-body-sm-bold rounded-full bg-[#FF8FA3] px-3.5 py-1.5 text-[#1A222C]">
                    {/* 몇 명에게 주는지는 이벤트 값에서 끌어온다 — 글에 숫자를 박지 않는다 */}
                    {visual.category}
                    {winners && ` · ${winners}`}
                </span>

                <h1 className="text-display mt-5 font-black tracking-tight">
                    {visual.headline.map((line) => (
                        <span key={line} className="block">
                            {line}
                        </span>
                    ))}
                </h1>

                <p className="text-subhead mt-3.5 opacity-85">{visual.subtitle}</p>

                {/* 무대 — 가운데로 빛이 모이는 원 */}
                <div
                    className="mx-auto mt-7 grid size-60 place-items-center rounded-full sm:size-72"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(255,255,255,.12) 0, transparent 68%)',
                    }}
                >
                    {photoUrl ? (
                        <span className="relative block w-52 sm:w-60">
                            <img
                                src={photoUrl}
                                alt={`${giveaway.name} ${color.name}`}
                                style={filter ? { filter } : undefined}
                                className="block h-auto w-full transition-[filter] duration-350"
                            />
                            {overlayUrl && (
                                // 기준 사진과 같은 크기라 같은 자리에 겹치면 화면만 원본으로 돌아온다
                                <img
                                    src={overlayUrl}
                                    alt=""
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 block h-auto w-full"
                                />
                            )}
                        </span>
                    ) : (
                        <StrapFigure hex={color.hex} />
                    )}
                </div>

                {/* 고를 색이 하나뿐이면 스와치를 접는다 — 고를 게 없는데 라디오만 덩그러니 남는다 */}
                {colors.length > 1 && (
                    <fieldset className="mt-6 border-0 p-0">
                        <legend className="sr-only">{giveaway.name} 색상 미리보기</legend>
                        <div className="flex justify-center gap-3">
                            {colors.map((swatch, index) => (
                                <label
                                    key={swatch.name}
                                    className="cursor-pointer"
                                    // 색만으로는 무엇인지 알 수 없어 색 이름을 늘 붙여 둔다
                                    title={swatch.name}
                                >
                                    <input
                                        type="radio"
                                        name={groupName}
                                        checked={picked === index}
                                        onChange={() => setPicked(index)}
                                        className="peer sr-only"
                                    />
                                    <span className="sr-only">{swatch.name}</span>
                                    <span
                                        aria-hidden
                                        style={{ background: swatch.hex }}
                                        className="block size-8.5 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.25)] peer-checked:shadow-[0_0_0_3px_#fff] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#FF8FA3]"
                                    />
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}

                <p className="text-body-sm mt-3 opacity-75" aria-live="polite">
                    {colors.length > 1 ? `${color.name} 미리보기 · ` : ''}
                    실제 색상은 무작위로 발송돼요
                </p>
            </header>

            {/* 2. 이벤트 요약 */}
            <section className="px-5 py-11 sm:px-8">
                <dl className="flex flex-col rounded-[1.125rem] bg-[#F3F5F8] px-4.5 py-1.5 sm:px-6">
                    {summary.map(({ label, value, accent }) => (
                        <div
                            key={label}
                            className="grid grid-cols-[5rem_1fr] gap-3 border-t border-[#DFE4EA] py-3.75 first:border-t-0 sm:grid-cols-[6rem_1fr]"
                        >
                            <dt className={`text-body-sm ${MUTE}`}>{label}</dt>
                            <dd className={`text-body-bold ${INK}`}>
                                {value}
                                {accent && (
                                    <span className="text-caption ml-1.5 font-bold text-[#C2405A]">
                                        {accent}
                                    </span>
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* 3. 참여 방법 — 세 단계라 넓은 화면에서는 가로로 나란히 둔다 */}
            <section className="bg-[#F3F5F8] px-5 py-12 sm:px-8">
                <h2 className={`text-title-2 text-center font-extrabold tracking-tight ${INK}`}>
                    참여 방법
                </h2>
                <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                    {visual.steps.map((step, index) => (
                        <li
                            key={step.title}
                            className="grid grid-cols-[2.125rem_1fr] items-center gap-x-3.5 rounded-2xl bg-white px-4.5 py-4 sm:grid-cols-1 sm:place-items-center sm:px-3.5 sm:py-5.5"
                        >
                            <span
                                aria-hidden
                                className="text-body-bold row-span-2 grid size-8.5 place-items-center rounded-full bg-[#27313D] text-white sm:row-span-1 sm:mb-2.5"
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

                {visual.callout && (
                    <p
                        className={`text-body-sm mt-5 rounded-xl border-l-4 border-[#FF8FA3] bg-white px-4.5 py-3.5 ${INK}`}
                    >
                        {visual.callout}
                    </p>
                )}
            </section>

            {/* 4. 유의사항 — 이미지 안 글자와 달리 화면 읽기에 걸리고 확대해도 깨지지 않는다 */}
            <footer className="bg-[#ECEFF3] px-5 pt-9 pb-12 sm:px-8">
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
