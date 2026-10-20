import { Badge } from '@shared/ui/badge';
import { formatNumber } from '@shared/utils/format';

/**
 * 보상 응모권 칩 — 미션·게임 카드에서 '이걸 하면 응모권 몇 장'을 같은 모양으로 보인다 (공용 Badge).
 * 아이콘+'+1'은 장식처럼 보이고 무엇을 주는지 한 번 더 읽어야 해서, 출석 버튼('출석하고 응모권 1장 받기')과 같은 말로 적는다.
 * 받기 전에는 진한 노랑(highlight — 응모 칩·응모 버튼과 같은 노랑)으로 눈에 먼저 들어오게, 받은 뒤에는 흰 바탕+테두리(outline)로 낮춘다 — 완료·종료 카드는 회색 바탕이라 회색 칩이면 묻혔다
 */
export function TicketRewardChip({
    count,
    received = false,
    muted = false,
    size = 'md',
}: {
    count: number;
    received?: boolean;
    /** 기간이 끝나 더 받을 수 없는 카드처럼 흐리게 둘 때 — 받은 것과 같은 아웃라인 */
    muted?: boolean;
    size?: 'sm' | 'md';
}) {
    return (
        <Badge
            variant={received || muted ? 'outline' : 'highlight'}
            size={size}
            className="font-semibold tabular-nums"
        >
            응모권 {formatNumber(count)}장{received && ' 받았어요'}
        </Badge>
    );
}
