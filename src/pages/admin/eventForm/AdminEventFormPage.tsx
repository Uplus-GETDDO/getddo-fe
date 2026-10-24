import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { AdminEvent } from '@entities/event';

import { EVENT_TYPE_LABEL, MEMBERSHIP_LABEL, useAdminEvent } from '@entities/event';
import { ImageUploadField } from '@entities/image';
import { useCreateEvent, useUpdateEvent } from '@features/manageEvent';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { utcIsoToKstInput } from '@shared/utils/date';

import type { EventFormInput, EventFormValues } from './utils/eventFormValues';

import { eventFormSchema, eventFormToRequest, eventToFormValues } from './utils/eventFormValues';

const FIELD_LABEL = 'text-body-bold text-fg-primary';
const FIELD_ERROR = 'text-semantic-error-strong text-caption';
const INPUT_LIKE =
    'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-3 disabled:opacity-50';

const MEMBERSHIP_OPTIONS = (
    Object.entries(MEMBERSHIP_LABEL) as [EventFormValues['membershipRule'], string][]
).map(([value, label]) => ({ value, label: `${label} 이상` }));

/** 새 이벤트의 빈 양식 */
const NEW_EVENT_VALUES: EventFormInput = {
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
};

/**
 * 이벤트 등록·수정 양식.
 *
 * 수정은 상세가 도착한 뒤에만 이 컴포넌트를 세우고(AdminEventFormPage의 가드), 저장된 값을
 * defaultValues로 받는다 — 첫 렌더부터 제 값을 들고 시작해야 한다.
 *
 * 전에는 values로 넘겼다. RHF는 values를 마운트 뒤 effect에서 반영하므로 첫 렌더는 빈 양식으로
 * 그려지고, 그 뒤 값이 바뀐다. 그 시점에 Select는 아직 목록을 펼친 적이 없어 새 값의 라벨을
 * 찾지 못해 빈칸이 되고 폼 값까지 ''로 떨어졌다 — 저장된 값이 빈 양식의 값과 다른 이벤트
 * (응모권 미사용·VIP·VVIP)는 수정 자체가 불가능했다 (2026-10-24 배포본에서 재현).
 */
