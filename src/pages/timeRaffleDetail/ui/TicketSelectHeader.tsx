import { CircleHelp } from 'lucide-react';

import { TICKET_GRADE_LABEL, TICKET_GRADE_WEIGHT, TICKET_GRADES } from '@entities/ticket';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

interface TicketSelectHeaderProps {
    /** 등급을 추첨에 반영하는 래플인가 — 아니면 브론즈 1장으로만 응모한다 */
    gradeReflected: boolean;
    /** 이번에 더 쓸 수 있는 장수 — 상한이 없으면 null */
    remainingLimit: number | null;
}

/**
 * 응모권 고르는 자리의 제목과 (?) 안내.
 *
 * 사용자 화면이라 '가중치'라는 말은 쓰지 않고 '브론즈 몇 장만큼 추첨에 들어가요'로 풀어 쓴다.
 * 당첨 확률은 응모자 수에 따라 달라져 보여 주지 않는다 (getddo-spec 요구사항 §7)
 */
export function TicketSelectHeader({ gradeReflected, remainingLimit }: TicketSelectHeaderProps) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
                <h2 className="text-subhead text-fg-primary">응모권 선택</h2>
                <Popover>
                    <PopoverTrigger
                        aria-label="등급별 추첨 반영 안내"
                        className="text-fg-tertiary hover:text-fg-primary focus-visible:ring-border-focus inline-flex cursor-pointer rounded-full focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <CircleHelp className="size-4" />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 break-keep">
                        <p className="text-body-sm-bold text-fg-primary">등급별 추첨 반영</p>
                        <ul className="mt-3 flex flex-col gap-1.5">
                            {TICKET_GRADES.map((grade) => (
                                <li
                                    key={grade}
                                    className="text-caption text-fg-secondary flex justify-between gap-3"
                                >
                                    <span>{TICKET_GRADE_LABEL[grade]} 1장</span>
                                    <span className="text-fg-primary font-semibold">
                                        브론즈 {TICKET_GRADE_WEIGHT[grade]}장만큼
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-caption text-fg-tertiary mt-3">
                            {gradeReflected
                                ? '고른 장수만큼 더해 추첨에 들어가요. 쓴 응모권은 되돌릴 수 없어요.'
                                : '이 겟또타임은 등급을 반영하지 않아 브론즈 1장으로만 응모해요. 쓴 응모권은 되돌릴 수 없어요.'}
                        </p>
                    </PopoverContent>
                </Popover>
            </div>
            <p className="text-body-sm text-fg-tertiary">
                {gradeReflected
                    ? `높은 등급일수록 추첨에 크게 반영돼요.${
                          remainingLimit === null
                              ? ''
                              : ` 이번에 최대 ${remainingLimit}장까지 쓸 수 있어요.`
                      }`
                    : '이 겟또타임은 등급과 관계없이 브론즈 1장으로 응모해요.'}
            </p>
        </div>
    );
}
