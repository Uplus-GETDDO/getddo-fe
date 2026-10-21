import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { MyEntryGroup } from '@widgets/myEntryRows';

import { MyResultBadge } from '@entities/drawResult';
import { EventThumbnail } from '@entities/event';
import { TICKET_GRADE_DOT, TICKET_GRADE_LABEL, TICKET_GRADES } from '@entities/ticket';
import { getErrorCodeMessage } from '@shared/api/errorMessage';
import { Badge } from '@shared/ui/badge';
import { formatKstDot } from '@shared/utils/date';

/** 표 칸 너비 — 머리줄(EntryTableHead)과 줄이 같은 값을 쓴다 */
export const ENTRY_GRID = 'md:grid-cols-[minmax(0,1fr)_10.5rem_5.5rem_1.25rem]';

/**
 * 내 응모 내역 표의 한 줄 — 같은 이벤트의 접수 응모를 묶은 그룹(또는 거절 한 건).
 * 줄 전체가 이벤트·겟또타임 상세로 가는 링크다.
 * 넓은 화면에서는 응모·사용 응모권·결과 칸으로 펼치고, 좁은 화면에서는 위아래로 쌓는다.
 *
 * 발표 칸은 두지 않는다. 전에는 발표 예정 시각을 적었지만 그 값이 사용자 응답에서 빠졌고
 * (GD-203), 실제 공개 시각은 결과 조회(E08)에만 있어 응모 내역은 들고 있지 않다. 남는 것은
 * 상태뿐이어서 결과 칩과 같은 말이 된다 — 상태는 결과 칩 하나로만 알린다 (ADR-022)
 */
export function EntryTableRow({ group }: { group: MyEntryGroup }) {
    const rejected = group.status === 'REJECTED';
    const usedGrades = TICKET_GRADES.filter((grade) => group.usedTicketsByGrade[grade] > 0);
    const rejectionReason = rejected
        ? (getErrorCodeMessage(group.rejectionCode) ?? group.rejectionReason)
        : null;

    return (
        <li>
            <Link
                to={group.to}
                className={`hover:bg-surface-canvas focus-visible:ring-border-focus grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${ENTRY_GRID}`}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <EventThumbnail src={group.event?.bannerImageUrl} className="size-13" />
                    <div className="flex min-w-0 flex-col">
                        <span className="text-body-bold text-fg-primary truncate">
                            {group.eventTitle}
                        </span>
                        <span className="text-body-sm text-fg-tertiary">
                            {group.isTimeRaffle ? '겟또타임' : '이벤트'} ·{' '}
                            {formatKstDot(group.latestRequestedAt, true)} 응모
                            {group.entryCount > 1 && ` · 총 ${group.entryCount}회`}
                        </span>
                        {rejectionReason && (
                            <span className="text-body-sm text-destructive">{rejectionReason}</span>
                        )}
                    </div>
                </div>

                {/* 좁은 화면에서는 결과 칩이 제목 오른쪽에 붙는다 */}
                <div className="flex items-center justify-end gap-3 md:hidden">
                    {rejected ? (
                        <Badge>접수 안 됨</Badge>
                    ) : (
                        group.result && <MyResultBadge result={group.result} />
                    )}
                </div>

                <div className="col-span-2 flex flex-wrap items-center gap-1 pl-16 md:col-span-1 md:pl-0">
                    {rejected ? (
                        <span className="text-caption text-fg-tertiary">—</span>
                    ) : usedGrades.length === 0 ? (
                        <span className="text-caption text-fg-tertiary">응모권 없이 참여</span>
                    ) : (
                        // 등급 알약 안에 장수를 넣으면 "실버 2 골드 1"이 한 덩어리로 읽혀 헷갈린다 —
                        // 합계를 크게 먼저 두고, 등급별 장수는 아래에 색 점과 함께 작게 푼다
                        <div className="flex flex-col gap-0.5">
                            <span className="text-body-sm-bold text-fg-primary tabular-nums">
                                {usedGrades.reduce(
                                    (sum, grade) => sum + group.usedTicketsByGrade[grade],
                                    0,
                                )}
                                장
                            </span>
                            <span className="text-caption text-fg-tertiary flex flex-wrap items-center gap-x-2">
                                {usedGrades.map((grade) => (
                                    <span key={grade} className="inline-flex items-center gap-1">
                                        <span
                                            aria-hidden
                                            className={`${TICKET_GRADE_DOT[grade]} size-1.5 rounded-full`}
                                        />
                                        {TICKET_GRADE_LABEL[grade]}{' '}
                                        {group.usedTicketsByGrade[grade]}
                                    </span>
                                ))}
                            </span>
                        </div>
                    )}
                </div>

                <div className="hidden justify-end md:flex">
                    {rejected ? (
                        <Badge>접수 안 됨</Badge>
                    ) : (
                        group.result && <MyResultBadge result={group.result} />
                    )}
                </div>
                <ChevronRight aria-hidden className="text-fg-secondary hidden size-5 md:block" />
            </Link>
        </li>
    );
}
