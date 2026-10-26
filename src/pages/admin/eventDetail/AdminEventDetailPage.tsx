import { X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { EventActionKind } from '@features/manageEvent';

import {
    ADMIN_STATUS_META,
    EventThumbnail,
    MEMBERSHIP_LABEL,
    useAdminEvent,
} from '@entities/event';
import { EventActionDialog } from '@features/manageEvent';
import { useImageFallback } from '@shared/hooks/useImageFallback';
import { Badge, badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { DetailItem, DetailList, DetailMeta } from '@shared/ui/detail-list';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { cn } from '@shared/utils/cn';
import { formatKst } from '@shared/utils/date';

const KST_YMD_HM: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
};

/** 머리의 핵심 조건 한 칸 — 이름표는 작게, 값은 진하게 */
function FactTile({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-surface-canvas flex flex-col gap-0.5 rounded-lg px-3 py-2.5">
            <dt className="text-caption text-fg-tertiary">{label}</dt>
            <dd className="text-body-sm-bold text-fg-primary">{children}</dd>
        </div>
    );
}

function DangerRow({
    title,
    description,
    onClick,
}: {
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <div className="border-border-default flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body-sm-bold text-fg-primary">{title}</span>
                <span className="text-caption text-fg-secondary">{description}</span>
            </div>
            <Button
                variant="secondary"
                size="sm"
                className="text-semantic-error-strong hover:text-semantic-error-strong"
                onClick={onClick}
            >
                {title}
            </Button>
        </div>
    );
}

// 작은 썸네일로는 올린 사진의 상태를 확인할 수 없다 — 누르면 원본 크기에 가깝게 확대해서 보여 준다
function ZoomableThumbnail({
    src,
    label,
    className,
    onPreview,
}: {
    src: string;
    label: string;
    className: string;
    onPreview: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onPreview}
            aria-label={`${label} 크게 보기`}
            className="cursor-zoom-in"
        >
            <EventThumbnail src={src} className={className} />
        </button>
    );
}

