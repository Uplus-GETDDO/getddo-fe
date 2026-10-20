import { Check } from 'lucide-react';

/**
 * 내가 이미 응모한 이벤트라는 표시 — E01 목록의 `myEntered`를 그린다.
 *
 * 접수된 응모가 있다는 사실만 말한다. 추가 응모 자격도 당첨 여부도 아니다
 * (getddo-spec 05-api/event.md 「사용자 목록의 내 응모 여부」). 그래서 여러 장을 더 쓸 수 있는
 * 겟또타임에서는 '끝났다'로 읽히지 않게 문구를 달리 넘긴다.
 *
 * 상세(E02)에는 이 값이 없다 — 거기서는 E07 응모 현황으로 버튼 문구가 정해진다.
 */
export function EnteredChip({ label }: { label: string }) {
    return (
        <span className="bg-status-approved border-status-approved-text text-status-approved-text text-caption inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5">
            <Check className="size-3" aria-hidden />
            {label}
        </span>
    );
}
