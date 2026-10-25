import type {
    Control,
    FieldArrayWithId,
    FieldErrors,
    UseFieldArrayAppend,
    UseFieldArrayRemove,
    UseFormRegister,
} from 'react-hook-form';

import { Controller } from 'react-hook-form';

import type { AdminEvent } from '@entities/event';

import { ImageUploadField } from '@entities/image';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

import type { EventFormInput, EventFormValues } from '../utils/eventFormValues';

import { FIELD_ERROR } from '../model/formStyles';
import { FormField, FormStep } from './FormField';

interface EventPrizesSectionProps {
    step: number;
    register: UseFormRegister<EventFormInput>;
    control: Control<EventFormInput, undefined, EventFormValues>;
    errors: FieldErrors<EventFormInput>;
    fields: FieldArrayWithId<EventFormInput, 'prizes', 'fieldKey'>[];
    append: UseFieldArrayAppend<EventFormInput, 'prizes'>;
    remove: UseFieldArrayRemove;
    event?: AdminEvent;
}

export function EventPrizesSection({
    step,
    register,
    control,
    errors,
    fields,
    append,
    remove,
    event,
}: EventPrizesSectionProps) {
    const prizeError = (index: number) => errors.prizes?.[index];

    return (
        <FormStep
            step={step}
            title={`경품 (${fields.length}종)`}
            description="등수마다 한 종류의 경품만 등록할 수 있어요. 최소 1개가 필요해요."
            action={
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                        append({
                            rank: fields.length + 1,
                            name: '',
                            winnerCount: 1,
                            description: '',
                            imageKey: '',
                        })
                    }
                >
                    경품 추가
                </Button>
            }
        >
            {fields.map((field, index) => (
                <div
                    key={field.fieldKey}
                    className="border-border-default flex flex-col gap-4 rounded-xl border p-4"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-body-bold text-fg-primary">경품 {index + 1}</span>
                        {fields.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                            >
                                제거
                            </Button>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)_7rem]">
                        <FormField
                            id={`prize-${field.fieldKey}-rank`}
                            label="등수"
                            required
                            error={prizeError(index)?.rank?.message}
                        >
                            <Input
                                id={`prize-${field.fieldKey}-rank`}
                                type="number"
                                min={1}
                                aria-required
                                aria-invalid={Boolean(prizeError(index)?.rank)}
                                aria-describedby={
                                    prizeError(index)?.rank
                                        ? `prize-${field.fieldKey}-rank-error`
                                        : undefined
                                }
                                {...register(`prizes.${index}.rank`)}
                            />
                        </FormField>
                        <FormField
                            id={`prize-${field.fieldKey}-name`}
                            label="경품명"
                            required
                            error={prizeError(index)?.name?.message}
                        >
                            <Input
                                id={`prize-${field.fieldKey}-name`}
                                placeholder="예) 스타벅스 아메리카노"
                                aria-required
                                aria-invalid={Boolean(prizeError(index)?.name)}
                                aria-describedby={
                                    prizeError(index)?.name
                                        ? `prize-${field.fieldKey}-name-error`
                                        : undefined
                                }
                                {...register(`prizes.${index}.name`)}
                            />
                        </FormField>
                        <FormField
                            id={`prize-${field.fieldKey}-winner-count`}
                            label="당첨 인원"
                            required
                            error={prizeError(index)?.winnerCount?.message}
                        >
                            <Input
                                id={`prize-${field.fieldKey}-winner-count`}
                                type="number"
                                min={1}
                                aria-required
                                aria-invalid={Boolean(prizeError(index)?.winnerCount)}
                                aria-describedby={
                                    prizeError(index)?.winnerCount
                                        ? `prize-${field.fieldKey}-winner-count-error`
                                        : undefined
                                }
                                {...register(`prizes.${index}.winnerCount`)}
                            />
                        </FormField>
                    </div>
                    <FormField id={`prize-${field.fieldKey}-description`} label="설명 (선택)">
                        <Input
                            id={`prize-${field.fieldKey}-description`}
                            {...register(`prizes.${index}.description`)}
                        />
                    </FormField>
                    <Controller
                        control={control}
                        name={`prizes.${index}.imageKey`}
                        render={({ field: imageField }) => (
                            <ImageUploadField
                                label="경품 이미지 (선택)"
                                slot="PRIZE"
                                value={imageField.value ?? ''}
                                onChange={imageField.onChange}
                                initialPreviewUrl={
                                    event?.prizes.find((prize) => prize.id === field.id)?.imageUrl
                                }
                            />
                        )}
                    />
                </div>
            ))}
            {errors.prizes?.root && <p className={FIELD_ERROR}>{errors.prizes.root.message}</p>}
            {typeof errors.prizes?.message === 'string' && (
                <p className={FIELD_ERROR}>{errors.prizes.message}</p>
            )}
        </FormStep>
    );
}
