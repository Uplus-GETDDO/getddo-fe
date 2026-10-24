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

import { FIELD_ERROR, FIELD_LABEL } from '../model/formStyles';

interface EventPrizesSectionProps {
    register: UseFormRegister<EventFormInput>;
    control: Control<EventFormInput, undefined, EventFormValues>;
    errors: FieldErrors<EventFormInput>;
    fields: FieldArrayWithId<EventFormInput, 'prizes', 'fieldKey'>[];
    append: UseFieldArrayAppend<EventFormInput, 'prizes'>;
    remove: UseFieldArrayRemove;
    event?: AdminEvent;
}

export function EventPrizesSection({
    register,
    control,
    errors,
    fields,
    append,
    remove,
    event,
}: EventPrizesSectionProps) {
    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6">
            <div className="flex items-center justify-between">
                <h3 className={FIELD_LABEL}>경품 ({fields.length}종)</h3>
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
            </div>
            <p className="text-caption text-fg-tertiary">
                등수마다 한 종류의 경품만 등록할 수 있습니다.
            </p>

            {fields.map((field, index) => (
                <div
                    key={field.fieldKey}
                    className="border-border-default flex flex-col gap-3 rounded-xl border p-4"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-body-bold text-fg-primary">경품 {index + 1}</span>
                        {fields.length > 1 && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => remove(index)}
                            >
                                제거
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex w-24 flex-col gap-1">
                            <label
                                htmlFor={`prize-${field.fieldKey}-rank`}
                                className="text-caption text-fg-tertiary"
                            >
                                등수
                            </label>
                            <Input
                                id={`prize-${field.fieldKey}-rank`}
                                type="number"
                                min={1}
                                aria-invalid={Boolean(errors.prizes?.[index]?.rank)}
                                aria-describedby={
                                    errors.prizes?.[index]?.rank
                                        ? `prize-${field.fieldKey}-rank-error`
                                        : undefined
                                }
                                {...register(`prizes.${index}.rank`)}
                            />
                            {errors.prizes?.[index]?.rank && (
                                <p
                                    id={`prize-${field.fieldKey}-rank-error`}
                                    className={FIELD_ERROR}
                                >
                                    {errors.prizes[index]?.rank?.message}
                                </p>
                            )}
                        </div>
                        <div className="flex min-w-48 flex-1 flex-col gap-1">
                            <label
                                htmlFor={`prize-${field.fieldKey}-name`}
                                className="text-caption text-fg-tertiary"
                            >
                                경품명
                            </label>
                            <Input
                                id={`prize-${field.fieldKey}-name`}
                                aria-invalid={Boolean(errors.prizes?.[index]?.name)}
                                aria-describedby={
                                    errors.prizes?.[index]?.name
                                        ? `prize-${field.fieldKey}-name-error`
                                        : undefined
                                }
                                {...register(`prizes.${index}.name`)}
                            />
                            {errors.prizes?.[index]?.name && (
                                <p
                                    id={`prize-${field.fieldKey}-name-error`}
                                    className={FIELD_ERROR}
                                >
                                    {errors.prizes[index]?.name?.message}
                                </p>
                            )}
                        </div>
                        <div className="flex w-28 flex-col gap-1">
                            <label
                                htmlFor={`prize-${field.fieldKey}-winner-count`}
                                className="text-caption text-fg-tertiary"
                            >
                                당첨 인원
                            </label>
                            <Input
                                id={`prize-${field.fieldKey}-winner-count`}
                                type="number"
                                min={1}
                                aria-invalid={Boolean(errors.prizes?.[index]?.winnerCount)}
                                aria-describedby={
                                    errors.prizes?.[index]?.winnerCount
                                        ? `prize-${field.fieldKey}-winner-count-error`
                                        : undefined
                                }
                                {...register(`prizes.${index}.winnerCount`)}
                            />
                            {errors.prizes?.[index]?.winnerCount && (
                                <p
                                    id={`prize-${field.fieldKey}-winner-count-error`}
                                    className={FIELD_ERROR}
                                >
                                    {errors.prizes[index]?.winnerCount?.message}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex min-w-48 flex-1 flex-col gap-1">
                            <label
                                htmlFor={`prize-${field.fieldKey}-description`}
                                className="text-caption text-fg-tertiary"
                            >
                                설명 (선택)
                            </label>
                            <Input
                                id={`prize-${field.fieldKey}-description`}
                                {...register(`prizes.${index}.description`)}
                            />
                        </div>
                        <div className="flex min-w-48 flex-1 flex-col gap-1">
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
                                            event?.prizes.find((prize) => prize.id === field.id)
                                                ?.imageUrl
                                        }
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>
            ))}
            {errors.prizes?.root && <p className={FIELD_ERROR}>{errors.prizes.root.message}</p>}
            {typeof errors.prizes?.message === 'string' && (
                <p className={FIELD_ERROR}>{errors.prizes.message}</p>
            )}
        </section>
    );
}
