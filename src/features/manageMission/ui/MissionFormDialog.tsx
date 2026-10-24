import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { ZodError } from 'zod';

import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Segmented } from '@shared/ui/segmented';
import { Textarea } from '@shared/ui/textarea';

import type { MissionFormValues } from '../model/missionForm';

import { useCreateMission } from '../api/queries';
import { missionFormBody } from '../model/missionForm';

const FIELD = 'flex min-w-0 flex-col gap-1.5';
const LABEL = 'text-body-sm text-fg-secondary';
const MISSION_TYPE_OPTIONS = [
    { value: 'SURVEY', label: '설문' },
    { value: 'QUIZ', label: '퀴즈' },
] as const;
const SURVEY_QUESTION_OPTIONS = [
    { value: 'SINGLE_CHOICE', label: '단일 선택' },
    { value: 'FREE_TEXT', label: '자유 서술' },
] as const;
const QUIZ_QUESTION_OPTIONS = [
    { value: 'SINGLE_CHOICE', label: '단일 선택' },
    { value: 'OX', label: 'OX' },
    { value: 'SHORT_ANSWER', label: '단답' },
] as const;

const emptyQuestion: MissionFormValues['questions'][number] = {
    questionType: 'SINGLE_CHOICE',
    questionText: '',
    required: true,
    optionsText: '',
    correctOption: 1,
    correctAnswer: '',
};
export function MissionFormDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const mutation = useCreateMission();
    const [error, setError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const { register, control, handleSubmit, reset, getValues, setValue } =
        useForm<MissionFormValues>({
            defaultValues: {
                title: '',
                description: '',
                missionType: 'SURVEY',
                startsAt: '',
                endsAt: '',
                questions: [{ ...emptyQuestion }],
            },
        });
    const { fields, append, remove } = useFieldArray({ control, name: 'questions' });
    const values = useWatch({ control });
    const quiz = values.missionType === 'QUIZ';
    // 유형을 바꾸면 그 유형에서 못 쓰는 문항 유형을 단일 선택으로 되돌린다
    const changeMissionType = (next: MissionFormValues['missionType']) => {
        setValue('missionType', next);
        const nextQuiz = next === 'QUIZ';
        getValues('questions').forEach((q, i) => {
            const allowed = nextQuiz
                ? q.questionType !== 'FREE_TEXT'
                : ['SINGLE_CHOICE', 'FREE_TEXT'].includes(q.questionType);
            if (!allowed) setValue(`questions.${i}.questionType`, 'SINGLE_CHOICE');
        });
    };
    const submit = handleSubmit((draft) => {
        try {
            const body = missionFormBody(draft);
            setError('');
            mutation.mutate(body, {
                onSuccess: () => {
                    reset();
                    onOpenChange(false);
                },
                onError: (cause) => {
                    setUncertain(true);
                    setError(
                        `${getErrorMessage(cause)} 등록 여부를 목록에서 확인한 뒤 다시 등록해 주세요. 자동 재전송하지 않습니다.`,
                    );
                },
            });
        } catch (cause) {
            setError(
                cause instanceof ZodError
                    ? cause.issues.map((i) => i.message).join(' ')
                    : '운영 시각과 문항 입력을 확인해 주세요.',
            );
        }
    });
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!mutation.isPending) {
                    onOpenChange(next);
                    if (next) {
                        setError('');
                        setUncertain(false);
                    }
                }
            }}
        >
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-border-default border-b px-6 py-5">
                    <DialogTitle className="text-fg-primary text-xl leading-7 font-semibold">
                        미션 등록
                    </DialogTitle>
                    <DialogDescription>
                        등록 즉시 진행 중이 돼요. 완료 보상은 응모권 1장이고, 등록한 뒤에는 고칠 수
                        없어 새 미션으로 등록해요.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(event) => void submit(event)}
                    className="flex min-h-0 min-w-0 flex-1 flex-col"
                >
                    <fieldset
                        disabled={mutation.isPending || uncertain}
                        className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5"
                    >
                        {/* 종류를 먼저 — 고르는 종류에 따라 문항 유형과 정답 칸이 달라진다 */}
                        <div className="flex flex-col gap-2">
                            <span className={LABEL}>미션 유형</span>
                            <Segmented
                                value={values.missionType ?? 'SURVEY'}
                                onValueChange={changeMissionType}
                                options={MISSION_TYPE_OPTIONS}
                                label="미션 유형"
                                className="self-start"
                            />
                        </div>
                        <label className={FIELD}>
                            <span className={LABEL}>미션 제목</span>
                            <Input required maxLength={200} {...register('title')} />
                        </label>
                        <label className={FIELD}>
                            <span className={LABEL}>설명</span>
                            <Textarea {...register('description')} />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className={FIELD}>
                                <span className={LABEL}>운영 시작</span>
                                <Input type="datetime-local" required {...register('startsAt')} />
                            </label>
                            <label className={FIELD}>
                                <span className={LABEL}>운영 종료</span>
                                <Input type="datetime-local" required {...register('endsAt')} />
                            </label>
                        </div>

                        <div className="flex flex-col gap-3">
                            <span className="text-body-sm-bold text-fg-primary">
                                문항 {fields.length}개
                            </span>
                            {fields.map((field, i) => {
                                const type = values.questions?.[i]?.questionType;
                                const choice = type === 'SINGLE_CHOICE' || type === 'OX';
                                return (
                                    <fieldset
                                        key={field.id}
                                        className="border-border-default flex min-w-0 flex-col gap-4 rounded-xl border p-4"
                                    >
                                        <legend className="sr-only">{i + 1}번 문항</legend>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="flex items-center gap-2">
                                                <span
                                                    aria-hidden
                                                    className="bg-surface-sunken text-fg-secondary flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                                                >
                                                    {i + 1}
                                                </span>
                                                <Controller
                                                    control={control}
                                                    name={`questions.${i}.questionType`}
                                                    render={({ field: typeField }) => (
                                                        <Segmented
                                                            value={typeField.value}
                                                            onValueChange={typeField.onChange}
                                                            options={
                                                                quiz
                                                                    ? QUIZ_QUESTION_OPTIONS
                                                                    : SURVEY_QUESTION_OPTIONS
                                                            }
                                                            label={`${i + 1}번 문항 유형`}
                                                        />
                                                    )}
                                                />
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-semantic-error-strong"
                                                disabled={fields.length <= 1}
                                                onClick={() => remove(i)}
                                                aria-label={`${i + 1}번 문항 삭제`}
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                        <label className={FIELD}>
                                            <span className={LABEL}>{i + 1}번 문항 내용</span>
                                            <Input
                                                required
                                                {...register(`questions.${i}.questionText`)}
                                            />
                                        </label>
                                        {choice && (
                                            <label className={FIELD}>
                                                <span className={LABEL}>
                                                    {i + 1}번 선택지 (한 줄에 하나, 2개 이상)
                                                </span>
                                                <Textarea
                                                    required
                                                    {...register(`questions.${i}.optionsText`)}
                                                />
                                            </label>
                                        )}
                                        {quiz && choice && (
                                            <label className={`${FIELD} w-40`}>
                                                <span className={LABEL}>
                                                    {i + 1}번 정답 선택지 번호
                                                </span>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    required
                                                    {...register(`questions.${i}.correctOption`, {
                                                        valueAsNumber: true,
                                                    })}
                                                />
                                            </label>
                                        )}
                                        {quiz && !choice && (
                                            <label className={FIELD}>
                                                <span className={LABEL}>{i + 1}번 정답</span>
                                                <Input
                                                    required
                                                    {...register(`questions.${i}.correctAnswer`)}
                                                />
                                            </label>
                                        )}
                                        {!quiz && (
                                            <label className="text-body-sm text-fg-primary flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="accent-fg-primary size-4"
                                                    {...register(`questions.${i}.required`)}
                                                />
                                                필수 답변
                                            </label>
                                        )}
                                    </fieldset>
                                );
                            })}
                            <Button
                                type="button"
                                variant="secondary"
                                className="self-start"
                                onClick={() => append({ ...emptyQuestion })}
                            >
                                + 문항 추가
                            </Button>
                        </div>
                    </fieldset>
                    {/* 저장 줄은 아래에 고정 — 문항이 길어져도 등록 버튼을 찾으러 내려가지 않는다 */}
                    <div className="border-border-default flex flex-col gap-2 border-t px-6 py-4">
                        {error && (
                            <p role="alert" className="text-body-sm text-semantic-error-strong">
                                {error}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={mutation.isPending}
                                onClick={() => onOpenChange(false)}
                            >
                                취소
                            </Button>
                            <Button type="submit" disabled={mutation.isPending || uncertain}>
                                {mutation.isPending ? '등록 중…' : '등록'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
