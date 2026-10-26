import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { CapsuleStatusArt } from '@entities/ticket';
import shopCounter from '@shared/assets/shop/shop-counter.jpg';
import shopWall from '@shared/assets/shop/shop-wall.jpg';
import { cn } from '@shared/utils/cn';

/**
 * 페이지 통째로 보일 내용이 없을 때의 화면 — 없는 주소(404)와 처음부터 못 받은 상세.
 *
 * 위는 겟또타임 머리와 같은 가게 무대(벽 + 나무 카운터)에서 뽑기 기계가 저절로 돌아 꽝을 뽑고,
 * 아래는 제목 한 줄·이유 한 줄·버튼 순서로 짧게 둔다. 빈 화면에 글만 있으면 고장 난 것처럼 보여
 * 무대로 첫 화면을 채우고, 갈 곳(바로가기)을 함께 둬 막다른 길이 되지 않게 한다.
 * 이동 버튼은 꼭 하나 둔다 — 문구 한 줄만 남기면 되돌아갈 데가 없다
 */
export function PageStatus({
    variant,
    art,
    eyebrow,
    title,
    description,
    actions,
    links,
    className,
}: {
    /** notFound: 404 숫자 사이에서 뽑기, error: 숫자 없이 뽑기만 */
    variant: 'notFound' | 'error';
    /** 가게 무대 대신 둘 그림 — 404의 타꼬런처럼 화면이 직접 정할 때 */
    art?: ReactNode;
    /** 제목 위 작은 말머리 — 예: '404 · 꽝' */
    eyebrow?: string;
    title: string;
    /** 이유 — 여러 문장이면 배열로 넘겨 문장마다 줄을 바꾼다 */
    description: string | string[];
    /** 다시 시도·목록으로 같은 버튼 */
    actions: ReactNode;
    /** 바로가기 — 다른 곳으로 이어지는 짧은 링크 */
    links?: { to: string; label: string }[];
    className?: string;
}) {
    return (
        <section className={cn('flex flex-col items-center px-6 pt-8 pb-28', className)}>
            {art ?? (
                /* 무대 — 다크 모드에서도 밝은 그림이라 밝은 토큰으로 고정한다 */
                <div
                    className="force-light relative w-full max-w-180 overflow-hidden rounded-3xl bg-cover bg-center [--counter:1.75rem]"
                    style={{ backgroundImage: `url(${shopWall})` }}
                >
                    {/* 벽 그림이 어두운 웜톤이라 흰 막을 덮어 숫자가 또렷하게 읽히게 한다 */}
                    <div aria-hidden className="bg-surface-page/60 absolute inset-0" />
                    <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-(--counter) bg-size-[auto_100%] bg-left bg-repeat-x"
                        style={{ backgroundImage: `url(${shopCounter})` }}
                    />
                    {/* 기계 바닥이 카운터 위에 앉도록 아래 여백을 카운터 높이에 맞춘다 */}
                    <div className="relative flex justify-center pt-10 pb-[calc(var(--counter)-0.25rem)] sm:pt-12">
                        <CapsuleStatusArt variant={variant} />
                    </div>
                </div>
            )}

            {/* 글은 그림보다 한 단계 낮춘다 — 제목 한 줄, 이유 한 줄, 버튼 하나 */}
            <div className="mt-8 flex max-w-120 flex-col items-center gap-2 text-center">
                {eyebrow && <p className="text-body-sm-bold text-fg-brand">{eyebrow}</p>}
                <h1 className="text-title-3 text-fg-primary break-keep">{title}</h1>
                <p role="status" className="text-body-sm text-fg-tertiary break-keep">
                    {(Array.isArray(description) ? description : [description]).map(
                        (sentence, index) => (
                            <span key={sentence}>
                                {index > 0 && <br />}
                                {sentence}
                            </span>
                        ),
                    )}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
            </div>

            {links && links.length > 0 && (
                <nav
                    aria-label="바로가기"
                    className="border-border-default mt-12 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 border-t pt-6"
                >
                    <span className="text-caption text-fg-tertiary mr-2">이런 곳은 어때요</span>
                    {links.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className="text-body-sm text-fg-secondary hover:text-fg-primary focus-visible:ring-border-focus rounded-full px-3 py-1.5 transition-colors hover:font-semibold focus-visible:ring-2 focus-visible:outline-none"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            )}
        </section>
    );
}
