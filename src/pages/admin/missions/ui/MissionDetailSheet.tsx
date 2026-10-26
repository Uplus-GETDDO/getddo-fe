import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { AdminMission } from '@entities/mission';

import { MISSION_STATUS_LABEL, useAdminMission } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
    DetailItem,
    DetailList,
    DetailMeta,
    DetailSection,
    DetailSummary,
} from '@shared/ui/detail-list';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { StatusDot } from '@shared/ui/status-dot';
import { formatKstFullDot } from '@shared/utils/date';

import { MISSION_TYPE_LABEL, QUESTION_TYPE_LABEL } from '../model/labels';
import { surveyDefaultRange } from '../utils/surveyDefaultRange';
import { FreeTextAnswers } from './FreeTextAnswers';
import { SurveySummaryPanel } from './SurveySummaryPanel';

/**
 * 미션 상세 드로어 — 다른 관리자 상세와 같이 오른쪽에서 열린다.
 * 맨 위 요약(상태·유형·제목·기간) → 기본 정보 → 문항 → (설문) 응답 집계·서술 답변 순
 */
export function MissionDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
    return (
        <Dialog
            open={id !== null}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                {id && <MissionDetailBody key={id} id={id} />}
            </DialogContent>
        </Dialog>
    );
}

function MissionDetailBody({ id }: { id: string }) {
    const query = useAdminMission(id);
    const mission = query.data;
    return (
        <>
            <DialogHeader className="border-border-default gap-1 border-b px-6 pt-6 pr-14 pb-5">
                <DialogTitle className="text-fg-primary text-xl leading-7 font-semibold tracking-[-0.01em]">
                    미션 상세
                </DialogTitle>
                <DialogDescription className="text-fg-secondary sr-only text-sm">
                    기본 정보·문항·설문 응답을 확인합니다.
                </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                {query.isPending && (
                    <LoadingBlock label="상세를 불러오는 중…">
                        <SkeletonRows rows={4} />
                    </LoadingBlock>
                )}
                {query.isError && (
                    <div role="alert" className="flex items-center gap-3">
                        <p className="text-semantic-error-strong text-body-sm">
                            {getErrorMessage(query.error, '상세를 불러오지 못했습니다.')}
                        </p>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={query.isFetching}
                            onClick={() => void query.refetch()}
                        >
                            다시 시도
                        </Button>
                    </div>
                )}
                {mission && <MissionDetail mission={mission} />}
            </div>
        </>
    );
}

function MissionDetail({ mission }: { mission: AdminMission }) {
    const defaultRange = useMemo(
        () => surveyDefaultRange(mission.startsAt, mission.endsAt),
        [mission.startsAt, mission.endsAt],
    );
    // 상세를 여는 행위가 곧 집계 조회 의도라 기본 기간(미션 기간, 31일 절단)으로 자동 집계한다
    const [range, setRange] = useState({ from: defaultRange.from, to: defaultRange.to });
    const freeTextQuestions = mission.questions.filter((q) => q.questionType === 'FREE_TEXT');
    const quiz = mission.missionType === 'QUIZ';
    return (
        <>
            <DetailSummary>
                <div className="flex items-center gap-2">
                    <StatusDot tone={mission.status === 'ACTIVE' ? 'brand' : 'muted'}>
                        {MISSION_STATUS_LABEL[mission.status]}
                    </StatusDot>
                    <Badge variant="outline" size="sm">
                        {MISSION_TYPE_LABEL[mission.missionType]}
                    </Badge>
                </div>
                <h3 className="text-title-3 text-fg-primary break-words">{mission.title}</h3>
                <p className="text-body-sm text-fg-secondary tabular-nums">
                    {formatKstFullDot(mission.startsAt, true)} ~{' '}
                    {formatKstFullDot(mission.endsAt, true)}
                </p>
            </DetailSummary>

            <DetailSection title="기본 정보">
                <DetailList>
                    <DetailItem label="설명">
                        {mission.description ? (
                            <span className="whitespace-pre-wrap">{mission.description}</span>
                        ) : (
                            <span className="text-fg-tertiary">없음</span>
                        )}
                    </DetailItem>
                    <DetailItem label="완료 보상">응모권 1장</DetailItem>
                    <DetailItem label="작성자">
                        {mission.createdByName ?? mission.createdBy}
                    </DetailItem>
                    <DetailItem label="등록일">
                        {formatKstFullDot(mission.createdAt, true)}
                    </DetailItem>
                </DetailList>
            </DetailSection>

            <DetailSection title={`문항 ${mission.questions.length}개`}>
                <ol className="flex flex-col gap-3">
                    {mission.questions.map((q) => (
                        <li
                            key={q.id}
                            className="border-border-default flex min-w-0 flex-col gap-2 rounded-xl border p-4"
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    aria-hidden
                                    className="bg-surface-sunken text-fg-secondary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                                >
                                    {q.displayOrder}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <h4 className="text-body-sm-bold text-fg-primary break-words">
                                        <span className="sr-only">{q.displayOrder}. </span>
                                        {q.questionText}
                                    </h4>
                                    <p className="text-caption text-fg-tertiary">
                                        {QUESTION_TYPE_LABEL[q.questionType]}
                                        {!quiz && (q.required ? ' · 필수' : ' · 선택')}
                                    </p>
                                </div>
                            </div>
                            {q.options && q.options.length > 0 && (
                                <ul className="flex flex-col gap-1 pl-9">
                                    {q.options.map((o) => (
                                        <li
                                            key={o.id}
                                            className={
                                                o.isCorrect
                                                    ? 'text-body-sm text-fg-primary flex items-center gap-1.5 font-semibold'
                                                    : 'text-body-sm text-fg-secondary flex items-center gap-1.5'
                                            }
                                        >
                                            {o.optionText}
                                            {o.isCorrect && (
                                                <span className="text-status-approved-text flex items-center gap-0.5 text-xs">
                                                    <Check aria-hidden className="size-3.5" />
                                                    정답
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {q.correctAnswer && (
                                <p className="text-body-sm text-fg-primary pl-9">
                                    <span className="text-fg-tertiary">정답 </span>
                                    {q.correctAnswer}
                                </p>
                            )}
                        </li>
                    ))}
                </ol>
            </DetailSection>

            {!quiz && (
                <>
                    <SurveySummaryPanel
                        missionId={mission.id}
                        range={range}
                        clamped={defaultRange.clamped}
                        onRangeChange={setRange}
                    />
                    {freeTextQuestions.length > 0 && (
                        <DetailSection title="서술 답변">
                            {freeTextQuestions.map((q) => (
                                <FreeTextAnswers
                                    key={`${q.id}-${range.from}-${range.to}`}
                                    missionId={mission.id}
                                    questionId={q.id}
                                    questionText={q.questionText}
                                    range={range}
                                />
                            ))}
                        </DetailSection>
                    )}
                </>
            )}

            <DetailMeta>
                미션 ID {mission.id} · 종료 시각이 지나면 최대 약 1분 뒤 '종료'로 바뀝니다
            </DetailMeta>
        </>
    );
}
