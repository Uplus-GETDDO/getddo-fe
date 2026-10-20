import type { TicketHistory, TicketOperationType } from '../model/history';
import type { TicketGrade } from '../model/types';

import { TICKET_OPERATION_DELTA } from '../model/operation';

/** 한 번의 처리로 묶은 응모권 이력 — 화면의 한 줄 */
export interface TicketHistoryGroup {
    key: string;
    operationType: TicketOperationType;
    /** 서버가 적은 처리 사유 — 화면의 줄 제목 */
    reason: string;
    createdAt: string;
    /** 묶인 장수 */
    count: number;
    countByGrade: Record<TicketGrade, number>;
    /** 보유 장수 변동 — 정정은 장수를 바꾸지 않아 null */
    delta: number | null;
    /** 처리 직후 만료 시각 중 가장 이른 값 — 지급·반환·만료 줄에만 의미가 있다 */
    expiresAt: string;
    /** 줄 보조 문구 — 보상 출처나 처리 종류 */
    detail: string;
}

/** 지급은 출처로, 나머지는 처리 종류로 보조 문구를 붙인다 */
function detailOf(history: TicketHistory): string {
    switch (history.operationType) {
        case 'GRANT':
            if (history.attendanceDate) return '출석 보상';
            if (history.gameId) return '게임 보상';
            if (history.missionId) return '미션 보상';
            return '지급';
        case 'USE':
            return '응모에 사용';
        case 'REFUND':
            return '응모 취소로 반환';
        case 'EXPIRE':
            return '기한이 지나 만료';
        case 'CORRECTION':
            return '정정';
    }
}

/**
 * 장 단위 이력(T02)을 화면의 한 줄 단위로 묶는다.
 * 한 응모에 여러 장을 쓰면 장마다 USE 이력이 생기고 같은 eventEntryId를 가진다 — 응모 하나를 한 줄로 본다.
 * 응모 번호가 없는 처리는 같은 처리 종류·사유·시각(분 단위)을 한 번의 처리로 본다.
 * 최신 처리가 위로 오도록 정렬해 돌려준다
 */
export function groupTicketHistories(histories: readonly TicketHistory[]): TicketHistoryGroup[] {
    const groups = new Map<string, TicketHistoryGroup>();
    for (const history of histories) {
        const key = history.eventEntryId
            ? `${history.operationType}|${history.eventEntryId}`
            : `${history.operationType}|${history.reason}|${history.createdAt.slice(0, 16)}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                key,
                operationType: history.operationType,
                reason: history.reason,
                createdAt: history.createdAt,
                count: 0,
                countByGrade: { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 },
                delta: null,
                expiresAt: history.expiresAt,
                detail: detailOf(history),
            };
            groups.set(key, group);
        }
        group.count += 1;
        group.countByGrade[history.grade] += 1;
        if (history.createdAt > group.createdAt) group.createdAt = history.createdAt;
        if (history.expiresAt < group.expiresAt) group.expiresAt = history.expiresAt;
        const delta = TICKET_OPERATION_DELTA[history.operationType];
        group.delta = delta === null ? null : group.count * delta;
    }
    return [...groups.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
