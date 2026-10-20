import { TICKET_GRADE_IMAGE } from '@entities/ticket';

/**
 * 등급을 반영하지 않는 래플의 응모권 칸 — 브론즈 1장 고정이라 스테퍼 대신 쓸 장수와 보유 장수만 보인다.
 * 바로 밑 버튼과 회색끼리 겹치지 않게 테두리만 둔다
 */
export function BronzeOnlyTicket({ owned }: { owned: number | null }) {
    return (
        <div className="border-border-default flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <span className="flex items-center gap-3">
                <img src={TICKET_GRADE_IMAGE.BRONZE} alt="" className="h-auto w-10 shrink-0" />
                <span className="text-body-bold text-fg-primary">브론즈 1장 사용</span>
            </span>
            <span className="text-body-sm text-fg-tertiary">
                {owned === null ? '보유 수량 확인 필요' : `보유 ${owned}장`}
            </span>
        </div>
    );
}
