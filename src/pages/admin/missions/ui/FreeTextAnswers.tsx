import { useState } from 'react';

import { useSurveyAnswers } from '@entities/mission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { PagedResult } from '@shared/ui/paged-result';
import { formatKstFullDot } from '@shared/utils/date';

/**
 * AM05 자유 서술 답변 — 익명이라 사용자·제출 식별자가 없다.
 * 기간은 설문 집계와 같은 값을 받아 문항별 페이지만 독립으로 둔다
 */
export function FreeTextAnswers({
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
            <h4 className="text-body-sm-bold text-fg-primary break-keep">{questionText}</h4>
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
                                className="bg-surface-canvas flex flex-col gap-1 rounded-xl px-4 py-3"
                            >
                                {/* 답변 원문은 가공하지 않는다 — 텍스트로만 표시한다 (HTML 해석 금지, AM05 계약) */}
                                <p className="text-body-sm text-fg-primary break-words whitespace-pre-wrap">
                                    {a.answerText}
                                </p>
                                <p className="text-caption text-fg-tertiary tabular-nums">
                                    {formatKstFullDot(a.submittedAt, true)}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </PagedResult>
        </div>
    );
}
