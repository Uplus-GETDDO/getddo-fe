import { CircleHelp } from 'lucide-react';

import {
    TICKET_GRADE_LABEL,
    TICKET_GRADE_ODDS,
    TICKET_GRADE_WEIGHT,
    TICKET_GRADES,
} from '@entities/ticket';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

/**
 * 지갑 "사용 가능 응모권" 옆 (?) — 응모권 등급이 어떻게 정해지고 겟또타임에서 얼마나 반영되는지 알려 준다.
 * 사용자 화면이라 "가중치" 대신 "브론즈 몇 장만큼"으로 풀어 쓰고, 단어 중간에서 줄이 끊기지 않게 항목마다 줄을 나눈다.
 * 얻는 확률은 보상 규칙이라 보여 주고, 당첨 확률은 보여 주지 않는다 (getddo-spec 요구사항 §7)
 */
export function TicketGradeInfo() {
    const [, silver, gold] = TICKET_GRADES;
    return (
        <Popover>
            <PopoverTrigger
                aria-label="응모권 등급 안내"
                // 아이콘(16px)은 그대로 두고 패딩으로 누름 칸을 24px(WCAG 2.5.8)까지 넓힌다 — 음수 마진이 줄간격을 지킨다
                className="text-fg-tertiary hover:text-fg-primary focus-visible:ring-border-focus -m-1 inline-flex cursor-pointer rounded-full p-1 focus-visible:ring-2 focus-visible:outline-none"
            >
                <CircleHelp className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 break-keep">
                <p className="text-body-sm-bold text-fg-primary">응모권 등급은 이렇게 정해져요</p>
                <dl className="mt-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <dt className="text-caption text-fg-primary font-semibold">
                            게임·미션 보상
                        </dt>
                        <dd className="text-caption text-fg-secondary">
                            1장마다 등급이 무작위로 정해져요.
                            <span className="mt-1 flex flex-wrap gap-x-2">
                                {TICKET_GRADES.map((grade) => (
                                    <span key={grade} className="whitespace-nowrap">
                                        {TICKET_GRADE_LABEL[grade]} {TICKET_GRADE_ODDS[grade]}%
                                    </span>
                                ))}
                            </span>
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-caption text-fg-primary font-semibold">출석 보상</dt>
                        <dd className="text-caption text-fg-secondary">항상 브론즈예요.</dd>
                    </div>
                    {silver && gold && (
                        <div className="flex flex-col gap-1">
                            <dt className="text-caption text-fg-primary font-semibold">
                                겟또타임 추첨
                            </dt>
                            <dd className="text-caption text-fg-secondary">
                                등급이 높을수록 당첨 기회가 커져요. 등급을 반영하는 겟또타임에서는{' '}
                                {TICKET_GRADE_LABEL[silver]} 1장이 브론즈{' '}
                                {TICKET_GRADE_WEIGHT[silver]}장, {TICKET_GRADE_LABEL[gold]} 1장이
                                브론즈 {TICKET_GRADE_WEIGHT[gold]}장만큼 추첨에 들어가요.
                            </dd>
                        </div>
                    )}
                </dl>
            </PopoverContent>
        </Popover>
    );
}
