import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { MEMBERSHIP_LABEL, useAdminEvent } from '@entities/event';
import { ImageUploadField } from '@entities/image';
import { useCreateEvent, useUpdateEvent } from '@features/manageEvent';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { Textarea } from '@shared/ui/textarea';
import { utcIsoToKstInput } from '@shared/utils/date';

import type { EventFormInput, EventFormValues } from './utils/eventFormValues';

import { EventFormPreview } from './ui/EventFormPreview';
import { FormField, FormStep } from './ui/FormField';
import { eventFormSchema, eventFormToRequest, eventToFormValues } from './utils/eventFormValues';

const FIELD_ERROR = 'text-semantic-error-strong text-caption';

const MEMBERSHIP_OPTIONS = (
    Object.entries(MEMBERSHIP_LABEL) as [EventFormValues['membershipRule'], string][]
).map(([value, label]) => ({ value, label: `${label} 이상` }));

// 처음 등록하는 관리자도 고를 수 있게 계약 값(TICKET/NO_TICKET) 대신 서비스 이름과 응모 방식으로 설명한다 (spec event.md 화면 분류)
const EVENT_KIND_OPTIONS = [
    {
        value: 'TICKET',
        title: '겟또타임',
        description: '응모권을 써서 응모해요. 가중치와 1인 최대 장수를 정할 수 있어요.',
    },
    {
        value: 'NO_TICKET',
        title: '일반 이벤트',
        description: '응모권 없이 버튼 한 번으로 응모해요.',
    },
] as const;

const WEIGHTING_OPTIONS = [
    { value: 'true', title: '가중치 적용', description: '여러 장을 걸수록 당첨 확률이 올라가요' },
    { value: 'false', title: '1장 고정', description: '누구나 1장씩만 응모해요' },
] as const;

/** 고르는 카드 — 라디오 하나와 제목·설명. 고른 카드는 테두리를 잉크로 진하게 한다 */
const CHOICE_CARD =
    'border-border-default hover:border-border-strong has-[[data-state=checked]]:border-fg-primary has-[[data-state=checked]]:bg-surface-canvas flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors';

