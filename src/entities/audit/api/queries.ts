import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@shared/api/client';
import { envelopeSchema, pageSchema } from '@shared/api/envelopeSchema';
import { queryPresets } from '@shared/api/queryPresets';

import { auditLogDetailSchema, auditLogSummarySchema } from '../model/types';

const auditLogPageSchema = pageSchema(auditLogSummarySchema);

export const AUDIT_KEY = ['admin', 'audit-logs'] as const;

// 감사 로그 엔드포인트 — AU01·AU02 (getddo-spec 05-api/audit.md 초안, 조회 전용)
export const AUDIT_LOGS_API_PATH = '/v1/admin/audit-logs';
export const auditLogApiPath = (auditLogId: string) => `${AUDIT_LOGS_API_PATH}/${auditLogId}`;

export interface AuditLogsParams {
    page: number;
    size: number;
    actorId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
}

// 감사 로그는 추가만 되는 기록이라 30초 캐시로 충분하다 — 검토 결정처럼 덮어쓰는 값이 아니다
export function useAuditLogs(params: AuditLogsParams) {
    return useQuery({
        ...queryPresets.standard,
        ...queryPresets.paged,
        queryKey: [...AUDIT_KEY, 'list', params],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(AUDIT_LOGS_API_PATH, { params });
            return envelopeSchema(auditLogPageSchema).parse(data).data;
        },
    });
}

export function useAuditLog(auditLogId: string | null) {
    return useQuery({
        ...queryPresets.standard,
        queryKey: [...AUDIT_KEY, 'detail', auditLogId],
        queryFn: async () => {
            const { data } = await apiClient.get<unknown>(auditLogApiPath(auditLogId!));
            return envelopeSchema(auditLogDetailSchema).parse(data).data;
        },
        enabled: Boolean(auditLogId),
    });
}
