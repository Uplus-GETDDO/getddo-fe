import type { MyResultStatus } from '@entities/drawResult';
import type { TicketsByGrade } from '@entities/entry';
import type { Event } from '@entities/event';

import type { MyEntryRow } from '../hooks/useMyEntryRows';

const zeroGrades = (): TicketsByGrade => ({ BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 });

/**
 * 화면의 한 줄 — 같은 이벤트의 접수 응모를 묶은 그룹 또는 접수 거절 한 건.
 * 결과(E09)는 이벤트 단위라 그룹 하나가 결과 하나다 — 건수를 세도 응모 횟수만큼 부풀지 않는다
 */
export interface MyEntryGroup {
    /** 목록 key — 접수 그룹은 이벤트, 거절 행은 응모 ID */
    key: string;
    eventId: string;
    eventTitle: string;
    event: Event | undefined;
    isTimeRaffle: boolean;
    status: 'ACCEPTED' | 'REJECTED';
    /** 그룹 안 본인 결과 — 거절 행과 미조회는 undefined */
    result: MyResultStatus | undefined;
    /** 표시·정렬·기간 거르기 기준 시각 — 그룹 안 가장 최근 응모 */
    latestRequestedAt: string;
    entryCount: number;
    /** 그룹 안 실제 차감 합계 */
    usedTicketCount: number;
    usedTicketsByGrade: TicketsByGrade;
    rejectionCode: string | null;
    rejectionReason: string | null;
    to: string;
}

/**
 * 응모 기록(행)을 화면의 줄 단위로 묶는다.
 * - 접수(ACCEPTED)된 응모는 이벤트별로 합친다 — 이벤트 하나에서 중복 당첨은 없으므로(도메인 규칙) 결과도 그룹당 하나
 * - 거절(REJECTED)은 사유가 시도마다 다르므로 묶지 않고 한 건씩 남긴다
 * 들어온 순서(최신 응모순)를 지키며, 그룹은 가장 최근 응모 시각이 앞서는 순이다
 */
export function groupEntryRows(rows: readonly MyEntryRow[]): MyEntryGroup[] {
    const groups = new Map<string, MyEntryGroup>();
    const ordered: MyEntryGroup[] = [];
    for (const row of rows) {
        const { entry } = row;
        if (entry.status === 'REJECTED') {
            ordered.push({
                key: `entry:${entry.id}`,
                eventId: entry.eventId,
                eventTitle: entry.eventTitle,
                event: row.event,
                isTimeRaffle: row.isTimeRaffle,
                status: 'REJECTED',
                result: undefined,
                latestRequestedAt: entry.requestedAt,
                entryCount: 1,
                usedTicketCount: entry.deductedTicketCount,
                usedTicketsByGrade: { ...entry.deductedTicketsByGrade },
                rejectionCode: entry.rejectionCode,
                rejectionReason: entry.rejectionReason,
                to: row.to,
            });
            continue;
        }
        let group = groups.get(entry.eventId);
        if (!group) {
            group = {
                key: `event:${entry.eventId}`,
                eventId: entry.eventId,
                eventTitle: entry.eventTitle,
                event: row.event,
                isTimeRaffle: row.isTimeRaffle,
                status: 'ACCEPTED',
                result: row.result,
                latestRequestedAt: entry.requestedAt,
                entryCount: 0,
                usedTicketCount: 0,
                usedTicketsByGrade: zeroGrades(),
                rejectionCode: null,
                rejectionReason: null,
                to: row.to,
            };
            groups.set(entry.eventId, group);
            ordered.push(group);
        }
        group.entryCount += 1;
        group.usedTicketCount += entry.deductedTicketCount;
        for (const grade of Object.keys(group.usedTicketsByGrade) as (keyof TicketsByGrade)[]) {
            group.usedTicketsByGrade[grade] += entry.deductedTicketsByGrade[grade];
        }
        if (entry.requestedAt > group.latestRequestedAt)
            group.latestRequestedAt = entry.requestedAt;
    }
    return ordered;
}