function EventFormBody({ event, eventId }: { event?: AdminEvent; eventId?: string }) {
    const isEdit = Boolean(eventId);
    const navigate = useNavigate();
    const createEvent = useCreateEvent();
    const updateEvent = useUpdateEvent();
    const mutation = isEdit ? updateEvent : createEvent;

    const {
        register,
        control,
        handleSubmit,
        formState: { errors, isDirty },
    } = useForm<EventFormInput, undefined, EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: event ? eventToFormValues(event) : NEW_EVENT_VALUES,
    });

    // 경품 데이터의 id(수정 시 기존 경품 식별)와 RHF 내부 키가 겹치지 않게 keyName을 바꾼다
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'prizes',
        keyName: 'fieldKey',
    });
    const eventType = useWatch({ control, name: 'eventType' });
    const weightingEnabled = useWatch({ control, name: 'weightingEnabled' });
    const showTicketOptions = eventType === 'TICKET';

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
        void handleSubmit((values) => {
            const body = eventFormToRequest(values);
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

    return (
        <form onSubmit={submit} className="flex max-w-200 flex-col gap-6 pr-10 pb-10">
            <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={leaveForm}>
                    ← 뒤로
                </Button>
                <h2 className="text-title-3 text-fg-primary">
                    {isEdit ? '이벤트 수정' : '새 이벤트 등록'}
                </h2>
            </div>

            <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6">
                <h3 className={FIELD_LABEL}>기본 정보</h3>

                <div className="flex flex-col gap-2">
                    <label htmlFor="event-title" className={FIELD_LABEL}>
                        이벤트 이름
                    </label>
                    <Input
                        id="event-title"
                        aria-invalid={Boolean(errors.title)}
                        aria-describedby={errors.title ? 'event-title-error' : undefined}
                        {...register('title')}
                    />
                    {errors.title && (
                        <p id="event-title-error" className={FIELD_ERROR}>
                            {errors.title.message}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="event-description" className={FIELD_LABEL}>
                        설명
                    </label>
                    <textarea
                        id="event-description"
                        rows={3}
                        className={INPUT_LIKE}
                        aria-invalid={Boolean(errors.description)}
                        aria-describedby={
                            errors.description ? 'event-description-error' : undefined
                        }
                        {...register('description')}
                    />
                    {errors.description && (
                        <p id="event-description-error" className={FIELD_ERROR}>
                            {errors.description.message}
                        </p>
                    )}
                </div>

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
                        />
                    )}
                />
            </section>

            <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6">
                <h3 className={FIELD_LABEL}>응모 조건</h3>

                <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-2">
                        <label className={FIELD_LABEL}>이벤트 유형</label>
                        <Controller
                            control={control}
                            name="eventType"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger
                                        ref={field.ref}
                                        onBlur={field.onBlur}
                                        className="w-40"
                                        aria-label="이벤트 유형"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className={FIELD_LABEL}>최소 멤버십 등급</label>
                        <Controller
                            control={control}
                            name="membershipRule"
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger
                                        ref={field.ref}
                                        onBlur={field.onBlur}
                                        className="w-36"
                                        aria-label="최소 멤버십 등급"
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
                    </div>
                </div>

                {showTicketOptions && (
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex items-center gap-2">
                            <input
                                id="event-weighting"
                                type="checkbox"
                                className="size-4"
                                {...register('weightingEnabled')}
                            />
                            <label
                                htmlFor="event-weighting"
                                className="text-body-sm text-fg-primary"
                            >
                                가중치 응모 사용
                            </label>
                        </div>
                        {weightingEnabled && (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="event-max-tickets" className={FIELD_LABEL}>
                                    1인 최대 응모권
                                </label>
                                <Input
                                    id="event-max-tickets"
                                    type="number"
                                    min={1}
                                    max={5}
                                    className="w-36"
                                    placeholder="비우면 상한 없음"
                                    aria-invalid={Boolean(errors.maxTicketsPerUser)}
                                    aria-describedby={
                                        errors.maxTicketsPerUser
                                            ? 'event-max-tickets-error'
                                            : undefined
                                    }
                                    {...register('maxTicketsPerUser')}
                                />
                                {errors.maxTicketsPerUser && (
                                    <p id="event-max-tickets-error" className={FIELD_ERROR}>
                                        {errors.maxTicketsPerUser.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="event-starts-at" className={FIELD_LABEL}>
                            응모 시작 (KST)
                        </label>
                        <Input
                            id="event-starts-at"
                            type="datetime-local"
                            className="w-56"
                            // spec: 등록된 이벤트의 시작 시각은 현재 설정보다 앞당길 수 없다
                            min={isEdit && event ? utcIsoToKstInput(event.startsAt) : undefined}
                            aria-invalid={Boolean(errors.startsAt)}
                            aria-describedby={errors.startsAt ? 'event-starts-at-error' : undefined}
                            {...register('startsAt')}
                        />
                        {errors.startsAt && (
                            <p id="event-starts-at-error" className={FIELD_ERROR}>
                                {errors.startsAt.message}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="event-ends-at" className={FIELD_LABEL}>
                            응모 마감 (KST)
                        </label>
                        <Input
                            id="event-ends-at"
                            type="datetime-local"
                            className="w-56"
                            aria-invalid={Boolean(errors.endsAt)}
                            aria-describedby={errors.endsAt ? 'event-ends-at-error' : undefined}
                            {...register('endsAt')}
                        />
                        {errors.endsAt && (
                            <p id="event-ends-at-error" className={FIELD_ERROR}>
                                {errors.endsAt.message}
                            </p>
                        )}
                    </div>
                </div>
            </section>

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

            {mutation.isError && (
                <p className={cn(FIELD_ERROR, 'text-body-sm')}>
                    {getErrorMessage(
                        mutation.error,
                        '저장에 실패했습니다. 입력값과 이벤트 상태를 확인한 뒤 다시 시도해주세요.',
                    )}
                </p>
            )}

            <div className="flex gap-4">
                <Button
                    type="button"
                    variant="secondary"
                    className="h-10 flex-1"
                    onClick={leaveForm}
                >
                    취소
                </Button>
                <Button type="submit" className="h-10 flex-1" disabled={mutation.isPending}>
                    {mutation.isPending ? '저장 중…' : isEdit ? '수정 저장' : '이벤트 등록'}
                </Button>
            </div>
        </form>
    );
}

/**
 * 등록·수정 화면의 껍데기 — 수정은 상세를 받아 둔 뒤에만 양식을 세운다.
 *
 * key에 이벤트 id를 걸어, 다른 이벤트의 수정 주소로 바로 옮겨 가도 양식이 새로 만들어진다.
 */
export function AdminEventFormPage() {
    const { eventId } = useParams();
    const isEdit = Boolean(eventId);
    const { data: event, isPending, isError } = useAdminEvent(eventId ?? '');

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

    return <EventFormBody key={eventId ?? 'new'} event={event} eventId={eventId} />;
}
