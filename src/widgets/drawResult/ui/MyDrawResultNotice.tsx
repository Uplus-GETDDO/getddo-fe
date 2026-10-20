import type { MyResult } from '@entities/drawResult';

import { StatusDot } from '@shared/ui/status-dot';

/**
 * 본인 결과 한 줄 — 겟또타임의 연출 배너를 쓰지 않는 자리의 기본값.
 *
 * 당첨 여부는 E09만 판정한다. 공개 명단에서 이름이 비슷해 보인다고 당첨으로 읽지 않는다.
 * 경품 이름은 서버가 준 당첨 경품을 그대로 적는다 — 등수별 명단과 어긋나지 않게 한다.
 */
export function MyDrawResultNotice({ myResult }: { myResult: MyResult }) {
    const won = myResult.result === 'WON';

    return (
        <section className="bg-surface-page border-border-default flex flex-col items-center gap-4 rounded-2xl border p-8 text-center">
            <StatusDot tone={won ? 'info' : 'muted'}>{won ? '당첨' : '미당첨'}</StatusDot>
            <div className="flex flex-col gap-1">
                <p className="text-title-3 text-fg-primary">
                    {won ? '축하해요, 당첨되셨어요!' : '아쉽게도 당첨되지 않았어요'}
                </p>
                <p className="text-body text-fg-secondary">
                    {won
                        ? `${myResult.prize?.name ?? '경품'}은 발표 후 순차 지급돼요.`
                        : '다음 이벤트에서 다시 만나요.'}
                </p>
            </div>
        </section>
    );
}
