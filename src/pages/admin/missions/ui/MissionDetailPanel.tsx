import { useEffect, useRef } from 'react';

import { useAdminMission } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { formatKst } from '@shared/utils/date';

import { SurveySummaryPanel } from './SurveySummaryPanel';

export function MissionDetailPanel({ id }: { id: string }) {
    const query = useAdminMission(id);
    const mission = query.data;
    const panelRef = useRef<HTMLElement>(null);
    useEffect(() => {
        // 패널은 목록 맨 아래에 그려져 '상세'를 눌러도 안 보였다 — 열리면 패널로 스크롤하고 포커스를 옮긴다
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        panelRef.current?.focus({ preventScroll: true });
    }, []);
    return (
        <section
            ref={panelRef}
            tabIndex={-1}
            aria-label="미션 상세"
            className="border-border-default flex min-w-0 flex-col gap-4 rounded-xl border p-4"
        >
            {query.isPending && <p role="status">상세를 불러오는 중입니다.</p>}
            {query.isError && (
                <p role="alert">{getErrorMessage(query.error)} 이전 성공값이 있으면 유지합니다.</p>
            )}
            <Button
                variant="secondary"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
            >
                상세 다시 조회
            </Button>
            {mission && (
                <>
                    <h2 className="text-title-3">{mission.title}</h2>
                    <p>{mission.description}</p>
                    <p>
                        {mission.status} · 보상 1장 · {formatKst(mission.startsAt)} ~{' '}
                        {formatKst(mission.endsAt)} KST
                    </p>
                    {mission.questions.map((q) => (
                        <div key={q.id} className="min-w-0 break-words">
                            <h3>
                                {q.displayOrder}. {q.questionText}
                            </h3>
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
                    {mission.missionType === 'SURVEY' && (
                        <SurveySummaryPanel
                            key={mission.id}
                            missionId={mission.id}
                            startsAt={mission.startsAt}
                            endsAt={mission.endsAt}
                            questions={mission.questions}
                        />
                    )}
                </>
            )}
        </section>
    );
}
