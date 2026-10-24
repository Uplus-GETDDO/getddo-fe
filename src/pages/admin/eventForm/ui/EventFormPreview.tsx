import type { DeepPartial } from 'react-hook-form';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { useImageFallback } from '@shared/hooks/useImageFallback';
import { Badge } from '@shared/ui/badge';
import { formatKstDot, kstInputToUtcIso } from '@shared/utils/date';

import type { EventFormInput } from '../utils/eventFormValues';

// datetime-local 값(KST)을 화면 표기로 — 비었거나 덜 쓴 값은 자리 글자로 둔다
function formatInput(local: string | undefined) {
    if (!local) return '—';
    const iso = kstInputToUtcIso(local);
    return Number.isNaN(Date.parse(iso)) ? '—' : formatKstDot(iso, true);
}

// 경품 숫자 칸은 입력 중 문자열·숫자가 섞여 들어온다 — 1 이상의 정수일 때만 보여 준다
function positive(value: unknown) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * 입력하는 대로 사용자에게 어떻게 보일지 대강 그려 준다 — 실제 카드와 똑같이 맞추지는 않고,
 * 빠뜨린 칸(이름·설명·경품)이 한눈에 보이게 비어 있으면 회색 자리 글자를 둔다
 */
export function EventFormPreview({
    values,
    imageUrl,
}: {
    values: DeepPartial<EventFormInput>;
    imageUrl: string | null | undefined;
}) {
    const image = useImageFallback(imageUrl);
    const isTicket = values.eventType === 'TICKET';
    const prizes = (values.prizes ?? []).filter((prize) => prize !== undefined);

    return (
        <div className="flex flex-col gap-3">
            <p className="text-body-sm-bold text-fg-secondary">사용자 화면 미리보기</p>
            <div className="bg-surface-page border-border-default flex flex-col overflow-hidden rounded-2xl border">
                <div className="bg-surface-sunken text-caption text-fg-tertiary flex aspect-video items-center justify-center">
                    {image.shown ? (
                        <img
                            src={imageUrl!}
                            alt=""
                            onError={image.onError}
                            className="size-full object-cover"
                        />
                    ) : (
                        '대표 이미지'
                    )}
                </div>
                <div className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap gap-1.5">
                        <Badge variant={isTicket ? 'highlight' : 'neutral'}>
                            {isTicket ? '겟또타임' : '일반 이벤트'}
                        </Badge>
                        {values.membershipRule && (
                            <Badge variant="outline">
                                {MEMBERSHIP_LABEL[values.membershipRule]} 이상
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <p
                            className={
                                values.title?.trim()
                                    ? 'text-body-bold text-fg-primary'
                                    : 'text-body-bold text-fg-disabled'
                            }
                        >
                            {values.title?.trim() || '이벤트 이름'}
                        </p>
                        <p
                            className={
                                values.description?.trim()
                                    ? 'text-body-sm text-fg-secondary line-clamp-3 whitespace-pre-wrap'
                                    : 'text-body-sm text-fg-disabled'
                            }
                        >
                            {values.description?.trim() || '설명'}
                        </p>
                    </div>
                    <dl className="text-caption grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                        <dt className="text-fg-tertiary">응모 기간</dt>
                        <dd className="text-fg-primary">
                            {formatInput(values.startsAt)} ~ {formatInput(values.endsAt)}
                        </dd>
                        <dt className="text-fg-tertiary">응모 방식</dt>
                        <dd className="text-fg-primary">
                            {!isTicket
                                ? '응모권 없이 응모'
                                : !values.weightingEnabled
                                  ? '응모권 1장'
                                  : values.maxTicketsPerUser?.trim()
                                    ? `응모권 최대 ${values.maxTicketsPerUser.trim()}장`
                                    : '응모권 장수 제한 없음'}
                        </dd>
                    </dl>
                    <div className="border-border-default flex flex-col gap-1.5 border-t pt-3">
                        <p className="text-caption text-fg-tertiary">경품</p>
                        {prizes.length === 0 ? (
                            <p className="text-body-sm text-fg-disabled">경품을 추가해 주세요</p>
                        ) : (
                            <ul className="flex flex-col gap-1">
                                {prizes.map((prize, index) => (
                                    <li
                                        key={index}
                                        className="text-body-sm text-fg-primary flex gap-2"
                                    >
                                        <span className="text-fg-tertiary w-8 shrink-0 tabular-nums">
                                            {positive(prize.rank)
                                                ? `${positive(prize.rank)}등`
                                                : '—'}
                                        </span>
                                        <span
                                            className={
                                                prize.name?.trim()
                                                    ? 'min-w-0 flex-1 truncate'
                                                    : 'text-fg-disabled min-w-0 flex-1'
                                            }
                                        >
                                            {prize.name?.trim() || '경품명'}
                                        </span>
                                        <span className="text-fg-secondary shrink-0 tabular-nums">
                                            {positive(prize.winnerCount)
                                                ? `${positive(prize.winnerCount)}명`
                                                : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
            <p className="text-caption text-fg-tertiary">
                실제 화면과 배치가 조금 다를 수 있어요. 이미지는 1:1 칸에서 가장자리가 잘려요.
            </p>
        </div>
    );
}
