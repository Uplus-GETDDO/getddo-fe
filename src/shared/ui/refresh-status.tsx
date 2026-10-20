import { cn } from 'cn';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

/** "n초 전"을 다시 계산하는 간격 */
const TICK_MS = 5_000;

/**
 * 마지막으로 받은 뒤 지난 시간 — dataUpdatedAt은 실제 시계(Date.now) 기준 타임스탬프라 가상 시계가 아닌
 * 실제 경과 시간으로 비교한다 (화면 갱신 안내용이며 도메인 시각 판정에 쓰지 않는다)
 */
function useElapsedLabel(updatedAt: number | undefined) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(timer);
    }, []);
    if (!updatedAt) return null;
    const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
    if (seconds < 10) return '방금 갱신';
    if (seconds < 60) return `${Math.floor(seconds / 10) * 10}초 전 갱신`;
    return `${Math.floor(seconds / 60)}분 전 갱신`;
}

/**
 * 새로고침 상태 — 폴링·재조회 중이면 아이콘이 돌고, 평소엔 마지막 갱신 시각을, 실패하면 이전 화면을 둔 채
 * "갱신 실패 · 다시 시도"를 보인다. 누르면 바로 다시 받는다. 문구가 생겼다 사라지며 줄을 밀지 않도록 한 자리에서 바뀐다
 */
function RefreshStatus({
    fetching,
    updatedAt,
    error = false,
    onRefresh,
    interval,
    className,
}: {
    fetching: boolean;
    /** 마지막으로 받은 시각(ms) — TanStack Query의 dataUpdatedAt */
    updatedAt?: number;
    /** 다시 받기에 실패했지만 이전 데이터가 남아 있는 상태 */
    error?: boolean;
    onRefresh: () => void;
    /** 자동 갱신 주기 안내 — 예: "30초마다" */
    interval?: string;
    className?: string;
}) {
    const elapsed = useElapsedLabel(updatedAt);
    const showError = error && !fetching;
    const label = fetching ? '새로 받는 중' : showError ? '갱신 실패 · 다시 시도' : elapsed;

    return (
        <button
            type="button"
            onClick={onRefresh}
            disabled={fetching}
            aria-label={showError ? '갱신에 실패했어요. 다시 받기' : '지금 다시 받기'}
            // 바탕이 없으니 좌우 여백도 거의 없앤다 — 남겨 두면 옆 글과의 간격만 어색하게 벌어졌다.
            // 호버는 바탕을 칠하지 않고 글자만 진하고 굵게 — 작은 글 버튼이 회색 알약으로 튀어 보이지 않게 (다른 작은 글 버튼도 같은 규칙)
            // 글자 크기(text-caption)는 cn 밖에서 잇는다 — 글자색과 한 cn에 넣으면 크기가 지워진다
            className={`text-caption ${cn(
                'focus-visible:ring-border-focus inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-0.5 whitespace-nowrap tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none enabled:hover:font-semibold disabled:cursor-default',
                showError
                    ? 'text-semantic-error-strong'
                    : 'text-fg-tertiary enabled:hover:text-fg-primary',
                className,
            )}`}
        >
            {showError ? (
                <TriangleAlert aria-hidden className="size-3" />
            ) : (
                <RefreshCw
                    aria-hidden
                    className={cn('size-3', fetching && 'animate-spin motion-reduce:animate-none')}
                />
            )}
            {/* 상태 변화는 화면 낭독기에 조용히 알린다 */}
            <span aria-live="polite">
                {label}
                {interval && !fetching && !showError && elapsed ? ` · ${interval}` : ''}
            </span>
        </button>
    );
}

export { RefreshStatus };