export function AdminEventFormPage() {
    const { eventId } = useParams();
    const isEdit = Boolean(eventId);
    const navigate = useNavigate();
    const { data: event, isPending, isError } = useAdminEvent(eventId ?? '');
    const createEvent = useCreateEvent();
    const updateEvent = useUpdateEvent();
    const mutation = isEdit ? updateEvent : createEvent;
    // 방금 올린 대표 이미지 주소 — 폼 값은 키라 미리보기에 그릴 주소를 따로 받는다
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors, isDirty },
    } = useForm<EventFormInput, undefined, EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        values: event ? eventToFormValues(event) : undefined,
        defaultValues: {
            title: '',
            description: '',
            imageKey: '',
            eventType: 'TICKET',
            weightingEnabled: true,
            maxTicketsPerUser: '5',
            membershipRule: 'excellent',
            startsAt: '',
            endsAt: '',
            prizes: [{ rank: 1, name: '', winnerCount: 1, description: '', imageKey: '' }],
        },
    });

    // 경품 데이터의 id(수정 시 기존 경품 식별)와 RHF 내부 키가 겹치지 않게 keyName을 바꾼다
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'prizes',
        keyName: 'fieldKey',
    });
    const values = useWatch({ control });
    const showTicketOptions = values.eventType === 'TICKET';

    if (isEdit && isPending) {
        return (
            <LoadingBlock className="pb-10">
                <CardSkeleton rows={8} />
            </LoadingBlock>
        );
    }
    if (isEdit && (isError || !event)) {
        return (
            <div className="flex flex-col gap-4 pb-10">
                <p className="text-semantic-error-strong text-body-sm">
                    이벤트를 불러오지 못했습니다.
                </p>
                <Button variant="secondary" className="w-fit" asChild>
                    <Link to="/admin/events">목록으로</Link>
                </Button>
            </div>
        );
    }
    // 수정은 진행 예정만 허용 — URL 직접 진입도 서버 검증 전에 가드한다
    if (isEdit && event && event.status !== 'SCHEDULED') {
        return (
            <div className="flex flex-col gap-4 pb-10">
                <p className="text-body-sm text-fg-secondary">
                    진행 예정 상태의 이벤트만 수정할 수 있습니다.
                </p>
                <Button variant="secondary" className="w-fit" asChild>
                    <Link to={`/admin/events/${eventId}`}>이벤트로 돌아가기</Link>
                </Button>
            </div>
        );
    }

    // 취소·뒤로의 목적지를 명시한다 — 직접 진입 시 navigate(-1)의 행선지가 불명확하다
    const cancelTo = isEdit ? `/admin/events/${eventId}` : '/admin/events';
    const leaveForm = () => {
        if (
            isDirty &&
            !window.confirm('저장하지 않은 입력이 사라집니다. 페이지를 나가시겠습니까?')
        ) {
            return;
        }
        void navigate(cancelTo);
    };

    const submit = (e: React.FormEvent) => {
        void handleSubmit((formValues) => {
            const body = eventFormToRequest(formValues);
            const onSuccess = () => {
                toast.success(isEdit ? '이벤트를 수정했습니다' : '이벤트를 등록했습니다');
                void navigate('/admin/events');
            };
            if (isEdit && eventId) {
                updateEvent.mutate({ eventId, body }, { onSuccess });
            } else {
                createEvent.mutate(body, { onSuccess });
            }
        })(e);
    };

    const prizeError = (index: number) => errors.prizes?.[index];

    return (
        <form onSubmit={submit} className="flex flex-col gap-6 pr-10">
            {/* 머리 — 돌아가기는 글자 버튼 하나, 제목과 한 줄 안내. 필수 표시의 뜻을 처음에 알려 준다 */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <Button
                        type="button"
                        variant="link"
                        size="text"
                        className="w-fit"
                        onClick={leaveForm}
                    >
                        {isEdit ? '이벤트 상세로' : '이벤트 목록으로'}
                    </Button>
                    <h2 className="text-title-2 text-fg-primary">
                        {isEdit ? '이벤트 수정' : '새 이벤트 등록'}
                    </h2>
                    <p className="text-body-sm text-fg-secondary">
                        종류를 고른 뒤 위에서부터 차례로 채우면 오른쪽에서 사용자 화면을 미리 볼 수
                        있어요.
                    </p>
                </div>
                <p className="text-caption text-fg-tertiary">
                    <span aria-hidden className="text-semantic-error-strong">
                        *
                    </span>{' '}
                    표시는 필수 입력
                </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                    <FormStep
                        step={1}
                        title="이벤트 종류"
                        description="응모권을 쓰는지에 따라 사용자 화면과 응모 방식이 달라져요."
                    >
                        <Controller
                            control={control}
                            name="eventType"
                            render={({ field }) => (
                                <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    aria-label="이벤트 종류"
                                    aria-required
                                    className="grid gap-3 sm:grid-cols-2"
                                >
                                    {EVENT_KIND_OPTIONS.map((option) => (
                                        <label key={option.value} className={CHOICE_CARD}>
                                            <RadioGroupItem
                                                value={option.value}
                                                className="mt-0.5"
                                            />
                                            <span className="flex flex-col gap-1">
                                                <span className="text-body-bold text-fg-primary">
                                                    {option.title}
                                                </span>
                                                <span className="text-body-sm text-fg-secondary">
                                                    {option.description}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </RadioGroup>
                            )}
                        />
                    </FormStep>

                    <FormStep step={2} title="기본 정보" description="사용자에게 그대로 보여요.">
                        <FormField
                            id="event-title"
                            label="이벤트 이름"
                            required
                            error={errors.title?.message}
                        >
                            <Input
                                id="event-title"
                                placeholder="예) 멤버십 VIP콕 더블 혜택"
                                aria-required
                                aria-invalid={Boolean(errors.title)}
                                aria-describedby={errors.title ? 'event-title-error' : undefined}
                                {...register('title')}
                            />
                        </FormField>

                        <FormField
                            id="event-description"
                            label="설명"
                            required
                            error={errors.description?.message}
                        >
                            <Textarea
                                id="event-description"
                                rows={4}
                                placeholder="이벤트 내용과 참여 방법을 적어 주세요."
                                aria-required
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={
                                    errors.description ? 'event-description-error' : undefined
                                }
                                {...register('description')}
                            />
                        </FormField>

                        {/* AE03 imageKey(선택) — 파일을 올려 받은 키를 그대로 싣는다 */}
                        <Controller
                            control={control}
                            name="imageKey"
                            render={({ field }) => (
                                <ImageUploadField
                                    label="대표 이미지 (선택)"
                                    slot="EVENT"
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    initialPreviewUrl={event?.imageUrl}
                                    onPreviewUrlChange={setUploadedImageUrl}
                                />
                            )}
                        />
                    </FormStep>

                    <FormStep
                        step={3}
                        title="응모 조건"
                        description="누가, 언제, 어떻게 응모할 수 있는지 정해요."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField id="event-membership" label="최소 멤버십 등급" required>
                                <Controller
                                    control={control}
                                    name="membershipRule"
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger
                                                id="event-membership"
                                                ref={field.ref}
                                                onBlur={field.onBlur}
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MEMBERSHIP_OPTIONS.map(({ value, label }) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </FormField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                id="event-starts-at"
                                label="응모 시작 (KST)"
                                required
                                error={errors.startsAt?.message}
                            >
                                <Input
                                    id="event-starts-at"
                                    type="datetime-local"
                                    // spec: 등록된 이벤트의 시작 시각은 현재 설정보다 앞당길 수 없다
                                    min={
                                        isEdit && event
                                            ? utcIsoToKstInput(event.startsAt)
                                            : undefined
                                    }
                                    aria-required
                                    aria-invalid={Boolean(errors.startsAt)}
                                    aria-describedby={
                                        errors.startsAt ? 'event-starts-at-error' : undefined
                                    }
                                    {...register('startsAt')}
                                />
                            </FormField>
                            <FormField
                                id="event-ends-at"
                                label="응모 마감 (KST)"
                                required
                                hint="마감 뒤 자동으로 추첨해요."
                                error={errors.endsAt?.message}
                            >
                                <Input
                                    id="event-ends-at"
                                    type="datetime-local"
                                    aria-required
                                    aria-invalid={Boolean(errors.endsAt)}
                                    aria-describedby={
                                        errors.endsAt ? 'event-ends-at-error' : 'event-ends-at-hint'
                                    }
                                    {...register('endsAt')}
                                />
                            </FormField>
                        </div>

                        {/* 응모권 쓰는 방식은 겟또타임에만 있다 — 일반 이벤트에서는 칸 자체를 감춘다 */}
                        {showTicketOptions && (
                            <div className="border-border-default flex flex-col gap-4 border-t pt-4">
                                <div className="flex flex-col gap-2">
                                    <p className="text-body-sm-bold text-fg-primary">
                                        응모권 쓰는 방식
                                        <span
                                            aria-hidden
                                            className="text-semantic-error-strong ml-0.5"
                                        >
                                            *
                                        </span>
                                    </p>
                                    <Controller
                                        control={control}
                                        name="weightingEnabled"
                                        render={({ field }) => (
                                            <RadioGroup
                                                value={String(field.value)}
                                                onValueChange={(v) => field.onChange(v === 'true')}
                                                aria-label="응모권 쓰는 방식"
                                                className="grid gap-3 sm:grid-cols-2"
                                            >
                                                {WEIGHTING_OPTIONS.map((option) => (
                                                    <label
                                                        key={option.value}
                                                        className={CHOICE_CARD}
                                                    >
                                                        <RadioGroupItem
                                                            value={option.value}
                                                            className="mt-0.5"
                                                        />
                                                        <span className="flex flex-col gap-1">
                                                            <span className="text-body-sm-bold text-fg-primary">
                                                                {option.title}
                                                            </span>
                                                            <span className="text-caption text-fg-secondary">
                                                                {option.description}
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </RadioGroup>
                                        )}
                                    />
                                </div>
                                {values.weightingEnabled && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField
                                            id="event-max-tickets"
                                            label="1인 최대 응모권"
                                            hint="1~5장, 비우면 상한 없음"
                                            error={errors.maxTicketsPerUser?.message}
                                        >
                                            <Input
                                                id="event-max-tickets"
                                                type="number"
                                                min={1}
                                                max={5}
                                                placeholder="비우면 상한 없음"
                                                aria-invalid={Boolean(errors.maxTicketsPerUser)}
                                                aria-describedby={
                                                    errors.maxTicketsPerUser
                                                        ? 'event-max-tickets-error'
                                                        : 'event-max-tickets-hint'
                                                }
                                                {...register('maxTicketsPerUser')}
                                            />
                                        </FormField>
                                    </div>
                                )}
                            </div>
                        )}
                    </FormStep>

                    <FormStep
                        step={4}
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
                                    <span className="text-body-bold text-fg-primary">
                                        경품 {index + 1}
                                    </span>
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
                                <FormField
                                    id={`prize-${field.fieldKey}-description`}
                                    label="설명 (선택)"
                                >
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
                                                event?.prizes.find((prize) => prize.id === field.id)
                                                    ?.imageUrl
                                            }
                                        />
                                    )}
                                />
                            </div>
                        ))}
                        {errors.prizes?.root && (
                            <p className={FIELD_ERROR}>{errors.prizes.root.message}</p>
                        )}
                        {typeof errors.prizes?.message === 'string' && (
                            <p className={FIELD_ERROR}>{errors.prizes.message}</p>
                        )}
                    </FormStep>
                </div>

                {/* 넓은 화면에서만 오른쪽에 붙어 따라온다 — 좁으면 폼 아래로 내려간다 */}
                <aside aria-label="사용자 화면 미리보기" className="xl:sticky xl:top-6">
                    <EventFormPreview
                        values={values}
                        imageUrl={uploadedImageUrl ?? (values.imageKey ? event?.imageUrl : null)}
                    />
                </aside>
            </div>

            {/* 저장 줄은 화면 아래에 붙여 긴 폼 어디서든 바로 저장할 수 있게 한다 */}
            <div className="bg-surface-canvas border-border-default sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t px-1 py-4">
                {mutation.isError && (
                    <p role="alert" className="text-semantic-error-strong text-body-sm mr-auto">
                        {getErrorMessage(
                            mutation.error,
                            '저장에 실패했습니다. 입력값과 이벤트 상태를 확인한 뒤 다시 시도해주세요.',
                        )}
                    </p>
                )}
                <Button type="button" variant="secondary" className="min-w-28" onClick={leaveForm}>
                    취소
                </Button>
                <Button type="submit" className="min-w-36" disabled={mutation.isPending}>
                    {mutation.isPending ? '저장 중…' : isEdit ? '수정 저장' : '이벤트 등록'}
                </Button>
            </div>
        </form>
    );
}
