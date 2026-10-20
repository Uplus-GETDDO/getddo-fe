import { useQueries } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';

import type { AdminTicketGrantsParams } from './admin';

import { ticketGrantSchema } from '../model/admin';
import { ADMIN_TICKET_GRANTS_API_PATH, ADMIN_TICKETS_KEY } from './admin';

type GrantUserParams = Omit<AdminTicketGrantsParams, 'page' | 'size'>;

/** 받은 사람 수 — 지급 이력에서 사용자를 중복 없이 센 값 */
export interface GrantUserCount {
    users: number;
    /** 끝까지 받지 못하고 멈춤 — 실제 인원은 users보다 많을 수 있다 */
    capped: boolean;
}

const PAGE_SIZE = 100;
/** 한 조건에서 받을 최대 쪽수 — 2,000건을 넘으면 멈추고 capped로 알린다 */
const MAX_PAGES = 20;

async function fetchGrantUsers(params: GrantUserParams): Promise<GrantUserCount> {
    const users = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { data } = await apiClient.get<unknown>(ADMIN_TICKET_GRANTS_API_PATH, {
            params: { ...params, page, size: PAGE_SIZE },
        });
        const result = envelopeSchema(pageSchema(ticketGrantSchema)).parse(data).data;
        result.items.forEach((grant) => users.add(grant.userId));
        if (page * PAGE_SIZE >= result.totalElements) return { users: users.size, capped: false };
    }
    return { users: users.size, capped: true };
}

/** 조건별 받은 사람 수 묶음 — 순서는 넘긴 조건 순서와 같다 */
export interface AdminTicketGrantUserCounts {
    counts: (GrantUserCount | undefined)[];
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
}

// 대시보드 참여율의 분자 — 사람 수를 주는 집계 API가 없어 그날 지급 이력을 모두 받아 사용자를 센다.
// 출석·미션·게임은 보상으로 응모권을 주므로 '지급받은 사람 = 참여한 사람'으로 본다. 집계 API가 생기면 이 훅만 바꾼다
export function useAdminTicketGrantUserCounts(
    paramsList: GrantUserParams[],
): AdminTicketGrantUserCounts {
    return useQueries({
        queries: paramsList.map((params) => ({
            queryKey: [...ADMIN_TICKETS_KEY, 'grants', 'users', params],
            staleTime: 60_000,
            queryFn: () => fetchGrantUsers(params),
        })),
        combine: (results) => ({
            counts: results.map((result) => result.data),
            isPending: results.some((result) => result.isPending),
            isError: results.some((result) => result.isError),
            refetch: () => results.forEach((result) => void result.refetch()),
        }),
    });
}
