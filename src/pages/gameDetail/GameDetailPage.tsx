import { MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { GameGuideDialog, getGameContent, useGameDetail, useGameStatistics } from '@entities/game';
import { useSessionStore } from '@entities/user';
import {
    GamePlayer,
    hasGamePlayer,
    preloadGamePlayer,
    useGamePlaySession,
} from '@features/playGame';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { SkeletonDetail } from '@shared/ui/skeleton';
import { GameRail } from '@widgets/gameRail';
import { PageStatus } from '@widgets/pageStatus';

import { GameHero } from './ui/GameHero';
import { GameStats } from './ui/GameStats';

const CONTAINER = 'mx-auto w-full max-w-312 px-6';

/**
 * 무대 폭 — 최대 960px(피그마 840보다 한 단계 크게)이고, 화면 높이가 모자라면 840:546 비율대로 줄어든다.
 * 16.5rem(264px)은 무대 높이 중 대표 영역을 뺀 나머지: 헤더 65 + 위아래 여백 64 + 제목 28 + 간격 35 + 기록 카드 72.
 * 너무 작아지지 않게 480px 아래로는 줄이지 않는다 (그보다 짧은 화면은 스크롤)
 */
const STAGE_WIDTH = 'w-[min(100%,60rem,max(30rem,calc((100svh-16.5rem)*840/546)))]';

/** 게임 상세 — 대표 영역(게임 시작·게임 방법), 내 기록, 다른 게임 */
export function GameDetailPage() {
    const { gameId = '' } = useParams<{ gameId: string }>();
    const user = useSessionStore((state) => state.user);
    return (
        <GameDetailContent
            key={`${user?.id}:${gameId}`}
            gameId={gameId}
            userId={user?.id ?? ''}
            isUser={user?.role === 'USER'}
        />
    );
}
function GameDetailContent({
    gameId,
    userId,
    isUser,
}: {
    gameId: string;
    userId: string;
    isUser: boolean;
}) {
    const { data: game, isPending, isError, error, isFetching, refetch } = useGameDetail(gameId);
    const statistics = useGameStatistics(gameId, isUser);
    const play = useGamePlaySession(gameId, userId, isUser, game?.code);
    const [guideOpen, setGuideOpen] = useState(false);
    const playableCode = game && hasGamePlayer(game.code) ? game.code : null;
    useEffect(() => {
        if (playableCode) preloadGamePlayer(playableCode);
    }, [playableCode]);
    const startGame = () => {
        setGuideOpen(false);
        if (playableCode && !play.busy) void play.begin();
    };

    if (isPending) {
        return (
            <main className={`${CONTAINER} py-20`}>
                <SkeletonDetail media="video" />
            </main>
        );
    }
    if (isError || !game) {
        return (
            <main className={CONTAINER}>
                <PageStatus
                    variant={isError ? 'error' : 'notFound'}
                    title={isError ? '게임을 불러오지 못했어요' : '게임을 찾을 수 없어요'}
                    description={
                        isError
                            ? getErrorMessage(error, '잠시 후 다시 시도해 주세요.')
                            : '주소가 바뀌었거나 지금은 열리지 않은 게임이에요.'
                    }
                    actions={
                        <>
                            {isError && (
                                <Button
                                    type="button"
                                    disabled={isFetching}
                                    onClick={() => void refetch()}
                                >
                                    {isFetching ? '불러오는 중…' : '다시 시도'}
                                </Button>
                            )}
                            <Button variant={isError ? 'secondary' : 'primary'} asChild>
                                <Link to="/missions">미션 페이지로</Link>
                            </Button>
                        </>
                    }
                />
            </main>
        );
    }

    const content = getGameContent(game);

    return (
        // 운영체제의 동작 줄이기 설정을 켠 사용자에게는 진입 애니메이션을 끈다
        <MotionConfig reducedMotion="user">
            <main className="flex flex-col pb-28">
                {/*
                  무대 — 헤더 바로 아래 어두운 띠에 제목·대표 영역·기록을 담는다.
                  띠는 내용 높이만큼만 차지하고, 화면이 짧으면 대표 영역이 줄어 노트북·윈도우(1080p)에서도 한 화면에 들어온다
                */}
                <div className="bg-action-neutral-pressed px-6 py-8">
                    <div className={`mx-auto flex flex-col gap-2.5 ${STAGE_WIDTH}`}>
                        {/* 게임 이름과 한 줄 소개 — 미션 페이지 '출석체크' 섹션 제목처럼 한 줄로 */}
                        <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h1 className="text-subhead text-fg-on-brand">{game.name}</h1>
                            {content.tagline && (
                                <p className="text-body-sm text-border-strong">{content.tagline}</p>
                            )}
                            {/* 관리자 체험 안내는 작은 알약으로 — 넓은 화면은 제목 줄 오른쪽 끝, 좁아서 줄이 넘어가면 소개 아래 왼쪽(오른쪽 끝에 혼자 뜨면 어색했다) */}
                            {!isUser && (
                                <Badge className="bg-surface-inverse-muted text-fg-inverse lg:ml-auto">
                                    관리자 체험 · 점수·보상 저장 안 함
                                </Badge>
                            )}
                        </div>
                        {/* 관리자 체험은 기록·보상이 없어 서버 확정 안내가 맞지 않는다 — 제목 줄 관리자 칩이 대신 알린다 */}
                        {play.visible && isUser && (
                            <p className="text-body-sm text-fg-on-brand">
                                플레이 화면의 점수는 잠정 점수이며, 기록과 보상은 서버 확정 결과를
                                따릅니다.
                            </p>
                        )}
                        {/*
                          휴대폰(640px 미만)은 판을 화면 끝까지 붙여 조금이라도 크게 보여 준다.
                          화면 끝에 닿으니 둥근 모서리·좌우 테두리는 없앤다 — 남겨 두면 잘린 것처럼 보인다
                        */}
                        <div className="max-sm:-mx-6 max-sm:*:rounded-none max-sm:*:border-x-0">
                            {play.visible && play.session ? (
                                <GamePlayer
                                    key={play.session.playId}
                                    code={game.code}
                                    session={play.session}
                                    bestScore={statistics.data?.bestScore}
                                    onExit={play.exit}
                                    onRestart={startGame}
                                    onRecordingError={play.recordingError}
                                    onGameOver={play.complete}
                                />
                            ) : (
                                <GameHero
                                    title={game.name}
                                    tagline={content.tagline}
                                    image={content.heroImage}
                                    imagePosition={content.heroImagePosition}
                                    onStart={startGame}
                                    onGuide={() => setGuideOpen(true)}
                                />
                            )}
                        </div>
                        <div
                            role="status"
                            aria-live="polite"
                            className="text-body-sm text-fg-on-brand"
                        >
                            {play.busy && <p>서버 응답을 확인하고 있습니다.</p>}
                            {play.error && <p>{play.error}</p>}
                            {play.result?.status === 'PROCESSING' && (
                                <p>
                                    결과를 처리하고 있습니다. 같은 기록으로 자동 확인하며 잠시만
                                    기다려 주세요.
                                </p>
                            )}
                            {play.result?.status === 'INVALID' && (
                                <p>
                                    입력 기록이 게임 규칙과 일치하지 않아 점수·보상에 반영하지
                                    않았습니다.
                                </p>
                            )}
                            {play.result?.status === 'VALID' && (
                                <p>
                                    서버 확정 점수: {play.result.score}점.{' '}
                                    {play.result.reward
                                        ? `${play.result.reward.grade} 응모권 1장을 받았습니다.`
                                        : '이번 플레이의 보상은 없습니다. 최소 점수 또는 당일 보상 여부를 확인해 주세요.'}
                                </p>
                            )}
                            {play.pending && (
                                <Button
                                    variant="secondary"
                                    disabled={play.busy || !play.retryReady}
                                    onClick={() => void play.retry()}
                                >
                                    {play.retryReady
                                        ? '원본 기록으로 결과 다시 확인'
                                        : `${play.retryAfter}초 후 다시 확인 가능`}
                                </Button>
                            )}
                            {play.pending && (
                                <p>
                                    결과 확인 전에는 새 판을 시작할 수 없습니다. 원본 기록은 이 탭에
                                    보존되어 새로고침해도 유지되며 탭을 닫으면 지워집니다.
                                </p>
                            )}
                            {!playableCode && <p>아직 지원하지 않는 게임입니다.</p>}
                        </div>
                        {isUser && (
                            <>
                                {statistics.isError && (
                                    <p role="alert" className="text-fg-on-brand">
                                        기록 조회에 실패했습니다.{' '}
                                        <button onClick={() => void statistics.refetch()}>
                                            다시 조회
                                        </button>
                                    </p>
                                )}
                                <GameStats
                                    bestScore={statistics.data?.bestScore}
                                    totalScore={statistics.data?.totalScore}
                                    validPlayCount={statistics.data?.validPlayCount}
                                    rewardedToday={statistics.data?.rewardClaimedToday}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* 다른 게임 — 홈 화면처럼 카드 목록을 콘텐츠 폭(최대 1200px) 안에서 자르고 그 안에서 넘긴다 */}
                <div className="mt-10 py-10">
                    <div className={CONTAINER}>
                        <GameRail title="다른 게임" excludeGameId={game.id} />
                    </div>
                </div>

                <GameGuideDialog
                    open={guideOpen}
                    onOpenChange={setGuideOpen}
                    guide={content.guide}
                    onStart={startGame}
                />
            </main>
        </MotionConfig>
    );
}
