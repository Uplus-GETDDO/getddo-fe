import type { TicketHistory, TicketOperationType } from '../model/history';

interface HistoryResponse {
    items: TicketHistory[];
    nextCursor?: string | null;
    totalElements: number;
}

export interface HistoryStream {
    operationType?: TicketOperationType;
    cursor?: string;
    buffer: TicketHistory[];
    requestedCursors: string[];
    ended: boolean;
}

function newestFirst(left: TicketHistory, right: TicketHistory) {
    const milliseconds = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (milliseconds) return milliseconds;
    // instant의 가변 소수 초와 밀리초보다 작은 정밀도도 보존한다. 스키마는 UTC Z 형식만 허용한다.
    const leftFraction = /\.(\d+)Z$/.exec(left.createdAt)?.[1] ?? '';
    const rightFraction = /\.(\d+)Z$/.exec(right.createdAt)?.[1] ?? '';
    const precision = Math.max(leftFraction.length, rightFraction.length);
    return (
        rightFraction.padEnd(precision, '0').localeCompare(leftFraction.padEnd(precision, '0')) ||
        right.id.localeCompare(left.id)
    );
}

/** 두 유형도 각각 한 페이지만 보충한 뒤 병합해 클릭당 요청 수에 상한을 둔다. */
export async function loadHistoryPage(
    previous: HistoryStream[],
    size: number,
    fetchPage: (type: TicketOperationType | undefined, cursor?: string) => Promise<HistoryResponse>,
) {
    let cursorError = false;
    const streams = await Promise.all(
        previous.map(async (stream) => {
            const next = {
                ...stream,
                buffer: [...stream.buffer],
                requestedCursors: [...stream.requestedCursors],
            };
            if (next.ended || next.buffer.length >= size) return next;
            const page = await fetchPage(next.operationType, next.cursor);
            if (next.cursor) next.requestedCursors.push(next.cursor);
            const repeated = !!page.nextCursor && next.requestedCursors.includes(page.nextCursor);
            const emptyContinuation = page.items.length === 0 && !!page.nextCursor;
            cursorError ||= repeated || emptyContinuation;
            next.buffer.push(...page.items);
            next.cursor = page.nextCursor ?? undefined;
            next.ended = !page.nextCursor || repeated || emptyContinuation;
            return next;
        }),
    );
    const items: TicketHistory[] = [];
    while (items.length < size) {
        // 서버가 size보다 적게 반환해도 다음 머리를 확인하기 전 다른 유형을 앞질러 노출하지 않는다.
        if (streams.some((stream) => !stream.ended && stream.buffer.length === 0)) break;
        const candidates = streams.filter((stream) => stream.buffer.length > 0);
        candidates.sort((a, b) => {
            const left = a.buffer[0];
            const right = b.buffer[0];
            if (!left || !right) return 0;
            return newestFirst(left, right);
        });
        const item = candidates[0]?.buffer.shift();
        if (!item) break;
        items.push(item);
    }
    return { items, streams, cursorError };
}
