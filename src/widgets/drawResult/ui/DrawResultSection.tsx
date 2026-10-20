import type { ReactNode } from 'react';

import { useState } from 'react';

import type { MyResult, PublicResults } from '@entities/drawResult';

import { MyDrawResultNotice } from './MyDrawResultNotice';
import { MyResultCard } from './MyResultCard';
import { PrizeWinnerCard } from './PrizeWinnerCard';
import { WinnerLookupCard } from './WinnerLookupCard';

/**
 * 끝났지만 보여 줄 명단이 없는 경우의 안내 — 사유를 구분해 적는다.
 *
 * 이 상태들은 공개 절차를 밟지 않아 isPublished가 거짓으로 온다 (2026-10-20 실서버 실측).
 * 그래서 공개 여부보다 먼저 본다 — 공개를 기다리라고 적으면 영영 오지 않을 발표를 기다리게 된다.
 */
const CLOSED_NOTICE: Record<string, string> = {
    // 문구는 GD-247에서 정한 것을 따른다 — 같은 상태를 화면마다 다르게 적지 않는다
    NO_ENTRANTS: '응모자가 없어 추첨이 종료됐어요.',
    // 신규 결과에는 나오지 않는 과거 값 — 사유는 노출하지 않고 당첨자 없음만 안내한다 (ADR-018)
    NO_ELIGIBLE_ENTRANTS: '이번 추첨에는 당첨자가 없어요.',
    CANCELED: '이벤트가 취소되어 당첨자를 발표하지 않아요.',
};

interface DrawResultSectionProps {
    results: PublicResults;
    /** 본인 결과(E09) — 당첨·낙첨 판정의 유일한 근거다 */
    myResult?: MyResult;
    /** 1등 칸의 빈 높이를 채울 경품 사진 */
    prizeImageUrl?: string | null;
    /**
     * 본인 결과를 알리는 자리에 대신 넣을 것.
     *
     * 겟또타임은 당첨·낙첨 연출 배너를 넘긴다. 넘기지 않으면 한 줄짜리 기본 안내를 쓴다 —
     * 일반 이벤트는 응모권 없이 한 번 참여하는 가벼운 응모라 같은 크기의 연출을 두지 않는다.
     */
    banner?: ReactNode;
}

/**
 * 마감 뒤의 결과 영역 전체 — 발표 대기·추첨 없음·당첨자 명단을 한 컴포넌트가 가른다.
 *
 * 겟또타임 상세와 이벤트 상세가 함께 쓴다. 발표 전 비노출·마스킹 명단·뒷자리 조회처럼
 * 틀리면 곤란한 규칙이 한 곳에만 있어야 해서 위젯으로 둔다 (ADR-022).
 *
 * 부르는 쪽은 결과가 있으면 그냥 넘기면 된다 — 어느 안내를 띄울지는 여기서 정한다.
 */
export function DrawResultSection({
    results,
    myResult,
    prizeImageUrl,
    banner,
}: DrawResultSectionProps) {
    /**
     * 조회한 뒷자리.
     *
     * 뒷자리는 여러 사람이 같을 수 있어 '내가 당첨됐다'의 근거가 되지 못한다.
     * 명단에서 같은 줄을 찾아 주는 용도로만 쓰고, 당첨 여부는 myResult가 판정한다.
     */
    const [mySuffix, setMySuffix] = useState<string | null>(null);

    // 추첨이 없었거나 취소된 건은 공개를 기다릴 게 없다 — 공개 여부보다 먼저 가른다
    const notice = CLOSED_NOTICE[results.displayStatus];
    if (notice) {
        return (
            <section className="bg-surface-page border-border-default rounded-2xl border p-8">
                <p role="status" className="text-body text-fg-secondary text-center">
                    {notice}
                </p>
            </section>
        );
    }

    // 발표 전에는 아무것도 열지 않는다. 예정 시각이 지났다는 사실만으로는 공개하지 않는다
    if (!results.isPublished) return <MyResultCard entered={myResult?.result === 'PENDING'} />;

    // 서버는 하위 등수부터 연출하도록 내림차순으로 주지만, 화면은 1등을 가장 크게 둔다
    const byRankAsc = [...results.prizes].sort((a, b) => a.rank - b.rank);
    const [topPrize, ...restPrizes] = byRankAsc;
    if (!topPrize) return null;

    return (
        <section className="flex flex-col gap-4">
            {myResult?.result === 'WON' || myResult?.result === 'LOST' ? (
                (banner ?? <MyDrawResultNotice myResult={myResult} />)
            ) : myResult?.result === 'CANCELED' ? (
                /*
                 * 공개 명단은 정상인데 본인 결과만 취소로 내려오는 경우다.
                 * 그대로 두면 조회 입력창이 떠서 결과를 더 찾아보라는 말이 된다.
                 *
                 * 이벤트 취소인지 본인 응모 취소인지는 계약에 정의가 없어
                 * (05-api/drawing.md는 '본인 표시의 중간 상태는 후속 계약'으로 남겨 두었다)
                 * 사유를 단정하지 않고 결과가 없다는 사실만 적는다.
                 */
                <section className="bg-surface-page border-border-default rounded-2xl border p-8">
                    <p className="text-body text-fg-secondary text-center">
                        취소되어 확인할 수 있는 결과가 없어요.
                    </p>
                </section>
            ) : (
                // 응모하지 않은 사람도 명단을 확인할 수 있어야 한다 — 본인 결과가 없을 때만 연다
                <WinnerLookupCard prizes={byRankAsc} onLookup={setMySuffix} />
            )}

            {byRankAsc.length === 2 ? (
                // 등수가 둘뿐이면 1등을 한 줄 다 쓰게 두면 2등 옆이 빈다 — 나란히 둔다
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {byRankAsc.map((prize) => (
                        <PrizeWinnerCard
                            key={prize.prizeId}
                            prize={prize}
                            mySuffix={mySuffix}
                            highlighted={prize === topPrize}
                            // 1등 칸은 명단이 짧으면 아래가 비어 보인다 — 남는 높이를 상품 사진으로 채운다
                            imageUrl={prize === topPrize ? prizeImageUrl : undefined}
                            fillWithImage={prize === topPrize}
                        />
                    ))}
                </div>
            ) : (
                <>
                    {/* 1등이 한 줄을 다 쓸 때는 등수·경품과 명단을 좌우로 나눠 빈 공간을 줄인다 */}
                    <PrizeWinnerCard
                        prize={topPrize}
                        mySuffix={mySuffix}
                        highlighted
                        wide
                        imageUrl={prizeImageUrl}
                    />

                    {restPrizes.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {restPrizes.map((prize) => (
                                <PrizeWinnerCard
                                    key={prize.prizeId}
                                    prize={prize}
                                    mySuffix={mySuffix}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
