import type { ChangeEvent } from 'react';

import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
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
import { Textarea } from '@shared/ui/textarea';

import type { MissionFormValues } from '../model/missionForm';

import { useCreateMission } from '../api/queries';
import { missionFormBody } from '../model/missionForm';

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
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>미션 등록</DialogTitle>
                    <DialogDescription>
                        등록 즉시 ACTIVE가 됩니다. 운영 기간은 KST 기준이며 완료 보상은 등급 응모권
                        1장입니다. 변경은 새 미션으로 등록합니다.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(event) => void submit(event)}
                    className="flex min-w-0 flex-col gap-4"
                >
                    <fieldset
                        disabled={mutation.isPending || uncertain}
                        className="flex min-w-0 flex-col gap-4"
                    >
                        <label className="flex flex-col gap-2">
                            미션 제목
                            <Input
                                className="min-h-11"
                                required
                                maxLength={200}
                                {...register('title')}
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            설명
                            <Textarea {...register('description')} />
                        </label>
                        <label className="flex flex-col gap-2">
                            미션 유형
                            <select
                                className="border-border-default bg-surface-elevated min-h-11 rounded-md border p-2"
                                {...register('missionType', {
                                    onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                                        const nextQuiz = event.target.value === 'QUIZ';
                                        getValues('questions').forEach((q, i) => {
                                            const allowed = nextQuiz
                                                ? q.questionType !== 'FREE_TEXT'
                                                : ['SINGLE_CHOICE', 'FREE_TEXT'].includes(
                                                      q.questionType,
                                                  );
                                            if (!allowed)
                                                setValue(
                                                    `questions.${i}.questionType`,
                                                    'SINGLE_CHOICE',
                                                );
                                        });
                                    },
                                })}
                            >
                                <option value="SURVEY">설문</option>
                                <option value="QUIZ">퀴즈</option>
                            </select>
                        </label>
                        <label className="flex min-w-0 flex-col gap-2">
                            운영 시작 (KST)
                            <Input
                                className="min-h-11"
                                type="datetime-local"
                                required
                                {...register('startsAt')}
                            />
                        </label>
                        <label className="flex min-w-0 flex-col gap-2">
                            운영 종료 (KST)
                            <Input
                                className="min-h-11"
                                type="datetime-local"
                                required
                                {...register('endsAt')}
                            />
                        </label>
                        {fields.map((field, i) => {
                            const type = values.questions?.[i]?.questionType;
                            const choice = type === 'SINGLE_CHOICE' || type === 'OX';
                            return (
                                <fieldset
                                    key={field.id}
                                    className="border-border-default flex min-w-0 flex-col gap-3 rounded-lg border p-3"
                                >
                                    <legend>{i + 1}번 문항</legend>
                                    <label className="flex flex-col gap-2">
                                        {i + 1}번 문항 내용
                                        <Input
                                            required
                                            {...register(`questions.${i}.questionText`)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        {i + 1}번 문항 유형
                                        <select
                                            className="border-border-default bg-surface-elevated min-h-11 rounded-md border p-2"
                                            {...register(`questions.${i}.questionType`)}
                                        >
                                            <option value="SINGLE_CHOICE">단일 선택</option>
                                            {quiz ? (
                                                <>
                                                    <option value="OX">OX</option>
                                                    <option value="SHORT_ANSWER">단답</option>
                                                </>
                                            ) : (
                                                <option value="FREE_TEXT">자유 서술</option>
                                            )}
                                        </select>
                                    </label>
                                    {!quiz && (
                                        <label className="flex min-h-11 items-center gap-2">
                                            <input
                                                type="checkbox"
                                                {...register(`questions.${i}.required`)}
                                            />
                                            필수 답변
                                        </label>
                                    )}
                                    {choice ? (
                                        <>
                                            <label className="flex flex-col gap-2">
                                                {i + 1}번 선택지 (한 줄에 하나, 2개 이상)
                                                <Textarea
                                                    required
                                                    {...register(`questions.${i}.optionsText`)}
                                                />
                                            </label>
                                            {quiz && (
                                                <label className="flex flex-col gap-2">
                                                    {i + 1}번 정답 선택지 번호
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        required
                                                        {...register(
                                                            `questions.${i}.correctOption`,
                                                            { valueAsNumber: true },
                                                        )}
                                                    />
                                                </label>
                                            )}
                                        </>
                                    ) : (
                                        quiz && (
                                            <label className="flex flex-col gap-2">
                                                {i + 1}번 정답
                                                <Input
                                                    required
                                                    {...register(`questions.${i}.correctAnswer`)}
                                                />
                                            </label>
                                        )
                                    )}
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={fields.length <= 1}
                                        onClick={() => remove(i)}
                                    >
                                        {i + 1}번 문항 삭제
                                    </Button>
                                </fieldset>
                            );
                        })}
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => append({ ...emptyQuestion })}
                        >
                            문항 추가
                        </Button>
                        <Button className="min-h-11" type="submit">
                            {mutation.isPending ? '등록 중…' : '등록'}
                        </Button>
                    </fieldset>
                    {error && <p role="alert">{error}</p>}
                </form>
            </DialogContent>
        </Dialog>
    );
}
