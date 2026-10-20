import type { DrawRunStatus } from './types';

export const DRAW_RUN_STATUS_META: Record<DrawRunStatus, { label: string; chipClass: string }> = {
    PREPARING: { label: '준비 중', chipClass: 'bg-status-pending text-status-pending-text' },
    READY: { label: '시작 대기', chipClass: 'bg-status-pending text-status-pending-text' },
    RUNNING: { label: '추첨 중', chipClass: 'bg-status-active text-status-active-text' },
    CONFIRMED: { label: '확정', chipClass: 'bg-status-approved text-status-approved-text' },
    FAILED: { label: '실패', chipClass: 'bg-status-rejected text-status-rejected-text' },
    // 당첨자를 뽑지 않고 끝난 실행 — 실패가 아니라 정상 종료라 중립 톤으로 둔다
    NO_ENTRIES: { label: '응모자 없음', chipClass: 'bg-status-pending text-status-pending-text' },
    NO_CANDIDATES: {
        label: '추첨 대상 없음',
        chipClass: 'bg-status-pending text-status-pending-text',
    },
};

export const DRAW_TYPE_LABEL = { INITIAL: '최초 추첨', REPLACEMENT: '재추첨' } as const;

/** 서버가 아직 선정을 끝내지 않은 상태 — 폴링 대상이다. FAILED는 관리자 재개를 기다리므로 포함하지 않는다 */
export const isDrawRunInProgress = (status: DrawRunStatus) =>
    status === 'PREPARING' || status === 'READY' || status === 'RUNNING';
