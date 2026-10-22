import { useMemo, useState } from 'react';

import type { AdminMission } from '@entities/mission';

import { MISSION_STATUS_LABEL, useAdminMission } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { formatKst } from '@shared/utils/date';

import { surveyDefaultRange } from '../utils/surveyDefaultRange';
import { FreeTextAnswers } from './FreeTextAnswers';
import { SurveySummaryPanel } from './SurveySummaryPanel';

/**
 * 미션 상세 모달 — 목록 맨 아래에 열리던 패널을 Dialog로 옮겨 '상세' 클릭이 즉시 보이게 한다.
 * 모바일에서는 전체 화면으로 띄우고 ESC·바깥 클릭·닫기 버튼으로 닫는다
 */
export function MissionDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
    const query = useAdminMission(id);
    const mission = query.data;
    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent className="flex flex-col overflow-hidden max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[90dvh] sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>미션 상세</DialogTitle>
                    <DialogDescription>
                        기본 정보·문항·설문 응답 집계·서술 답변을 확인합니다.
                    </DialogDescription>
                </DialogHeader>
                {/* 스크롤은 이 래퍼가 담당한다 — DialogContent가 스크롤되면 절대 위치 닫기 버튼이 함께 밀려난다 */}
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                    {query.isPending && <p role="status">상세를 불러오는 중입니다.</p>}
                    {query.isError && (
                        <p role="alert">
                            {getErrorMessage(query.error)} 이전 성공값이 있으면 유지합니다.
                        </p>
                    )}
                    <Button
                        variant="secondary"
                        disabled={query.isFetching}
                        onClick={() => void query.refetch()}
                    >
                        상세 다시 조회
                    </Button>
                    {mission && <MissionDetail mission={mission} />}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MissionDetail({ mission }: { mission: AdminMission }) {
    const defaultRange = useMemo(
        () => surveyDefaultRange(mission.startsAt, mission.endsAt),
        [mission.startsAt, mission.endsAt],
    );
    // 모달을 여는 행위가 곧 집계 조회 의도라 기본 기간(미션 기간, 31일 절단)으로 자동 집계한다
    const [range, setRange] = useState({ from: defaultRange.from, to: defaultRange.to });
    const freeTextQuestions = mission.questions.filter((q) => q.questionType === 'FREE_TEXT');
    return (
        <div className="flex min-w-0 flex-col gap-6">
            <section aria-label="기본 정보" className="flex min-w-0 flex-col gap-2">
                <h3 className="text-title-3">{mission.title}</h3>
                <p>{mission.description}</p>
                <p>
                    {MISSION_STATUS_LABEL[mission.status]} · 보상 1장 ·{' '}
                    {formatKst(mission.startsAt)} ~ {formatKst(mission.endsAt)} KST
                </p>
                <p className="text-body-sm text-fg-secondary">
                    작성 {mission.createdByName ?? mission.createdBy}
                </p>
                <p className="text-caption text-fg-tertiary">
                    종료 시각이 지나도 서버 주기 처리로 '종료' 반영까지 최대 약 1분 걸릴 수
                    있습니다.
                </p>
            </section>
            <section aria-label="문항" className="flex min-w-0 flex-col gap-3">
                <h3>문항</h3>
                {mission.questions.map((q) => (
                    <div key={q.id} className="min-w-0 break-words">
                        <h4>
                            {q.displayOrder}. {q.questionText}
                        </h4>
                        <p>
                            {q.questionType}
                            {mission.missionType === 'SURVEY'
                                ? q.required
                                    ? ' · 필수'
                                    : ' · 선택'
                                : ''}
                        </p>
                        {q.correctAnswer && <p>정답: {q.correctAnswer}</p>}
                        <ul>
                            {q.options?.map((o) => (
                                <li key={o.id}>
                                    {o.optionText}
                                    {o.isCorrect ? ' (정답)' : ''}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </section>
            {mission.missionType === 'SURVEY' && (
                <>
                    <SurveySummaryPanel
                        missionId={mission.id}
                        range={range}
                        clamped={defaultRange.clamped}
                        onRangeChange={setRange}
                    />
                    {freeTextQuestions.length > 0 && (
                        <section className="flex min-w-0 flex-col gap-3" aria-label="서술 답변">
                            <h3>서술 답변</h3>
                            <p className="text-body-sm text-fg-secondary">
                                설문 집계와 같은 기간의 익명 답변 원문입니다.
                            </p>
                            {freeTextQuestions.map((q) => (
                                <FreeTextAnswers
                                    key={`${q.id}-${range.from}-${range.to}`}
                                    missionId={mission.id}
                                    questionId={q.id}
                                    questionText={q.questionText}
                                    range={range}
                                />
                            ))}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
