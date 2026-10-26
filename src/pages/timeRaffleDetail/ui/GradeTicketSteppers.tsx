import type { TicketsByGrade } from '@entities/entry';
import type { TicketGrade } from '@entities/ticket';

import {
    TICKET_GRADE_IMAGE,
    TICKET_GRADE_LABEL,
    TICKET_GRADE_WEIGHT,
    ticketGradeSchema,
} from '@entities/ticket';

import { QuantityStepper } from './QuantityStepper';

interface GradeTicketSteppersProps {
    /** 등급별로 고른 장수 */
    value: TicketsByGrade;
    onChange: (next: TicketsByGrade) => void;
    /** 등급별 사용 가능 보유 장수 — 잔액을 못 불러왔으면 null */
    availableByGrade: Record<TicketGrade, number> | null;
    /** 이 이벤트에 앞으로 더 낼 수 있는 합계 상한 — 사용자당 상한이 없는 이벤트는 null */
    remainingLimit: number | null;
}

/**
 * 가중치 적용 이벤트의 등급별 장수 선택 — spec은 사용자가 등급별 장수를 고르게 한다.
 * 각 등급은 보유 장수까지만, 합계는 남은 누적 상한까지만 오른다.
 */
export function GradeTicketSteppers({
    value,
    onChange,
    availableByGrade,
    remainingLimit,
}: GradeTicketSteppersProps) {
    const total = value.BRONZE + value.SILVER + value.GOLD + value.PLATINUM;
    // 고른 장수를 등급만큼 곱해 더한 값 — 화면에는 '브론즈 몇 장만큼'으로 풀어 적는다
    const reflected = ticketGradeSchema.options.reduce(
        (sum, grade) => sum + value[grade] * TICKET_GRADE_WEIGHT[grade],
        0,
    );

    // 다른 등급이 이미 쓴 만큼을 뺀 잔여 상한이 이 등급의 실질 상한이다
    const maxOf = (grade: TicketGrade) => {
        const owned = availableByGrade?.[grade] ?? 0;
        const allowance =
            remainingLimit === null ? owned : Math.max(0, remainingLimit - (total - value[grade]));
        return Math.min(owned, allowance);
    };

    return (
        <div className="flex flex-col gap-4" role="group" aria-label="등급별 응모권 장수">
            {ticketGradeSchema.options.map((grade) => (
                <div key={grade} className="flex items-center justify-between gap-4">
                    {/* 등급 이름 왼쪽에 등급 응모권 그림을 작게 둔다 — 이름은 글로 읽히니 그림은 장식이다 */}
                    <div className="flex items-center gap-3">
                        <img
                            src={TICKET_GRADE_IMAGE[grade]}
                            alt=""
                            className="h-auto w-10 shrink-0"
                        />
                        <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                                <span className="text-body-bold text-fg-primary">
                                    {TICKET_GRADE_LABEL[grade]}
                                </span>
                                {/* 고르는 자리에서 바로 등급 차이를 보이게 한다 — 자세한 풀이는 제목 옆 (?) */}
                                <span className="bg-surface-sunken text-fg-secondary text-caption rounded-full px-2 py-0.5">
                                    추첨 ×{TICKET_GRADE_WEIGHT[grade]}
                                </span>
                            </span>
                            <span className="text-caption text-fg-tertiary">
                                {availableByGrade
                                    ? `보유 ${availableByGrade[grade]}장`
                                    : '보유 수량 확인 필요'}
                            </span>
                        </div>
                    </div>
                    <QuantityStepper
                        value={value[grade]}
                        min={0}
                        max={maxOf(grade)}
                        onChange={(next) => onChange({ ...value, [grade]: next })}
                        label={`${TICKET_GRADE_LABEL[grade]} 응모 수량`}
                    />
                </div>
            ))}
            {/*
             * 합계는 버튼 바로 위 구분선 아래에 — 누르기 전에 몇 장을 쓰고 추첨에 얼마나 들어가는지 확인하게 한다.
             * 회색 상자로 채우면 바로 밑 비활성 버튼(한 단계 진한 회색)과 톤이 달라 보여 선으로만 나눈다.
             * 이번에 쓸 수 있는 상한은 위 제목 아래 설명이 맡는다
             */}
            <p
                className="border-border-default flex items-center justify-between gap-3 border-t pt-4"
                aria-live="polite"
            >
                <span className="text-body-bold text-fg-primary">합계 {total}장</span>
                {reflected > 0 && (
                    <span className="text-body-sm text-fg-secondary">
                        추첨에 브론즈 {reflected}장만큼 들어가요
                    </span>
                )}
            </p>
        </div>
    );
}
