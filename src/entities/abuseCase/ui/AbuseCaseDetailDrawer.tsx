import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
    DetailItem,
    DetailList,
    DetailMeta,
    DetailSection,
    DetailStats,
    DetailSummary,
} from '@shared/ui/detail-list';
import {
    InspectorBody,
    InspectorDescription,
    InspectorHeader,
    InspectorPanel,
    InspectorTitle,
} from '@shared/ui/inspector';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import type { AbuseCase } from '../model/types';

import { useAbuseCase } from '../api/queries';
import {
    ABUSE_DETECTION_TYPE_LABEL,
    ABUSE_SOURCE_TYPE_LABEL,
    ABUSE_TRIGGER_SCOPE_LABEL,
} from '../model/types';

/**
 * 차단 내역 상세 — 목록 요약을 먼저 보여주고, AR02 상세가 오면 차단 판정 근거(evidence)를 덧붙인다.
 * 차단 기록은 조회 전용이다 — 다른 관리자 상세와 같이 목록 옆 칸에 열어 목록을 보면서 읽게 한다.
 */
export function AbuseCaseDetailDrawer({
    abuseCase,
    open,
    onOpenChange,
}: {
    abuseCase: AbuseCase | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const {
        data: detail,
        isPending,
        isError,
        refetch,
    } = useAbuseCase(open ? (abuseCase?.id ?? null) : null);
    const shown = abuseCase;

    return (
        <InspectorPanel open={open} onOpenChange={onOpenChange}>
            <InspectorBody>
                <InspectorHeader>
                    <InspectorTitle>{shown ? shown.userNickname : '차단 내역'}</InspectorTitle>
                    <InspectorDescription>차단 내역 상세</InspectorDescription>
                </InspectorHeader>
                {shown && (
                    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                        {/* 핵심 — 왜, 언제부터 언제까지 막혔는지 */}
                        <DetailSummary>
                            <div className="flex flex-wrap gap-1.5">
                                <Badge variant="neutral">
                                    {ABUSE_SOURCE_TYPE_LABEL[shown.sourceType]}
                                </Badge>
                                <Badge variant="outline">
                                    {ABUSE_DETECTION_TYPE_LABEL[shown.detectionType]}
                                </Badge>
                            </div>
                            <p className="text-body-bold text-fg-primary">
                                {shown.detectionReason}
                            </p>
                            <p className="text-body-sm text-fg-secondary tabular-nums">
                                {formatKst(shown.blockedAt)} ~ {formatKst(shown.blockedUntil)}
                            </p>
                        </DetailSummary>

                        <DetailSection title="대상">
                            <DetailList>
                                <DetailItem label="사용자">
                                    {shown.userNickname}
                                    <span className="text-caption text-fg-tertiary block">
                                        {shown.userId}
                                    </span>
                                </DetailItem>
                                <DetailItem label="관련 이벤트">
                                    {shown.eventTitle ?? '—'}
                                </DetailItem>
                            </DetailList>
                        </DetailSection>

                        <DetailSection title="판정 근거">
                            {detail ? (
                                <>
                                    {/* 거절 횟수가 기준을 넘어 막혔다 — 세 숫자를 나란히 놓아 비교가 바로 되게 한다 */}
                                    <DetailStats
                                        items={[
                                            {
                                                label: '허용 한도',
                                                value: `${detail.evidence.requestLimit}건`,
                                            },
                                            {
                                                label: '거절 횟수',
                                                value: `${detail.evidence.rejectedCount}건`,
                                                emphasis: true,
                                            },
                                            {
                                                label: '차단 기준',
                                                value: `${detail.evidence.rejectionThreshold}건`,
                                            },
                                        ]}
                                    />
                                    <DetailList>
                                        <DetailItem label="판정 기준">
                                            {
                                                ABUSE_TRIGGER_SCOPE_LABEL[
                                                    detail.evidence.triggerScope
                                                ]
                                            }
                                        </DetailItem>
                                        <DetailItem label="집계 구간">
                                            {formatKst(detail.evidence.windowStartedAt)} ~{' '}
                                            {formatKst(detail.evidence.windowEndsAt)}
                                        </DetailItem>
                                    </DetailList>
                                </>
                            ) : (
                                isPending && (
                                    <LoadingBlock label="판정 근거를 불러오는 중…">
                                        <SkeletonRows rows={2} />
                                    </LoadingBlock>
                                )
                            )}
                            {isError && (
                                <div className="flex items-center gap-3">
                                    <p className="text-semantic-error-strong text-body-sm">
                                        판정 근거를 불러오지 못했습니다.
                                    </p>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => void refetch()}
                                    >
                                        다시 시도
                                    </Button>
                                </div>
                            )}
                        </DetailSection>

                        <DetailMeta>
                            차단 기록 ID {shown.id}
                            {detail && ` · 규칙 버전 ${detail.evidence.ruleVersion}`}
                        </DetailMeta>
                    </div>
                )}
            </InspectorBody>
        </InspectorPanel>
    );
}
