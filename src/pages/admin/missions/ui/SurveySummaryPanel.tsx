import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { surveyRangeSchema, useSurveySummary } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

export function SurveySummaryPanel({ missionId }: { missionId: string }) {
    const [range, setRange] = useState<{ from: string; to: string } | null>(null);
    const [error, setError] = useState('');
    const { register, handleSubmit } = useForm<{ from: string; to: string }>();
    const query = useSurveySummary(missionId, range);
    return (
        <section className="flex min-w-0 flex-col gap-3" aria-label="설문 집계">
            <h3>설문 응답 집계</h3>
            <p>
                완료된 설문만 집계합니다. KST 날짜 양끝 포함 최대 31일이며 자유 서술은 집계에서
                제외됩니다.
            </p>
            <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) =>
                    void handleSubmit((values) => {
                        const parsed = surveyRangeSchema.safeParse(values);
                        if (!parsed.success) {
                            setError('실제 날짜와 양끝 포함 1~31일 범위를 확인해 주세요.');
                            return;
                        }
                        setError('');
                        setRange(parsed.data);
                    })(event)
                }
            >
                <label className="flex min-w-0 flex-1 flex-col gap-2">
                    집계 시작일
                    <Input className="min-h-11" type="date" required {...register('from')} />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-2">
                    집계 종료일
                    <Input className="min-h-11" type="date" required {...register('to')} />
                </label>
                <Button className="min-h-11" type="submit" disabled={query.isFetching}>
                    집계 조회
                </Button>
            </form>
            {error && <p role="alert">{error}</p>}
            {range && query.isPending && <p role="status">집계를 불러오는 중입니다.</p>}
            {query.isError && (
                <div role="alert">
                    <p>{getErrorMessage(query.error)} 이전 성공값이 있으면 유지합니다.</p>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            if (!getPollingRetryDelay(query.error)) void query.refetch();
                        }}
                    >
                        집계 다시 조회
                    </Button>
                </div>
            )}
            {query.data && (
                <>
                    <p role="status">마지막 성공 조회의 집계입니다.</p>
                    <ul>
                        {query.data.dailyResponses.map((d) => (
                            <li key={d.date}>
                                {d.date}: {d.count}건
                            </li>
                        ))}
                    </ul>
                    {query.data.questions.length === 0 && <p>집계할 선택형 문항이 없습니다.</p>}
                    {query.data.questions.map((q) => (
                        <div key={q.questionId}>
                            <h4>{q.questionText}</h4>
                            <ul>
                                {q.options.map((o) => (
                                    <li key={o.optionId}>
                                        {o.optionText}: {o.count}건
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </>
            )}
        </section>
    );
}
