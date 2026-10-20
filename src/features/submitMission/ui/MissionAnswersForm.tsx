import { motion } from 'framer-motion';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import type { MissionAnswer, MissionAnswerDraft, MissionQuestion } from '@entities/mission';

import { buildMissionAnswers, findMissingRequired, MissionQuestionField } from '@entities/mission';
import { Button } from '@shared/ui/button';

/**
 * 설문·퀴즈 공통 문항 폼 — 문항 렌더링과 필수 문항 검증만 담당한다.
 * 유효한 제출 payload는 onSubmit으로 올리고, 제출 전 확인(설문)·채점 재도전(퀴즈) 같은
 * 제출 정책은 사용처가 정한다.
 * variant='quiz': 문항을 가운데 정렬로 둔다.
 * 제출 버튼은 설문·퀴즈 모두 모달 너비를 꽉 채운다.
 */
export function MissionAnswersForm({
    questions,
    isPending,
    submitLabel,
    pendingLabel,
    onSubmit,
    onAnswersChange,
    variant = 'survey',
}: {
    questions: MissionQuestion[];
    isPending: boolean;
    submitLabel: string;
    pendingLabel: string;
    onSubmit: (answers: MissionAnswer[]) => void;
    /** 답변이 하나라도 바뀔 때 호출 — 오답 배너 거두기 같은 부수 처리용 */
    onAnswersChange?: () => void;
    /** 설문은 문항을 구분선으로 나열, 퀴즈는 가운데 정렬 */
    variant?: 'survey' | 'quiz';
}) {
    const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
    const { control, handleSubmit } = useForm<Record<string, MissionAnswerDraft>>({
        defaultValues: {},
    });

    const ordered = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);
    // 아래 제출 줄의 답변 진행 — 고른 선택지나 공백 아닌 글이 있으면 답한 문항으로 센다.
    // 필수 문항이 있으면 필수만 센다 (선택 문항까지 세면 다 답해야 하는 것처럼 보인다).
    // 문항이 하나뿐이면 진행 막대가 의미 없어 보여 주지 않는다
    const values = useWatch({ control });
    const required = ordered.filter((question) => question.required);
    const tracked = required.length > 0 ? required : ordered;
    const answeredCount = tracked.filter((question) => {
        const draft = values[question.id];
        return !!draft?.selectedOptionId || !!draft?.answerText?.trim();
    }).length;
    const showProgress = ordered.length > 1;

    const submit = (values: Record<string, MissionAnswerDraft>) => {
        const missing = variant === 'quiz' ? [] : findMissingRequired(ordered, values);
        if (missing.length > 0) {
            setMissingIds(new Set(missing.map((q) => q.id)));
            return;
        }
        const answers = buildMissionAnswers(ordered, values);
        if (variant === 'quiz' && answers.length === 0) return;
        onSubmit(answers);
    };

    const fields = ordered.map((question, index) => (
        <Controller
            key={question.id}
            control={control}
            name={question.id}
            render={({ field }) => (
                <MissionQuestionField
                    question={question}
                    number={index + 1}
                    centered={variant === 'quiz'}
                    value={field.value}
                    invalid={missingIds.has(question.id)}
                    disabled={isPending}
                    onChange={(draft) => {
                        field.onChange(draft);
                        onAnswersChange?.();
                        // 답이 바뀐 문항은 필수 누락 표시를 바로 거둔다
                        if (missingIds.has(question.id)) {
                            setMissingIds((prev) => {
                                const next = new Set(prev);
                                next.delete(question.id);
                                return next;
                            });
                        }
                    }}
                />
            )}
        />
    ));

    return (
        <motion.form
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            onSubmit={(event) => void handleSubmit(submit)(event)}
            className="flex flex-col"
        >
            {fields}
            {/* 제출 줄 — 문항이 길어도 모달 아래에 붙어 있다. 모달 본문 좌우 여백(px-6)만큼 넓혀 가장자리까지 채운다. 구분선 없이 흰 바탕만 문항 위를 덮는다 */}
            <div className="bg-surface-elevated sticky bottom-0 -mx-6 mt-6 flex flex-col gap-3 px-6 py-4">
                {showProgress && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-caption text-fg-secondary">
                            {required.length > 0 && '필수 '}
                            <span className="text-body-sm-bold text-fg-primary tabular-nums">
                                {answeredCount} / {tracked.length}
                            </span>{' '}
                            답변
                        </span>
                        <span
                            aria-hidden
                            className="bg-surface-sunken h-1.5 overflow-hidden rounded-full"
                        >
                            <span
                                className="bg-action-neutral block h-full rounded-full transition-[width] duration-300"
                                style={{
                                    width: `${tracked.length > 0 ? Math.round((answeredCount / tracked.length) * 100) : 0}%`,
                                }}
                            />
                        </span>
                    </div>
                )}
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isPending}
                    className="w-full"
                >
                    {isPending ? pendingLabel : submitLabel}
                </Button>
            </div>
        </motion.form>
    );
}
