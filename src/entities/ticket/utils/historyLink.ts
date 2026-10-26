import type { TicketHistory } from '../model/history';

import { TICKET_HISTORY_META } from '../model/historyMeta';

/**
 * 내역 상세에서 이어서 볼 화면.
 * 응모·반환은 연결된 래플(eventId)이 있으면 그 래플 상세로, 없으면 내 응모 내역으로 보낸다
 */
export function getTicketHistoryLink(
    item: Pick<TicketHistory, 'operationType' | 'eventId'>,
): { to: string; label: string } | undefined {
    const isEntry = item.operationType === 'USE' || item.operationType === 'REFUND';
    if (isEntry && item.eventId) {
        // 서버가 준 임의 문자열이라 /·?·# 등이 들어 있어도 경로가 바뀌지 않게 인코딩한다
        return {
            to: `/time-raffle/${encodeURIComponent(item.eventId)}`,
            label: '응모한 겟또타임 보기',
        };
    }
    return TICKET_HISTORY_META[item.operationType].link;
}
