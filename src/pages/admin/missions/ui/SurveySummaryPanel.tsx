import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { surveyRangeSchema, useSurveySummary } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { getPollingRetryDelay } from '@shared/api/queryPresets';
import { Button } from '@shared/ui/button';
import { DetailSection } from '@shared/ui/detail-list';
import { Input } from '@shared/ui/input';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';

/** 비율 막대 한 줄 — 이름 · 막대 · 건수. 숫자 목록만으로는 어느 쪽이 많은지 한눈에 안 들어왔다 */
function Bar({ label, count, max }: { label: string; count: number; max: number }) {
    const width = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3">
            <span className="text-body-sm text-fg-secondary truncate tabular-nums" title={label}>
                {label}
            </span>
            <span aria-hidden className="bg-surface-sunken h-2 overflow-hidden rounded-full">
                <span
                    className="bg-fg-secondary block h-full rounded-full"
                    style={{ width: `${width}%` }}
                />
            </span>
            <span className="text-body-sm-bold text-fg-primary text-right tabular-nums">
                {count}건
            </span>
        </li>
    );
}

/**
 * 설문 집계 구역 — 적용 기간은 부모가 소유해 서술 답변 구역과 공유한다.
 * 폼 입력은 이 안에서만 살고, '집계 조회'로 확정한 기간만 onRangeChange로 올린다
 */
export function SurveySummaryPanel({
    missionId,
    range,
    clamped,
    onRangeChange,
}: {
    missionId: string;
    range: { from: string; to: string };
    clamped: boolean;
    onRangeChange: (range: { from: string; to: string }) => void;
}) {
    const [error, setError] = useState('');
    const { register, handleSubmit } = useForm<{ from: string; to: string }>({
        defaultValues: range,
    });
    const query = useSurveySummary(missionId, range);
    const days = query.data?.dailyResponses ?? [];
    const total = days.reduce((sum, d) => sum + d.count, 0);
    const dayMax = Math.max(0, ...days.map((d) => d.count));

    return (
        <DetailSection title="응답 집계">
            <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) =>
                    void handleSubmit((values) => {
                        const parsed = surveyRangeSchema.safeParse(values);
                        if (!parsed.success) {
                            setError('실제 날짜와 양끝 포함 1~31일 범위를 확인해 주세요.');
                            return;
                        }
                        setError('');
                        onRangeChange(parsed.data);
                    })(event)
                }
            >
                <label className="text-caption text-fg-tertiary flex flex-col gap-1">
                    집계 시작일
                    <Input className="w-40" type="date" required {...register('from')} />
                </label>
                <span aria-hidden className="text-fg-tertiary pb-2.5">
                    ~
                </span>
                <label className="text-caption text-fg-tertiary flex flex-col gap-1">
                    집계 종료일
                    <Input className="w-40" type="date" required {...register('to')} />
                </label>
                <Button variant="secondary" type="submit" disabled={query.isFetching}>
                    집계 조회
                </Button>
            </form>
            <p className="text-caption text-fg-tertiary">
                완료된 설문만, 최대 31일까지 셉니다. 자유 서술은 아래 서술 답변에서 봐요.
            </p>
            {clamped && (
                <p role="status" className="text-caption text-fg-secondary">
                    미션 기간이 31일을 넘어 시작일부터 31일만 잘랐습니다.
                </p>
            )}
            {error && (
                <p role="alert" className="text-caption text-semantic-error-strong">
                    {error}
                </p>
            )}
            {query.isPending && (
                <LoadingBlock label="집계를 불러오는 중…">
                    <SkeletonRows rows={3} />
                </LoadingBlock>
            )}
            {query.isError && (
                <div role="alert" className="flex items-center gap-3">
                    <p className="text-semantic-error-strong text-body-sm">
                        {getErrorMessage(query.error, '집계를 불러오지 못했습니다.')}
                        {query.data && ' 마지막으로 받은 집계를 보여 줘요.'}
                    </p>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            if (!getPollingRetryDelay(query.error)) void query.refetch();
                        }}
                    >
                        다시 시도
                    </Button>
                </div>
            )}
            {query.data && (
                <div className="flex flex-col gap-5">
                    <div className="border-border-default flex flex-col gap-3 rounded-xl border p-4">
                        <p className="flex items-baseline justify-between gap-3">
                            <span className="text-body-sm-bold text-fg-primary">
                                날짜별 완료 응답
                            </span>
                            <span className="text-body-sm text-fg-secondary tabular-nums">
                                합계 <strong className="text-fg-primary">{total}건</strong>
                            </span>
                        </p>
                        <ul aria-label="날짜별 완료 응답" className="flex flex-col gap-1.5">
                            {days.map((d) => (
                                <Bar
                                    key={d.date}
                                    label={d.date.slice(5).replace('-', '.')}
                                    count={d.count}
                                    max={dayMax}
                                />
                            ))}
                        </ul>
                    </div>
                    {query.data.questions.length === 0 ? (
                        <p className="text-body-sm text-fg-tertiary">
                            집계할 선택형 문항이 없습니다.
                        </p>
                    ) : (
                        query.data.questions.map((q) => {
                            const max = Math.max(0, ...q.options.map((o) => o.count));
                            return (
                                <div
                                    key={q.questionId}
                                    className="border-border-default flex flex-col gap-3 rounded-xl border p-4"
                                >
                                    <h4 className="text-body-sm-bold text-fg-primary break-words">
                                        {q.questionText}
                                    </h4>
                                    <ul className="flex flex-col gap-1.5">
                                        {q.options.map((o) => (
                                            <Bar
                                                key={o.optionId}
                                                label={o.optionText}
                                                count={o.count}
                                                max={max}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </DetailSection>
    );
}
