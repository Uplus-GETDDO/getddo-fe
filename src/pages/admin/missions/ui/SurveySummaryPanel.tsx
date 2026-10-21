import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { AdminMission } from '@entities/mission';

import { surveyRangeSchema, useSurveyAnswers, useSurveySummary } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { PagedResult } from '@shared/ui/paged-result';
import { formatKst, formatYmd } from '@shared/utils/date';

const DAY_MS = 86_400_000;

export function SurveySummaryPanel({
    missionId,
    startsAt,
    endsAt,
    questions,
}: {
    missionId: string;
    startsAt: string;
    endsAt: string;
    questions: AdminMission['questions'];
}) {
    const [range, setRange] = useState<{ from: string; to: string } | null>(null);
    const [error, setError] = useState('');
    // 기본 기간은 미션 시작~종료 — 서버 규칙이 양끝 포함 최대 31일이라 넘으면 시작일부터 31일로 자르고 안내한다
    const defaultRange = useMemo(() => {
        const from = formatYmd(startsAt);
        const end = formatYmd(endsAt);
        const clamped = Date.parse(end) - Date.parse(from) > 30 * DAY_MS;
        const to = clamped
            ? new Date(Date.parse(from) + 30 * DAY_MS).toISOString().slice(0, 10)
            : end;
        return { from, to, clamped };
    }, [startsAt, endsAt]);
    const { register, handleSubmit } = useForm<{ from: string; to: string }>({
        defaultValues: { from: defaultRange.from, to: defaultRange.to },
    });
    const query = useSurveySummary(missionId, range);
    const freeTextQuestions = questions.filter((q) => q.questionType === 'FREE_TEXT');
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
            {defaultRange.clamped && (
                <p role="status">미션 기간이 31일을 넘어 시작일부터 31일만 잘랐습니다.</p>
            )}
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
                    <p role="status">
                        {query.isError || error
                            ? '마지막 성공 조회의 집계입니다.'
                            : '조회 결과입니다.'}
                    </p>
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
            {/* AM05 — 서술 문항의 답변 원문을 같은 집계 기간으로 조회한다 (익명) */}
            {freeTextQuestions.length > 0 && (
                <section className="flex min-w-0 flex-col gap-3" aria-label="자유 서술 답변">
                    <h4 className="text-body-sm-bold">자유 서술 답변</h4>
                    {!range ? (
                        <p>위 기간으로 집계를 조회하면 같은 기간의 답변이 표시됩니다.</p>
                    ) : (
                        freeTextQuestions.map((q) => (
                            <FreeTextAnswers
                                key={q.id}
                                missionId={missionId}
                                questionId={q.id}
                                questionText={q.questionText}
                                range={range}
                            />
                        ))
                    )}
                </section>
            )}
        </section>
    );
}

function FreeTextAnswers({
    missionId,
    questionId,
    questionText,
    range,
}: {
    missionId: string;
    questionId: string;
    questionText: string;
    range: { from: string; to: string };
}) {
    const [page, setPage] = useState(1);
    const query = useSurveyAnswers(missionId, questionId, range, page);
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <h5 className="break-keep">{questionText}</h5>
            <PagedResult
                {...query}
                page={page}
                onPageChange={setPage}
                emptyText="이 기간에 남긴 답변이 없습니다."
                errorText={getErrorMessage(
                    query.error,
                    '답변을 조회하지 못했습니다. 이전 성공값이 있으면 유지합니다.',
                )}
                onRetry={() => void query.refetch()}
            >
                {(items) => (
                    <ul className="flex flex-col gap-2">
                        {items.map((a, i) => (
                            <li
                                key={`${a.submittedAt}-${i}`}
                                className="border-border-default rounded-lg border p-3"
                            >
                                {/* 답변 원문은 가공하지 않는다 — 텍스트로만 표시한다 (HTML 해석 금지, AM05 계약) */}
                                <p className="break-words whitespace-pre-wrap">{a.answerText}</p>
                                <p className="text-caption text-fg-tertiary">
                                    {formatKst(a.submittedAt)} KST
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </PagedResult>
        </div>
    );
}
