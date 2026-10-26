import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { pollingReadInterval, queryPresets } from '@shared/api/queryPresets';

import { adminTicketHistorySchema } from '../model/admin';

export const ADMIN_TICKETS_KEY = ['admin', 'tickets'] as const;

// 관리자 응모권 조회 엔드포인트 — 2026-10-12 백엔드 답변 기준(스펙 미반영). 경로가 바뀌면 여기만 고친다
export const ADMIN_TICKET_HISTORIES_API_PATH = '/v1/admin/ticket-histories';

interface PageParams {
    page: number;
    size: number;
}

export interface AdminTicketHistoriesParams extends PageParams {
    userId?: string;
    eventId?: string;
    missionId?: string;
    operationType?: string;
    from?: string;
    to?: string;
}

// 운영 화면 목록은 화면에 들어올 때마다 서버에서 새로 받는다.
// 페이지·필터를 바꾸면 이전 결과를 새 페이지처럼 보이지 않도록 로딩 상태로 돌아간다
const adminListOptions = {
    ...queryPresets.noCache,
} as const;

// AO05 — 전체 이력. 시연 중 지급·사용이 곧바로 반영되게 30초 폴링하고,
// 탭이 백그라운드면 멈춘다 (429·종결 오류 대기는 pollingReadInterval이 처리한다)
export function useAdminTicketHistories(params: AdminTicketHistoriesParams) {
    return useQuery({
        ...adminListOptions,
        queryKey: [...ADMIN_TICKETS_KEY, 'histories', params],
        // 필터·페이지를 바꿔 다시 받는 동안 이전 목록을 그대로 두어 표가 스켈레톤으로 꺼졌다 켜지지 않게 한다
        placeholderData: keepPreviousData,
        refetchInterval: (query) => pollingReadInterval(query),
        refetchIntervalInBackground: false,
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(ADMIN_TICKET_HISTORIES_API_PATH, {
                params,
            });
            return envelopeSchema(pageSchema(adminTicketHistorySchema)).parse(data).data;
        },
    });
}
