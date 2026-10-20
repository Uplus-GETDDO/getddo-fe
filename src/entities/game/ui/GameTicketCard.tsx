import { Gamepad2, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@shared/ui/button';
import { TicketCard, TicketCardMedia } from '@shared/ui/ticket-card';

import type { Game } from '../model/types';

/** 게임 보상은 게임별 하루 1회 응모권 1장 (getddo-spec 게임 규칙) */
const DAILY_GAME_REWARD = 1;

/**
 * 게임 티켓 카드 — 썸네일, 설명, 오늘 받을 응모권, 플레이 버튼 (공용 TicketCard, 피그마 Group 633903).
 * 카드 어디를 눌러도 게임 화면으로 들어간다. 카드는 움직이지 않고(다른 카드와 통일), 마우스를 올리면 썸네일만 살짝 확대된다 (공용 TicketCardMedia).
 * 게임은 횟수 제한 없이 플레이할 수 있어서, 오늘 보상을 받은 뒤에도 버튼은 계속 누를 수 있다
 */
export function GameTicketCard({
    game,
    href,
    ready = true,
    fluid = false,
    className,
}: {
    game: Game;
    href: string;
    /** 플레이 화면이 준비됐는지 — false면 버튼을 '준비 중'으로 막는다 */
    ready?: boolean;
    /** 고정 폭(265) 대신 놓인 칸을 꽉 채운다 — 미션 페이지처럼 카드 수가 적어 줄이 비어 보일 때 */
    fluid?: boolean;
    className?: string;
}) {
    const rewarded = game.rewardedToday ?? false;

    return (
        <TicketCard
            className={className}
            cardClassName={`relative h-90 ${fluid ? 'w-full' : 'w-66.25'}`}
            stub={
                <>
                    <div className="mt-3.75 flex h-4.5 items-center justify-between gap-2">
                        <span className="text-caption text-fg-tertiary">응모권</span>
                        {rewarded ? (
                            <span className="text-caption text-fg-tertiary">오늘 받음</span>
                        ) : (
                            <span className="text-body-sm-bold text-fg-primary flex items-center gap-1">
                                <Ticket aria-hidden className="size-4.5" />+{DAILY_GAME_REWARD}
                            </span>
                        )}
                    </div>
                    {/* 공용 버튼 Large(48) — 보조 버튼(secondary) — 응모권 카드는 출석만 primary, 게임·미션은 한 단계 낮춘다.
                        준비 중인 게임은 누를 수 없게 막는다 */}
                    {ready ? (
                        // 카드 전체를 덮는 링크(아래) 위에 버튼을 올린다
                        <Button
                            asChild
                            variant="secondary"
                            size="lg"
                            className="relative z-2 mt-2 w-full"
                        >
                            <Link to={href}>{rewarded ? '한 번 더 하기' : '게임하러 가기'}</Link>
                        </Button>
                    ) : (
                        <Button disabled size="lg" className="mt-2 w-full">
                            준비 중이에요
                        </Button>
                    )}
                </>
            }
        >
            {/* 카드 어디를 눌러도 들어가도록 카드 전체를 덮는 링크. 버튼과 같은 곳이라 낭독기·키보드에서는 감추고 버튼 하나로만 읽힌다.
                버튼의 after로 덮으면 누르는 순간(active) 걸리는 brightness 필터가 덮개를 버튼 크기로 줄여 이동이 안 된다 */}
            {ready && (
                <Link
                    to={href}
                    aria-hidden
                    tabIndex={-1}
                    className="absolute inset-0 z-1 rounded-2xl"
                />
            )}
            <TicketCardMedia
                src={game.thumbnailUrl}
                fallback={<Gamepad2 aria-hidden className="text-fg-disabled size-8" />}
            />

            <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-col">
                    <span className="text-caption text-fg-tertiary">GAME</span>
                    <h3 className="text-body-bold text-fg-primary truncate">{game.title}</h3>
                </div>
                {game.description && (
                    <p className="text-body-sm text-fg-tertiary line-clamp-2">{game.description}</p>
                )}
            </div>
        </TicketCard>
    );
}
