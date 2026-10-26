import { PIXEL_FONT } from '../model/pixelFont';

/**
 * 보상 기준까지 남은 점수 — 점수판 아래에 붙는 작은 도트 판.
 * 목표가 보이면 한 판 더 하게 된다는 의견으로 넣었다. 기준을 넘으면 노란 막대로 '보상 기준 달성!'을 띄운다.
 * 오늘 이미 보상을 받았는지는 모른다 — 서버 판정이라 '보상 기준'까지만 말한다.
 * 점수판 바로 아래 오른쪽에 둔다(점수판 높이 28·40 + 위 여백 12 + 간격 4). 게임 장면보다 먼저 그려 결과 말풍선이 위로 지나가게 한다
 */
export function GameRewardProgress({ score, goal }: { score: number; goal: number }) {
    const done = score >= goal;
    return (
        <div
            className={`border-fg-primary bg-surface-page/90 pointer-events-none absolute top-11 right-3 flex w-36 flex-col gap-1 rounded-md border-2 px-2 py-1 sm:top-14 @lg:w-52 ${PIXEL_FONT}`}
        >
            <span className="text-fg-primary text-[0.625rem] leading-none whitespace-nowrap @lg:text-xs">
                {done ? '보상 기준 달성!' : `보상까지 ${goal - score}점`}
            </span>
            <span className="bg-grade-bronze/20 block h-1.5 overflow-hidden rounded-full">
                <span
                    className={`block h-full rounded-full transition-[width] duration-300 ${done ? 'bg-ticket-primary' : 'bg-grade-bronze'}`}
                    style={{ width: `${Math.min(100, (score / goal) * 100)}%` }}
                />
            </span>
        </div>
    );
}