function PreviewImage({ src, label }: { src: string; label: string }) {
    const image = useImageFallback(src);
    if (!image.shown) {
        return (
            <div className="bg-surface-sunken text-body-sm text-fg-tertiary flex h-64 items-center justify-center rounded-lg">
                이미지를 불러오지 못했습니다
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={label}
            onError={image.onError}
            className="mx-auto max-h-[70vh] max-w-full object-contain"
        />
    );
}

export function AdminEventDetailPage() {
    const { eventId = '' } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // 목록 오른쪽 칸에서 열린다 — 닫으면 목록 조건(?status= 등)을 그대로 둔 채 1단으로 돌아간다
    const closeTo = {
        pathname: '/admin/events',
        search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    };
    // 상세를 닫아도 목록 스크롤 자리는 그대로 둔다
    const close = () => void navigate(closeTo, { preventScrollReset: true });
    const { data: event, isPending, isError } = useAdminEvent(eventId);
    const [action, setAction] = useState<EventActionKind | null>(null);
    const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);

    if (isPending) {
        return (
            <LoadingBlock>
                <CardSkeleton rows={8} />
            </LoadingBlock>
        );
    }
    if (isError || !event) {
        return (
            <div className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-5">
                <p className="text-semantic-error-strong text-body-sm">
                    이벤트를 불러오지 못했습니다.
                </p>
                <Button variant="secondary" className="w-fit" onClick={close}>
                    닫기
                </Button>
            </div>
        );
    }

    // spec event.md 운영 규칙 — 수정·삭제는 진행 예정(SCHEDULED)만, 취소는 CANCELED 외 모든 상태에서 허용
    const canEdit = event.status === 'SCHEDULED';
    const canCancel = event.status !== 'CANCELED';
    // 마감 이후 추첨 단계(자동 추첨 진행·확정·발표·재추첨)에서만 추첨 관리 화면으로 연결한다
    const hasDraw =
        event.status === 'CLOSED' ||
        event.status === 'DRAW_CONFIRMED' ||
        event.status === 'PUBLISHED' ||
        event.status === 'REDRAWING';
    const status = ADMIN_STATUS_META[event.status];

    const totalWinners = event.prizes.reduce((sum, prize) => sum + prize.winnerCount, 0);
    const ticketUsage =
        event.eventType === 'NO_TICKET'
            ? '응모권 없이 응모'
            : !event.weightingEnabled
              ? '응모권 1장 고정'
              : event.maxTicketsPerUser === null
                ? '가중치 · 상한 없음'
                : `가중치 · 1인 최대 ${event.maxTicketsPerUser}장`;

    return (
        <div className="flex flex-col gap-4">
            {/*
             * 머리 — 사진·상태·종류·이름·기간을 한눈에, 그 아래 핵심 조건 세 칸과 운영 행동.
             * 좁은 칸에서도 제목이 잘리지 않게 줄을 나눈다
             */}
            <section className="bg-surface-page border-border-default flex flex-col gap-5 rounded-2xl border p-5">
                <div className="flex items-start gap-4">
                    {event.imageUrl && (
                        <button
                            type="button"
                            onClick={() =>
                                setPreview({ src: event.imageUrl!, label: '대표 이미지' })
                            }
                            aria-label="대표 이미지 크게 보기"
                            className="focus-visible:ring-border-focus hidden aspect-video w-36 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:outline-none sm:block"
                        >
                            <EventThumbnail
                                src={event.imageUrl}
                                className="size-full rounded-none"
                            />
                        </button>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap gap-1.5">
                            <span
                                className={cn(badgeVariants({ variant: null }), status.chipClass)}
                            >
                                {status.label}
                            </span>
                            <Badge variant={event.eventType === 'TICKET' ? 'highlight' : 'neutral'}>
                                {event.eventType === 'TICKET' ? '겟또타임' : '일반 이벤트'}
                            </Badge>
                        </div>
                        <h2 className="text-title-3 text-fg-primary break-words">{event.title}</h2>
                        <p className="text-body-sm text-fg-secondary tabular-nums">
                            {formatKst(event.startsAt, KST_YMD_HM)} ~{' '}
                            {formatKst(event.endsAt, KST_YMD_HM)}
                        </p>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-9 shrink-0"
                        aria-label="상세 닫기"
                        onClick={close}
                    >
                        <X aria-hidden className="size-5" />
                    </Button>
                </div>

                <dl className="grid gap-2 sm:grid-cols-3">
                    <FactTile label="응모 대상">
                        {MEMBERSHIP_LABEL[event.membershipRule]} 이상
                    </FactTile>
                    <FactTile label="응모 방식">{ticketUsage}</FactTile>
                    <FactTile label="당첨">
                        경품 {event.prizes.length}종 · 총 {totalWinners}명
                    </FactTile>
                </dl>

                {/*
                 * 지금 상태에서 할 일 하나만 채운 버튼으로 — 시작 전엔 수정, 마감 뒤엔 추첨 관리.
                 * 조회는 테두리 버튼으로 뒤에 두고, 되돌릴 수 없는 삭제·취소는 맨 아래 '이벤트 정리'로 뗀다
                 */}
                <div className="flex flex-wrap gap-2">
                    {hasDraw && (
                        <Button asChild>
                            <Link to={`/admin/draw?eventId=${event.id}`}>추첨 관리</Link>
                        </Button>
                    )}
                    {canEdit && (
                        <Button asChild>
                            <Link to={`/admin/events/${event.id}/edit`}>수정</Link>
                        </Button>
                    )}
                    <Button variant="secondary" asChild>
                        <Link to={`/admin/entries?view=participants&eventId=${event.id}`}>
                            참여자 조회
                        </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link to={`/admin/entries?eventId=${event.id}`}>응모 이력 조회</Link>
                    </Button>
                </div>
            </section>

            <section className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-5">
                <h3 className="text-body-bold text-fg-primary">설명</h3>
                <p className="text-body-sm text-fg-secondary whitespace-pre-wrap">
                    {event.description}
                </p>
            </section>

            {/* 경품은 등수 순 목록으로 — 좁은 오른쪽 칸에서 다섯 칸 표는 글이 세로로 쪼개졌다 */}
            <section className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-5">
                <h3 className="text-body-bold text-fg-primary">경품 ({event.prizes.length}종)</h3>
                <ul className="divide-border-default flex flex-col divide-y">
                    {[...event.prizes]
                        .sort((x, y) => x.rank - y.rank)
                        .map((prize) => (
                            <li
                                key={prize.id}
                                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                            >
                                {prize.imageUrl ? (
                                    <ZoomableThumbnail
                                        src={prize.imageUrl}
                                        label={`${prize.rank}등 경품 이미지`}
                                        className="size-12"
                                        onPreview={() =>
                                            setPreview({
                                                src: prize.imageUrl!,
                                                label: `${prize.rank}등 경품 이미지`,
                                            })
                                        }
                                    />
                                ) : (
                                    <EventThumbnail src={null} className="size-12" />
                                )}
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex items-center gap-2">
                                        <Badge variant="inverse" size="sm">
                                            {prize.rank}등
                                        </Badge>
                                        <span className="text-body-sm-bold text-fg-primary truncate">
                                            {prize.name}
                                        </span>
                                    </span>
                                    {prize.description && (
                                        <span className="text-caption text-fg-tertiary">
                                            {prize.description}
                                        </span>
                                    )}
                                </div>
                                <span className="text-body-sm-bold text-fg-primary shrink-0 tabular-nums">
                                    {prize.winnerCount}명
                                </span>
                            </li>
                        ))}
                </ul>
            </section>

            <section className="bg-surface-page border-border-default flex flex-col gap-3 rounded-2xl border p-5">
                <h3 className="text-body-bold text-fg-primary">운영 정보</h3>
                <DetailList>
                    <DetailItem label="자동 추첨">
                        {formatKst(event.drawScheduledAt, KST_YMD_HM)}
                    </DetailItem>
                    <DetailItem label="등록일">{formatKst(event.createdAt, KST_YMD_HM)}</DetailItem>
                    {event.canceledAt && (
                        <DetailItem label="취소일">
                            {formatKst(event.canceledAt, KST_YMD_HM)}
                        </DetailItem>
                    )}
                    {!event.imageUrl && <DetailItem label="대표 이미지">없음</DetailItem>}
                </DetailList>
                <DetailMeta>이벤트 ID {event.id}</DetailMeta>
            </section>

            {/*
             * 이벤트 정리 — 드물게 쓰고 되돌릴 수 없는 행동이라 운영 버튼과 떼어 맨 아래에 둔다.
             * 무엇이 일어나는지 한 줄씩 적고, 버튼은 채우지 않은 빨간 글자로 — 최종 확인은 대화상자가 한 번 더 받는다
             */}
            {(canEdit || canCancel) && (
                <section
                    aria-labelledby="event-cleanup-title"
                    className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-5"
                >
                    <h3 id="event-cleanup-title" className="text-body-bold text-fg-primary">
                        이벤트 정리
                    </h3>
                    {canEdit && (
                        <DangerRow
                            title="이벤트 삭제"
                            description="시작 전이라 목록에서 완전히 지울 수 있어요."
                            onClick={() => setAction('delete')}
                        />
                    )}
                    {canCancel && (
                        <DangerRow
                            title="이벤트 취소"
                            description="응모를 멈추고 쓴 응모권을 돌려줘요. 되돌릴 수 없어요."
                            onClick={() => setAction('cancel')}
                        />
                    )}
                </section>
            )}

            <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{preview?.label}</DialogTitle>
                        <DialogDescription className="sr-only">
                            이미지 확대 미리보기
                        </DialogDescription>
                    </DialogHeader>
                    {preview && <PreviewImage src={preview.src} label={preview.label} />}
                </DialogContent>
            </Dialog>

            <EventActionDialog
                event={event}
                action={action}
                open={action !== null}
                onOpenChange={(open) => {
                    if (!open) setAction(null);
                }}
                onDeleted={close}
            />
        </div>
    );
}
