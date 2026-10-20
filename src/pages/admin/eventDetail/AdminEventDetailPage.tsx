import { X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { EventActionKind } from '@features/manageEvent';

import {
    ADMIN_STATUS_META,
    EVENT_TYPE_LABEL,
    EventThumbnail,
    MEMBERSHIP_LABEL,
    useAdminEvent,
} from '@entities/event';
import { EventActionDialog } from '@features/manageEvent';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { CardSkeleton, LoadingBlock } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-6">
            <span className="text-body-sm text-fg-tertiary w-28 shrink-0 pt-0.5">{label}</span>
            <div className="text-body-sm text-fg-primary min-w-0">{children}</div>
        </div>
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
    const close = () => void navigate(closeTo);
    const { data: event, isPending, isError } = useAdminEvent(eventId);
    const [action, setAction] = useState<EventActionKind | null>(null);

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

    return (
        <div className="flex flex-col gap-4">
            {/* 머리 — 제목·상태와 닫기, 그 아래 운영 행동. 좁은 칸에서도 제목이 잘리지 않게 줄을 나눈다 */}
            <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-5">
                <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-col gap-2">
                        <span
                            className={cn(
                                badgeVariants({ variant: null }),
                                status.chipClass,
                                'self-start',
                            )}
                        >
                            {status.label}
                        </span>
                        <h2 className="text-title-3 text-fg-primary">{event.title}</h2>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-9 shrink-0"
                        aria-label="상세 닫기"
                        onClick={close}
                    >
                        <X aria-hidden className="size-5" />
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" asChild>
                        <Link to={`/admin/entries?view=participants&eventId=${event.id}`}>
                            참여자 조회
                        </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link to={`/admin/entries?eventId=${event.id}`}>응모 이력 조회</Link>
                    </Button>
                    {hasDraw && (
                        <Button variant="secondary" asChild>
                            <Link to={`/admin/draw?eventId=${event.id}`}>추첨 관리</Link>
                        </Button>
                    )}
                    {canEdit && (
                        <Button variant="secondary" asChild>
                            <Link to={`/admin/events/${event.id}/edit`}>수정</Link>
                        </Button>
                    )}
                    {canEdit && (
                        <Button variant="secondary" onClick={() => setAction('delete')}>
                            삭제
                        </Button>
                    )}
                    {canCancel && (
                        <Button variant="destructive" onClick={() => setAction('cancel')}>
                            취소
                        </Button>
                    )}
                </div>
            </section>

            <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-5">
                <h3 className="text-body-bold text-fg-primary">기본 정보</h3>
                <InfoRow label="이벤트 ID">{event.id}</InfoRow>
                <InfoRow label="설명">
                    <p className="whitespace-pre-wrap">{event.description}</p>
                </InfoRow>
                <InfoRow label="유형">
                    {EVENT_TYPE_LABEL[event.eventType]}
                    {event.eventType === 'TICKET' &&
                        ` · ${event.weightingEnabled ? '가중치' : '가중치 없음'} · ${
                            event.maxTicketsPerUser === null
                                ? '응모 상한 없음'
                                : `1인 최대 ${event.maxTicketsPerUser}장`
                        }`}
                </InfoRow>
                <InfoRow label="최소 등급">{MEMBERSHIP_LABEL[event.membershipRule]} 이상</InfoRow>
                <InfoRow label="응모 기간">
                    {formatKst(event.startsAt, KST_YMD_HM)} ~ {formatKst(event.endsAt, KST_YMD_HM)}{' '}
                    (KST)
                </InfoRow>
                <InfoRow label="자동 추첨 기준">
                    {formatKst(event.drawScheduledAt, KST_YMD_HM)} (KST)
                </InfoRow>
                {event.canceledAt && (
                    <InfoRow label="취소 이력">{formatKst(event.canceledAt, KST_YMD_HM)}</InfoRow>
                )}
                {/* 올린 사진이 맞는지는 그림으로 봐야 안다 — 키는 사람이 알아볼 수 없는 값이다 */}
                <InfoRow label="대표 이미지">
                    {event.imageUrl ? (
                        <span className="flex items-center gap-3">
                            <EventThumbnail src={event.imageUrl} className="size-14" />
                            <span className="text-caption text-fg-tertiary truncate">
                                {event.imageKey}
                            </span>
                        </span>
                    ) : (
                        '없음'
                    )}
                </InfoRow>
                <InfoRow label="등록일">{formatKst(event.createdAt, KST_YMD_HM)}</InfoRow>
            </section>

            <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-5">
                <h3 className="text-body-bold text-fg-primary">경품 ({event.prizes.length}종)</h3>
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-20">이미지</TableHead>
                            <TableHead className="w-16">등수</TableHead>
                            <TableHead>경품명</TableHead>
                            <TableHead className="w-24">당첨 인원</TableHead>
                            <TableHead>설명</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {event.prizes.map((prize) => (
                            <TableRow key={prize.id} className="hover:bg-transparent">
                                <TableCell>
                                    <EventThumbnail src={prize.imageUrl} className="size-12" />
                                </TableCell>
                                <TableCell>{prize.rank}등</TableCell>
                                <TableCell className="font-medium">{prize.name}</TableCell>
                                <TableCell>{prize.winnerCount}명</TableCell>
                                <TableCell className="text-fg-tertiary">
                                    {prize.description ?? '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>

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
